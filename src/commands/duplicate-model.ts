/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOrgInfo, postSalesforceApi, callSalesforceApi, SF_API_VERSION } from '../api';
import { UpdatePayload } from '../types';
import { checkOrgMatch } from '../utils/org-info-storage';
import { saveOrgInfo } from '../utils/org-info-storage';
import { resolveModelFolder } from '../utils/model-folder';

const SERVER_GENERATED_KEYS = new Set([
  'id', 'url', 'createdBy', 'createdDate', 'lastModifiedBy', 'lastModifiedDate',
  'isLocked', 'sourceCreation',
]);

export async function duplicateModelCommand(uri: vscode.Uri) {
  let filePath: string;

  if (uri) {
    filePath = uri.fsPath;
  } else {
    const selectedFile = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'JSON Files': ['json'] },
      openLabel: 'Select model.json to duplicate',
    });

    if (!selectedFile || selectedFile.length === 0) {
      return;
    }
    filePath = selectedFile[0].fsPath;
  }

  const fileName = path.basename(filePath);
  if (fileName !== 'model.json') {
    vscode.window.showErrorMessage('Please right-click on a model.json file to duplicate a model.');
    return;
  }

  const folderPath = path.dirname(filePath);

  try {
    const modelContent = fs.readFileSync(filePath, 'utf8');
    const modelData = JSON.parse(modelContent) as Record<string, unknown>;
    const originalApiName = modelData.apiName as string;
    const originalLabel = modelData.label as string;

    if (!originalApiName || !originalLabel) {
      vscode.window.showErrorMessage('model.json is missing apiName or label.');
      return;
    }

    // Org check first — resolve org before asking for input
    let orgInfo = await getOrgInfo();
    const orgCheckResult = await checkOrgMatch(folderPath, orgInfo.result);
    if (orgCheckResult === 'cancel') {
      vscode.window.showWarningMessage('Duplicate cancelled — org mismatch was not resolved.');
      return;
    }
    if (orgCheckResult === 'switched') { orgInfo = await getOrgInfo(); }

    // Step 1: Prompt for new label
    const newLabel = await vscode.window.showInputBox({
      title: 'Duplicate Model — Step 1/2',
      prompt: 'Enter a label for the new model',
      value: `${originalLabel} (Copy)`,
      placeHolder: 'New model label',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Label cannot be empty';
        }
        return undefined;
      },
    });

    if (newLabel === undefined) {
      return;
    }

    // Step 2: Prompt for new API name
    const newApiName = await vscode.window.showInputBox({
      title: 'Duplicate Model — Step 2/2',
      prompt: 'Enter an API name for the new model (must be unique)',
      value: `${originalApiName}_copy`,
      placeHolder: 'New model API name',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API name cannot be empty';
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
          return 'API name must start with a letter and contain only letters, numbers, and underscores';
        }
        if (value === originalApiName) {
          return `"${originalApiName}" already exists — use a different name`;
        }
        return undefined;
      },
    });

    if (newApiName === undefined) {
      return;
    }

    // Assemble the full payload from local files
    const payload = assembleModelPayload(folderPath, modelData, newLabel.trim(), newApiName.trim());

    const { instanceUrl, accessToken } = orgInfo.result;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Duplicating model as "${newLabel.trim()}"...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Creating model on server...' });

        const endpoint = `/services/data/${SF_API_VERSION}/ssot/semantic/models`;
        await postSalesforceApi(instanceUrl, accessToken, endpoint, payload);

        // Retrieve the newly created model and save locally
        progress.report({ message: 'Retrieving new model...' });

        const getEndpoint = `/services/data/${SF_API_VERSION}/ssot/semantic/models/${newApiName.trim()}`;
        const fullModel = await callSalesforceApi(instanceUrl, accessToken, getEndpoint, { allowUnmapped: 'true' });
        const decoded = decodeHtmlEntitiesDeep(fullModel) as Record<string, unknown>;

        progress.report({ message: 'Writing local files...' });

        const parentFolder = path.dirname(folderPath);
        const newFolderPath = resolveModelFolder(parentFolder, newLabel.trim(), newApiName.trim());

        writeModelToFolder(newFolderPath, decoded);
        saveOrgInfo(newFolderPath, orgInfo.result);
      }
    );

    const parentFolder = path.dirname(folderPath);
    const newFolderPath = resolveModelFolder(parentFolder, newLabel.trim(), newApiName.trim());
    const modelJsonUri = vscode.Uri.file(path.join(newFolderPath, 'model.json'));

    const action = await vscode.window.showInformationMessage(
      `Successfully duplicated model as "${newLabel.trim()}" (${newApiName.trim()})`,
      'Open Folder',
      'Visualize ERD',
      'Test Model'
    );

    if (action === 'Open Folder') {
      vscode.commands.executeCommand('revealInExplorer', modelJsonUri);
    } else if (action === 'Visualize ERD') {
      vscode.commands.executeCommand('semanticLayer.visualizeLocalERDV2', modelJsonUri);
    } else if (action === 'Test Model') {
      vscode.commands.executeCommand('semanticLayer.testModel', modelJsonUri);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('400') && message.toLowerCase().includes('already exists')) {
      vscode.window.showErrorMessage(
        `A model with API name "${uri ? 'the chosen name' : ''}" already exists. Please try again with a different API name.`
      );
    } else {
      vscode.window.showErrorMessage(`Failed to duplicate model: ${message}`);
    }
  }
}

