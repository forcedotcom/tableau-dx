/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOrgInfo, putSalesforceApi, SF_API_VERSION } from '../api';
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
      filters: { 'model.json': ['json'] },
      openLabel: 'Select model.json to Deploy',
    });
    
    if (!selectedFile || selectedFile.length === 0) {
      return;
    }
    filePath = selectedFile[0].fsPath;
  }

  const fileName = path.basename(filePath);
  if (fileName !== 'model.json') {
    vscode.window.showErrorMessage('Deploy must be run from model.json.');
    return;
  }

  const folderPath = path.dirname(filePath);
  
  try {
    const modelContent = fs.readFileSync(filePath, 'utf8');
    const modelData: Record<string, unknown> = JSON.parse(modelContent);
    const modelApiName = modelData.apiName as string;

    const payload: UpdatePayload = {};
    payload.dataspace = modelData.dataspace as string;
    payload.label = modelData.label as string;
    if (modelData.queryUnrelatedDataObjects) {
      payload.queryUnrelatedDataObjects = modelData.queryUnrelatedDataObjects as string;
    }
    if (modelData.businessPreferences) {
      payload.businessPreferences = modelData.businessPreferences as string;
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

    for (const [entityFileName, payloadKey] of Object.entries(entityFiles)) {
      const entityFilePath = path.join(folderPath, entityFileName);
      if (fs.existsSync(entityFilePath)) {
        const entityContent = fs.readFileSync(entityFilePath, 'utf8');
        const entityData = JSON.parse(entityContent);
        (payload as Record<string, unknown>)[payloadKey] = entityData.items ?? entityData.groupings ?? entityData;
      }
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

        const endpoint = `/services/data/${SF_API_VERSION}/ssot/semantic/models/${modelApiName}`;
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