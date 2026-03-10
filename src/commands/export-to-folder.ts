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

        const rawApiFolder = path.join(modelFolderPath, '_raw_api_response');
        if (!fs.existsSync(rawApiFolder)) {
          fs.mkdirSync(rawApiFolder, { recursive: true });
        }
        fs.writeFileSync(path.join(rawApiFolder, 'fullModel.json'), JSON.stringify(decoded, null, 2), 'utf8');

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