function assembleModelPayload(
  folderPath: string,
  modelData: Record<string, unknown>,
  newLabel: string,
  newApiName: string,
): UpdatePayload & { apiName: string } {
  const payload: Record<string, unknown> = {};

  payload.apiName = newApiName;
  payload.label = newLabel;
  payload.dataspace = modelData.dataspace;
  if (modelData.queryUnrelatedDataObjects) {
    payload.queryUnrelatedDataObjects = modelData.queryUnrelatedDataObjects;
  }
  if (modelData.baseModels) {
    payload.baseModels = modelData.baseModels;
  }
  if (modelData.externalConnections) {
    payload.externalConnections = modelData.externalConnections;
  }
  if (modelData.businessPreferences) {
    payload.businessPreferences = modelData.businessPreferences;
  }

  const entityFiles: Record<string, string> = {
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
      const items = entityData.items ?? entityData.groupings ?? entityData;

      payload[payloadKey] = items;
    }
  }

  // Strip server-generated fields from all entity items
  stripServerFields(payload);

  return payload as unknown as UpdatePayload & { apiName: string };
}

function stripServerFields(obj: unknown): void {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      stripServerFields(item);
    }
  } else if (obj !== null && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (SERVER_GENERATED_KEYS.has(key) || key.endsWith('Url')) {
        delete record[key];
      } else {
        stripServerFields(record[key]);
      }
    }
  }
}

function writeModelToFolder(folderPath: string, decoded: Record<string, unknown>): void {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const modelMeta: Record<string, unknown> = {};
  const entityKeys = new Set([
    'semanticDataObjects', 'semanticRelationships', 'semanticCalculatedDimensions',
    'semanticCalculatedMeasurements', 'semanticGroupings', 'semanticLogicalViews',
    'semanticParameters', 'semanticDimensionHierarchies', 'semanticMetrics',
    'semanticModelInfo', 'semanticModelFilters', 'fieldsOverrides',
  ]);
  for (const [key, val] of Object.entries(decoded)) {
    if (!entityKeys.has(key) && !key.endsWith('Url')) {
      modelMeta[key] = val;
    }
  }

  const entities: Record<string, unknown> = {
    'model.json': modelMeta,
    'dataObjects.json': { items: decoded.semanticDataObjects ?? [] },
    'relationships.json': { items: decoded.semanticRelationships ?? [] },
    'calculatedDimensions.json': { items: decoded.semanticCalculatedDimensions ?? [] },
    'calculatedMeasurements.json': { items: decoded.semanticCalculatedMeasurements ?? [] },
    'groupings.json': { groupings: decoded.semanticGroupings ?? [] },
    'parameters.json': { items: decoded.semanticParameters ?? [] },
    'logicalViews.json': { items: decoded.semanticLogicalViews ?? [] },
    'dimensionHierarchies.json': { items: decoded.semanticDimensionHierarchies ?? [] },
    'metrics.json': { items: decoded.semanticMetrics ?? [] },
    'modelInfo.json': decoded.semanticModelInfo ?? {},
    'fieldsOverrides.json': { items: decoded.fieldsOverrides ?? [] },
    'modelFilters.json': { items: decoded.semanticModelFilters ?? [] },
  };

  // Partition base model entities into separate folders
  const baseModels = (modelMeta.baseModels ?? []) as { apiName: string; label: string }[];
  if (baseModels.length > 0) {
    const baseModelLabelMap = new Map(baseModels.map(bm => [bm.apiName, bm.label]));

    const partitionableFiles = [
      'dataObjects.json', 'relationships.json', 'calculatedDimensions.json',
      'calculatedMeasurements.json', 'parameters.json', 'logicalViews.json',
      'dimensionHierarchies.json', 'metrics.json', 'fieldsOverrides.json',
      'modelFilters.json', 'groupings.json',
    ];

    for (const fileName of partitionableFiles) {
      const data = entities[fileName] as Record<string, unknown>;
      const itemsKey = fileName === 'groupings.json' ? 'groupings' : 'items';
      const allItems = (data[itemsKey] as Array<Record<string, unknown>>) ?? [];

      const mainItems: Record<string, unknown>[] = [];
      const byBase = new Map<string, Record<string, unknown>[]>();

      for (const item of allItems) {
        const baseApiName = item.baseModelApiName as string | undefined;
        if (baseApiName && baseModelLabelMap.has(baseApiName)) {
          const label = baseModelLabelMap.get(baseApiName)!;
          if (!byBase.has(label)) { byBase.set(label, []); }
          byBase.get(label)!.push(item);
        } else {
          mainItems.push(item);
        }
      }

      data[itemsKey] = mainItems;

      for (const [label, items] of byBase) {
        if (items.length === 0) { continue; }
        const baseFolderPath = path.join(folderPath, 'base', label);
        if (!fs.existsSync(baseFolderPath)) {
          fs.mkdirSync(baseFolderPath, { recursive: true });
        }
        fs.writeFileSync(
          path.join(baseFolderPath, fileName),
          JSON.stringify({ [itemsKey]: items }, null, 2),
          'utf8'
        );
      }
    }
  }

  for (const [fileName, data] of Object.entries(entities)) {
    fs.writeFileSync(
      path.join(folderPath, fileName),
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function decodeHtmlEntitiesDeep(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return decodeHtmlEntities(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(decodeHtmlEntitiesDeep);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = decodeHtmlEntitiesDeep(val);
    }
    return result;
  }
  return obj;
}
