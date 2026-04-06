/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOrgInfo, callSalesforceApi, postSalesforceApi, SF_API_VERSION } from '../api';
import { SemanticModelsResponse } from '../types';
import { saveOrgInfo } from '../utils/org-info-storage';
import { resolveModelFolder, resolveSemanticModelsFolder } from '../utils/model-folder';

export async function extendRemoteModelCommand(uri: vscode.Uri) {
  try {
    const orgInfo = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching semantic models...',
        cancellable: false,
      },
      async () => await getOrgInfo()
    );

    const { instanceUrl, accessToken } = orgInfo.result;

    const config = vscode.workspace.getConfiguration('semanticLayer');
    const defaultFilter = config.get<string>('defaultModelFilter', '');

    const queryParams: Record<string, string> = {};
    if (defaultFilter && defaultFilter.trim() !== '') {
      queryParams.searchTerm = defaultFilter.trim();
    }

    const modelsResponse = await callSalesforceApi(
      instanceUrl,
      accessToken,
      `/services/data/${SF_API_VERSION}/ssot/semantic/models`,
      queryParams
    ) as SemanticModelsResponse;

    const models = modelsResponse?.items ?? [];

    if (models.length === 0) {
      vscode.window.showWarningMessage('No semantic models found in this org.');
      return;
    }

    const modelItems = models.map(m => ({
      label: m.label,
      description: m.apiName,
      model: m
    }));

    const selected = await vscode.window.showQuickPick(modelItems, {
      placeHolder: 'Select a semantic model to extend',
      title: 'Extend Remote Model'
    });

    if (!selected) {
      return;
    }

    const model = selected.model;

    const newLabel = await vscode.window.showInputBox({
      title: 'Extend Remote Model — Step 1/2',
      prompt: 'Enter a label for the new extended model',
      value: `${model.label} Extended`,
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

    const newApiName = await vscode.window.showInputBox({
      title: 'Extend Remote Model — Step 2/2',
      prompt: 'Enter an API name for the new extended model (must be unique)',
      value: `${model.apiName}_extended`,
      placeHolder: 'New model API name',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API name cannot be empty';
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
          return 'API name must start with a letter and contain only letters, numbers, and underscores';
        }
        if (value === model.apiName) {
          return `"${model.apiName}" already exists — use a different name`;
        }
        return undefined;
      },
    });

    if (newApiName === undefined) {
      return;
    }

    let folderPath: string;
    if (uri) {
      folderPath = resolveSemanticModelsFolder(uri.fsPath);
    } else {
      const selectedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Folder',
      });
      if (!selectedFolder || selectedFolder.length === 0) {
        return;
      }
      folderPath = selectedFolder[0].fsPath;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Extending "${model.label}" as "${newLabel.trim()}"...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Creating extended model on server...' });

        const payload = {
          apiName: newApiName.trim(),
          label: newLabel.trim(),
          dataspace: model.dataspace,
          baseModels: [{ apiName: model.apiName, label: model.label }],
        };

        const createEndpoint = `/services/data/${SF_API_VERSION}/ssot/semantic/models`;
        await postSalesforceApi(instanceUrl, accessToken, createEndpoint, payload);

        progress.report({ message: 'Retrieving new model...' });

        const getEndpoint = `/services/data/${SF_API_VERSION}/ssot/semantic/models/${newApiName.trim()}`;
        const newModel = await callSalesforceApi(instanceUrl, accessToken, getEndpoint, { allowUnmapped: 'true' });
        const decoded = decodeHtmlEntitiesDeep(newModel) as Record<string, unknown>;

        progress.report({ message: 'Writing local files...' });

        const newFolderPath = resolveModelFolder(folderPath, newLabel.trim(), newApiName.trim());
        writeModelToFolder(newFolderPath, decoded);
        saveOrgInfo(newFolderPath, orgInfo.result);
      }
    );

    const newFolderPath = resolveModelFolder(folderPath, newLabel.trim(), newApiName.trim());
    const modelJsonUri = vscode.Uri.file(path.join(newFolderPath, 'model.json'));

    vscode.window.showInformationMessage(
      `Successfully created extended model "${newLabel.trim()}" (${newApiName.trim()}) based on "${model.label}"`,
      'Open Folder',
      'Visualize ERD',
      'Test Model'
    ).then(action => {
      if (action === 'Open Folder') {
        vscode.commands.executeCommand('revealInExplorer', modelJsonUri);
      } else if (action === 'Visualize ERD') {
        vscode.commands.executeCommand('semanticLayer.visualizeLocalERDV2', modelJsonUri);
      } else if (action === 'Test Model') {
        vscode.commands.executeCommand('semanticLayer.testModel', modelJsonUri);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('400') && message.toLowerCase().includes('already exists')) {
      vscode.window.showErrorMessage(
        'A model with that API name already exists. Please try again with a different API name.'
      );
    } else {
      vscode.window.showErrorMessage(`Failed to extend remote model: ${message}`);
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
