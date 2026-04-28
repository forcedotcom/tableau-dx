/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOrgInfo, postSalesforceApi } from '../api';
import { checkOrgMatch } from '../utils/org-info-storage';

export async function validateModelCommand(uri: vscode.Uri) {
  let filePath: string;

  if (uri) {
    filePath = uri.fsPath;
  } else {
    const selectedFile = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'model.json': ['json'] },
      openLabel: 'Select model.json to Validate',
    });

    if (!selectedFile || selectedFile.length === 0) {
      return;
    }
    filePath = selectedFile[0].fsPath;
  }

  const fileName = path.basename(filePath);
  if (fileName !== 'model.json') {
    vscode.window.showErrorMessage('Validate must be run from model.json.');
    return;
  }

  const folderPath = path.dirname(filePath);

  try {
    const modelContent = fs.readFileSync(filePath, 'utf8');
    const modelData: Record<string, unknown> = JSON.parse(modelContent);
    const modelApiName = (modelData.apiName as string) ?? 'unknown';
    const baseModels = modelData.baseModels as { apiName: string; label: string }[] | undefined;
    const isExtended = baseModels && baseModels.length > 0;

    const payload: Record<string, unknown> = {};
    payload.apiName = modelData.apiName;
    payload.label = modelData.label;
    payload.dataspace = modelData.dataspace;
    if (modelData.queryUnrelatedDataObjects) {
      payload.queryUnrelatedDataObjects = modelData.queryUnrelatedDataObjects;
    }
    if (modelData.businessPreferences) {
      payload.businessPreferences = modelData.businessPreferences;
    }
    if (isExtended) {
      payload.baseModels = baseModels;
    }

    const entityFiles: { fileName: string; payloadKey: string; itemsKey: string }[] = [
      { fileName: 'dataObjects.json', payloadKey: 'semanticDataObjects', itemsKey: 'items' },
      { fileName: 'relationships.json', payloadKey: 'semanticRelationships', itemsKey: 'items' },
      { fileName: 'calculatedDimensions.json', payloadKey: 'semanticCalculatedDimensions', itemsKey: 'items' },
      { fileName: 'calculatedMeasurements.json', payloadKey: 'semanticCalculatedMeasurements', itemsKey: 'items' },
      { fileName: 'groupings.json', payloadKey: 'semanticGroupings', itemsKey: 'groupings' },
      { fileName: 'parameters.json', payloadKey: 'semanticParameters', itemsKey: 'items' },
      { fileName: 'metrics.json', payloadKey: 'semanticMetrics', itemsKey: 'items' },
      { fileName: 'logicalViews.json', payloadKey: 'semanticLogicalViews', itemsKey: 'items' },
      { fileName: 'dimensionHierarchies.json', payloadKey: 'semanticDimensionHierarchies', itemsKey: 'items' },
      { fileName: 'fieldsOverrides.json', payloadKey: 'fieldsOverrides', itemsKey: 'items' },
      { fileName: 'modelFilters.json', payloadKey: 'semanticModelFilters', itemsKey: 'items' },
    ];

    for (const { fileName, payloadKey, itemsKey } of entityFiles) {
      const entityFilePath = path.join(folderPath, fileName);
      if (fs.existsSync(entityFilePath)) {
        const entityContent = fs.readFileSync(entityFilePath, 'utf8');
        const entityData = JSON.parse(entityContent);
        payload[payloadKey] = entityData[itemsKey] ?? entityData;
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

    const outputChannel = vscode.window.createOutputChannel('Semantic Layer Validate');
    outputChannel.clear();
    outputChannel.show();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Validating ${modelApiName}...`,
        cancellable: false,
      },
      async () => {
        const endpoint = `/services/data/v67.0/ssot/semantic/models/validate`;
        const result = await postSalesforceApi(instanceUrl, accessToken, endpoint, payload) as Record<string, unknown>;

        const isValid = result.isValid === true;
        const validation = result.validation as Record<string, unknown> | undefined;
        const validationErrors = (validation?.validationErrors ?? []) as unknown[];
        const errorCount = validationErrors.length;

        outputChannel.appendLine(`=== Validation Result: ${modelApiName} ===\n`);

        if (isValid && errorCount === 0) {
          outputChannel.appendLine('Model is valid.');
          vscode.window.showInformationMessage(`"${modelApiName}" is valid.`);
        } else {
          outputChannel.appendLine(`Model has ${errorCount} validation error${errorCount !== 1 ? 's' : ''}:\n`);
          outputChannel.appendLine(JSON.stringify(validation, null, 2));
          vscode.window.showWarningMessage(
            `"${modelApiName}" has ${errorCount} validation error${errorCount !== 1 ? 's' : ''} — check Output panel`
          );
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Validation failed: ${message}`);
  }
}
