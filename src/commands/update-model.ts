import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOrgInfo, putSalesforceApi } from '../api';
import { UpdatePayload } from '../types';
import { checkOrgMatch } from '../utils/org-info-storage';

export async function updateModelCommand(uri: vscode.Uri) {
  let filePath: string;
  
  if (uri) {
    filePath = uri.fsPath;
  } else {
    const selectedFile = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'JSON Files': ['json'] },
      openLabel: 'Select JSON File to Update',
    });
    
    if (!selectedFile || selectedFile.length === 0) {
      return;
    }
    filePath = selectedFile[0].fsPath;
  }

  const fileName = path.basename(filePath);
  const folderPath = path.dirname(filePath);
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);

    let modelApiName: string;
    let modelData: Record<string, unknown>;
    let payload: UpdatePayload = {};

    const modelFilePath = fileName === 'model.json' 
      ? filePath 
      : path.join(folderPath, 'model.json');
    
    if (!fs.existsSync(modelFilePath)) {
      vscode.window.showErrorMessage('Cannot find model.json. Please ensure you\'re updating from a valid semantic model folder.');
      return;
    }

    const modelContent = fs.readFileSync(modelFilePath, 'utf8');
    modelData = JSON.parse(modelContent);
    modelApiName = modelData.apiName as string;

    payload.dataspace = modelData.dataspace as string;
    payload.label = modelData.label as string;
    if (modelData.queryUnrelatedDataObjects) {
      payload.queryUnrelatedDataObjects = modelData.queryUnrelatedDataObjects as string;
    }

    const entityFiles: Record<string, keyof UpdatePayload> = {
      'dataObjects.json': 'semanticDataObjects',
      'relationships.json': 'semanticRelationships',
      'calculatedDimensions.json': 'semanticCalculatedDimensions',
      'calculatedMeasurements.json': 'semanticCalculatedMeasurements',
      'groupings.json': 'semanticGroupings',
      'parameters.json': 'semanticParameters',
      'metrics.json': 'semanticMetrics',
      'logicalViews.json': 'semanticLogicalViews',
      'dimensionHierarchies.json': 'semanticDimensionHierarchies',
      'fieldsOverrides.json': 'fieldsOverrides',
      'modelFilters.json': 'semanticModelFilters',
    };

    if (fileName === 'model.json') {
      for (const [entityFileName, payloadKey] of Object.entries(entityFiles)) {
        const entityFilePath = path.join(folderPath, entityFileName);
        if (fs.existsSync(entityFilePath)) {
          const entityContent = fs.readFileSync(entityFilePath, 'utf8');
          const entityData = JSON.parse(entityContent);
          (payload as Record<string, unknown>)[payloadKey] = entityData.items ?? entityData.groupings ?? entityData;
        }
      }
    } else {
      const payloadKey = entityFiles[fileName];
      if (!payloadKey) {
        vscode.window.showErrorMessage(`Unknown entity file: ${fileName}. Expected one of: ${Object.keys(entityFiles).join(', ')}`);
        return;
      }
      (payload as Record<string, unknown>)[payloadKey] = jsonData.items ?? jsonData.groupings ?? jsonData;
    }

    let orgInfo = await getOrgInfo();

    const orgCheckResult = await checkOrgMatch(folderPath, orgInfo.result);
    if (orgCheckResult === 'cancel') {
      return;
    }
    if (orgCheckResult === 'switched') {
      orgInfo = await getOrgInfo();
    }

    const { instanceUrl, accessToken } = orgInfo.result;

    const outputChannel = vscode.window.createOutputChannel('Semantic Layer Update');
    outputChannel.clear();
    outputChannel.show();
    
    outputChannel.appendLine(`=== Update: ${modelApiName} ===`);
    outputChannel.appendLine(`\n--- Payload being sent ---`);
    outputChannel.appendLine(JSON.stringify(payload, null, 2));

    const confirm = await vscode.window.showWarningMessage(
      `Update semantic model "${modelApiName}"? Check the Output panel for payload details.`,
      { modal: true },
      'Update'
    );

    if (confirm !== 'Update') {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Updating ${modelApiName}...`,
        cancellable: false,
      },
      async () => {

        const endpoint = `/services/data/v65.0/ssot/semantic/models/${modelApiName}`;
        outputChannel.appendLine(`\n--- API Endpoint ---`);
        outputChannel.appendLine(`PUT ${instanceUrl}${endpoint}`);
        
        const result = await putSalesforceApi(instanceUrl, accessToken, endpoint, payload);

        outputChannel.appendLine(`\n--- API Response ---`);
        outputChannel.appendLine(JSON.stringify(result, null, 2));
        
        vscode.window.showInformationMessage(`Updated "${modelApiName}" - check Output panel for response`);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to update: ${message}`);
  }
}
