import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SemanticModelUI, loadSemanticModelFiles, buildDependencyGraph, buildSemanticModelUI } from '../v2';
import { getERDV2WebviewContent } from '../webviews/erd-v2';
import { getOrgInfo, callSalesforceApi, postSalesforceApi } from '../api';
import { mergeForCompare, rawModelFromApiResponse } from '../utils/compare-models';
import { checkOrgMatch } from '../utils/org-info-storage';
import { FilePositionStorage } from '../utils/position-storage';
import { createWebviewPanel } from '../utils/webview-utils';

export async function visualizeCompareERDCommand(context: vscode.ExtensionContext, uri: vscode.Uri) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click on a model.json file to visualize and compare.');
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
        title: 'Building ERD and comparing with remote...',
        cancellable: false,
      },
      async () => {
        const localRaw = loadSemanticModelFiles(folderPath);
        let modelUI: SemanticModelUI;

        try {
          let orgInfo = await getOrgInfo();

          const orgCheckResult = await checkOrgMatch(folderPath, orgInfo.result);
          if (orgCheckResult === 'cancel') {
            return;
          }
          if (orgCheckResult === 'switched') {
            orgInfo = await getOrgInfo();
          }

          const { instanceUrl, accessToken } = orgInfo.result;

          const modelApiName = localRaw.model.apiName;
          const fullModelUrl = `/services/data/v65.0/ssot/semantic/models/${modelApiName}`;
          const fullModelResponse = await callSalesforceApi(instanceUrl, accessToken, fullModelUrl, { allowUnmapped: 'false' }) as Record<string, any>;

          const remoteRaw = rawModelFromApiResponse(fullModelResponse);
          const mergedRaw = mergeForCompare(localRaw, remoteRaw);
          const depGraph = buildDependencyGraph(mergedRaw);
          modelUI = buildSemanticModelUI(mergedRaw, depGraph);
          modelUI.isCompareMode = true;
        } catch (error) {
          vscode.window.showWarningMessage('Could not fetch remote model for comparison. Showing local ERD only.');
          const depGraph = buildDependencyGraph(localRaw);
          modelUI = buildSemanticModelUI(localRaw, depGraph);
        }

        showCompareERDPanel(context, modelUI, folderPath);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to visualize and compare ERD: ${message}`);
  }
}

function showCompareERDPanel(
  context: vscode.ExtensionContext,
  modelUI: SemanticModelUI,
  folderPath: string
) {
  const assetsDir = path.join(context.extensionPath, 'src', 'assets');
  const iconNames = ['table', 'data_model', 'data_lake', 'calc_dim', 'calc_mes', 'hierarchy', 'metric', 'grouping', 'shared', 'calc_insight'];
  const icons: Record<string, string> = {};
  for (const name of iconNames) {
    try {
      icons[name] = fs.readFileSync(path.join(assetsDir, `${name}.svg`), 'utf8');
    } catch {
      icons[name] = '';
    }
  }

  const { panel, resources } = createWebviewPanel(
    context, 'semanticERDCompare', `ERD (Compare): ${modelUI.model.label}`, vscode.ViewColumn.One
  );

  panel.webview.html = getERDV2WebviewContent(modelUI, icons, resources.sldsUri);

  const outputChannel = vscode.window.createOutputChannel('Semantic Layer ERD (Compare)');
  const positionStorage = new FilePositionStorage(folderPath);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === 'runSemanticQuery') {
        try {
          if (!message.fields || message.fields.length === 0) {
            throw new Error('No fields to query.');
          }
          const orgInfo = await getOrgInfo();
          const { instanceUrl, accessToken } = orgInfo.result;

          const fieldLabels: {[key: string]: string} = {};
          const queryFields = message.fields.map((f: {apiName: string; label: string; tableApiName: string}) => {
            const alias = `${f.tableApiName}.${f.apiName}`;
            fieldLabels[alias] = f.label;
            return {
              expression: { tableField: { name: f.apiName, tableName: f.tableApiName } },
              alias
            };
          });

          const payload = {
            dataspace: modelUI.model.dataspace || 'default',
            source: 'vscode-extension',
            structuredSemanticQuery: {
              fields: queryFields,
              options: { limitOptions: { limit: 100 }, sortOrders: [], detailedRows: true }
            },
            semanticModelId: modelUI.model.id
          };

          outputChannel.appendLine(`Query: ${JSON.stringify(payload, null, 2)}`);
          const result = await postSalesforceApi(instanceUrl, accessToken, '/services/data/v65.0/semantic-engine/gateway', payload);

          panel.webview.postMessage({ command: 'queryResult', success: true, data: result, fieldLabels, nodeLabel: message.nodeLabel });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          panel.webview.postMessage({ command: 'queryResult', success: false, error: errorMessage });
        }
      } else if (message.command === 'requestPositions') {
        const positions = positionStorage.getPositions(message.positionContext);
        panel.webview.postMessage({ command: 'positionsLoaded', positions, positionContext: message.positionContext });
      } else if (message.command === 'savePosition') {
        positionStorage.savePosition(message.positionContext, message.nodeId, message.x, message.y);
      } else if (message.command === 'saveAllPositions') {
        positionStorage.saveAllPositions(message.positionContext, message.positions);
      } else if (message.command === 'clearPositions') {
        positionStorage.clearPositions(message.positionContext);
      }
    },
    undefined,
    context.subscriptions
  );
}
