import * as vscode from 'vscode';
import * as path from 'path';
import { buildModelRepresentation } from '../v2';
import { loadSemanticModelFiles } from '../v2/model-loader';
import { getTestModelWebviewContent } from '../webviews/test-model';
import { getOrgInfo, postSalesforceApi } from '../api';
import { checkOrgMatch } from '../utils/org-info-storage';
import { createWebviewPanel } from '../utils/webview-utils';

export async function testModelCommand(context: vscode.ExtensionContext, uri: vscode.Uri) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click on a model.json file to test the model.');
      return;
    }

    const filePath = uri.fsPath;
    const folderPath = path.dirname(filePath);
    const fileName = path.basename(filePath);

    if (fileName !== 'model.json') {
      vscode.window.showWarningMessage('Please select a model.json file.');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Loading model for testing...',
        cancellable: false,
      },
      async () => {
        const modelUI = buildModelRepresentation(folderPath);
        const rawModel = loadSemanticModelFiles(folderPath);
        showTestModelPanel(context, modelUI, rawModel, folderPath);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to open Test Model: ${message}`);
  }
}

function buildFullSemanticModel(rawModel: ReturnType<typeof loadSemanticModelFiles>): Record<string, unknown> {
  // model.json now contains all metadata from the full model (since export was updated)
  const base: Record<string, unknown> = { ...rawModel.model as unknown as Record<string, unknown> };

  // Attach entity arrays from local split files (which the user may have modified)
  base.semanticDataObjects = rawModel.dataObjects;
  base.semanticRelationships = rawModel.relationships;
  base.semanticCalculatedDimensions = rawModel.calculatedDimensions;
  base.semanticCalculatedMeasurements = rawModel.calculatedMeasurements;
  base.semanticGroupings = rawModel.groupings;
  base.semanticLogicalViews = rawModel.logicalViews;
  base.semanticParameters = rawModel.parameters;
  base.semanticDimensionHierarchies = rawModel.dimensionHierarchies;
  base.semanticMetrics = rawModel.metrics;
  base.semanticModelInfo = rawModel.modelInfo;
  base.fieldsOverrides = rawModel.fieldsOverrides;
  base.semanticModelFilters = rawModel.modelFilters;

  // Defaults for essential gateway fields if missing (for older exports)
  if (!base.isQueryable) { base.isQueryable = 'Queryable'; }
  if (!base.currency) { base.currency = { useOrgDefault: true }; }

  return base;
}

function showTestModelPanel(
  context: vscode.ExtensionContext,
  modelUI: ReturnType<typeof buildModelRepresentation>,
  rawModel: ReturnType<typeof loadSemanticModelFiles>,
  folderPath: string
) {
  const { panel, resources } = createWebviewPanel(
    context, 'semanticTestModel', `Test: ${modelUI.model.label}`, vscode.ViewColumn.One
  );

  panel.webview.html = getTestModelWebviewContent(modelUI, resources.sldsUri);

  const fullSemanticModel = buildFullSemanticModel(rawModel);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === 'runQuery') {
        try {
          let orgInfo = await getOrgInfo();

          const orgCheckResult = await checkOrgMatch(folderPath, orgInfo.result);
          if (orgCheckResult === 'cancel') {
            panel.webview.postMessage({ command: 'queryResult', success: false, error: 'Query cancelled — org mismatch.' });
            return;
          }
          if (orgCheckResult === 'switched') {
            orgInfo = await getOrgInfo();
          }

          const { instanceUrl, accessToken } = orgInfo.result;

          interface FieldMsg {
            apiName: string; label: string; tableApiName: string;
            fieldType: string; aggregationType?: string;
          }

          // Check if this is an aggregate query (any measurement with aggregation != None)
          const isAggregate = message.fields.some((f: FieldMsg) => {
            if (f.fieldType === 'measurement') {
              return f.aggregationType && f.aggregationType !== 'None';
            }
            return f.fieldType === 'calcMeasurement';
          });

          const queryFields = message.fields.map((f: FieldMsg) => {
            // Dimensions: always rowGrouping true
            if (f.fieldType === 'dimension') {
              return {
                expression: { tableField: { name: f.apiName, tableName: f.tableApiName } },
                alias: `${f.tableApiName}.${f.apiName}`,
                rowGrouping: true,
              };
            }

            // Calculated dimensions: semanticField, rowGrouping true
            if (f.fieldType === 'calcDimension') {
              return {
                expression: { semanticField: { name: f.apiName } },
                alias: f.apiName,
                rowGrouping: true,
              };
            }

            // Regular measurements: tableField + aggregation
            if (f.fieldType === 'measurement') {
              const aggType = f.aggregationType || 'Sum';
              const isNone = aggType === 'None';
              return {
                expression: { tableField: { name: f.apiName, tableName: f.tableApiName } },
                alias: `${f.tableApiName}.${f.apiName}`,
                rowGrouping: isNone,
                semanticAggregationMethod: `SEMANTIC_AGGREGATION_METHOD_${aggType.toUpperCase()}`,
              };
            }

            // Calculated measurements: semanticField + USER_AGG
            return {
              expression: { semanticField: { name: f.apiName } },
              alias: f.apiName,
              rowGrouping: false,
              semanticAggregationMethod: 'SEMANTIC_AGGREGATION_METHOD_USER_AGG',
            };
          });

          const limit = message.limit || 100;
          const options: Record<string, unknown> = {
            limitOptions: { limit: isAggregate ? limit + 1 : limit },
            sortOrders: [],
          };
          if (isAggregate) {
            options.grandTotal = true;
          }

          // Build alias -> friendly label map
          const fieldLabels: Record<string, string> = {};
          message.fields.forEach((f: FieldMsg) => {
            const isCalc = f.fieldType === 'calcDimension' || f.fieldType === 'calcMeasurement';
            const alias = isCalc ? f.apiName : `${f.tableApiName}.${f.apiName}`;
            fieldLabels[alias] = f.label || f.apiName;
          });

          const structuredSemanticQuery: Record<string, unknown> = {
            fields: queryFields,
            options,
          };

          const payload: Record<string, unknown> = {
            dataspace: modelUI.model.dataspace || 'default',
            source: 'vscode-extension',
            structuredSemanticQuery,
            semanticModel: fullSemanticModel
          };

          const result = await postSalesforceApi(
            instanceUrl, accessToken,
            '/services/data/v65.0/semantic-engine/gateway',
            payload
          );

          panel.webview.postMessage({
            command: 'queryResult',
            success: true,
            data: result,
            payload,
            fieldLabels,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          panel.webview.postMessage({
            command: 'queryResult',
            success: false,
            error: errorMessage
          });
        }
      }
    },
    undefined,
    context.subscriptions
  );
}
