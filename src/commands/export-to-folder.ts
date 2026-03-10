/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOrgInfo, callSalesforceApi } from '../api';
import { SemanticModelsResponse } from '../types';
import { saveOrgInfo } from '../utils/org-info-storage';

export async function exportToFolderCommand(uri: vscode.Uri) {
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
      '/services/data/v65.0/ssot/semantic/models',
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
      placeHolder: 'Select a semantic model to export',
      title: 'Export Semantic Model'
    });

    if (!selected) {
      return;
    }

    const model = selected.model;

    let folderPath: string;
    
    if (uri) {
      folderPath = uri.fsPath;
    } else {
      const selectedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Export Folder',
      });
      
      if (!selectedFolder || selectedFolder.length === 0) {
        return;
      }
      folderPath = selectedFolder[0].fsPath;
    }

    const modelFolderPath = path.join(folderPath, model.label);
    
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Exporting ${model.label}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Fetching model data...' });

        const fullModelUrl = `/services/data/v65.0/ssot/semantic/models/${model.apiName}`;

        const unmapped = { allowUnmapped: 'true' };
        const fullModel = await callSalesforceApi(instanceUrl, accessToken, fullModelUrl, unmapped);

        // Decode HTML entities from API responses before saving
        const decoded = decodeHtmlEntitiesDeep(fullModel) as Record<string, unknown>;

        progress.report({ message: 'Writing files...' });

        if (!fs.existsSync(modelFolderPath)) {
          fs.mkdirSync(modelFolderPath, { recursive: true });
        }

        // Build model.json with full metadata (not just the list item)
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
              const baseFolderPath = path.join(modelFolderPath, 'base', label);
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
          const filePath = path.join(modelFolderPath, fileName);
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        }

        saveOrgInfo(modelFolderPath, orgInfo.result);
      }
    );

    const modelJsonUri = vscode.Uri.file(path.join(modelFolderPath, 'model.json'));

    const action = await vscode.window.showInformationMessage(
      `Successfully exported "${model.label}" to ${modelFolderPath}`,
      'Open Folder',
      'Visualize ERD',
      'Test Model'
    );

    if (action === 'Open Folder') {
      vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(path.join(modelFolderPath, 'model.json')));
    } else if (action === 'Visualize ERD') {
      vscode.commands.executeCommand('semanticLayer.visualizeLocalERDV2', modelJsonUri);
    } else if (action === 'Test Model') {
      vscode.commands.executeCommand('semanticLayer.testModel', modelJsonUri);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to export semantic models: ${message}`);
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