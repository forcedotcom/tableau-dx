/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  SemanticModelUI,
  loadSemanticModelFiles,
  loadRawModelFromCommit,
  buildDependencyGraph,
  buildSemanticModelUI,
  GitCommitInfo,
} from '../v2';
import { getERDV2WebviewContent } from '../webviews/erd-v2';
import { getCommitsForFolder, isGitRepository } from '../utils/git';
import { mergeForCompare } from '../utils/compare-models';
import { getOrgInfo, postSalesforceApi, SF_API_VERSION } from '../api';
import { checkOrgMatch } from '../utils/org-info-storage';
import { FilePositionStorage } from '../utils/position-storage';
import { createWebviewPanel } from '../utils/webview-utils';

export async function visualizeModelHistoryCommand(context: vscode.ExtensionContext, uri: vscode.Uri) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click on a model folder to view its history.');
      return;
    }

    let folderPath: string;

    const stats = fs.statSync(uri.fsPath);
    if (stats.isFile()) {
      if (path.basename(uri.fsPath) === 'model.json') {
        folderPath = path.dirname(uri.fsPath);
      } else {
        vscode.window.showWarningMessage('Please select a model folder or model.json file.');
        return;
      }
    } else {
      folderPath = uri.fsPath;
    }

    const modelJsonPath = path.join(folderPath, 'model.json');
    if (!fs.existsSync(modelJsonPath)) {
      vscode.window.showWarningMessage('This folder does not contain a model.json file.');
      return;
    }

    if (!await isGitRepository(folderPath)) {
      vscode.window.showWarningMessage('This folder is not in a git repository.');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Loading model history...',
        cancellable: false,
      },
      async () => {
        const commits = await getCommitsForFolder(folderPath);

        if (commits.length === 0) {
          vscode.window.showInformationMessage('No commits found for this model.');
          return;
        }

        const rawModel = loadSemanticModelFiles(folderPath);
        const depGraph = buildDependencyGraph(rawModel);
        const modelUI = buildSemanticModelUI(rawModel, depGraph);

        modelUI.isHistoryMode = true;
        modelUI.commits = commits.map(c => ({
          hash: c.hash,
          shortHash: c.shortHash,
          author: c.author,
          date: c.date instanceof Date ? c.date.toISOString() : String(c.date),
          message: c.message,
          filesChanged: c.filesChanged,
        }));

        showHistoryPanel(context, folderPath, modelUI);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to load model history: ${message}`);
  }
}

function showHistoryPanel(
  context: vscode.ExtensionContext,
  folderPath: string,
  modelUI: SemanticModelUI
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
    context, 'semanticModelHistoryV2', `History: ${modelUI.model.label}`, vscode.ViewColumn.One,
    { retainContextWhenHidden: true }
  );

  panel.webview.html = getERDV2WebviewContent(modelUI, icons, resources.sldsUri, null, 'flat', resources.cspSource);

  const outputChannel = vscode.window.createOutputChannel('Semantic Layer History');
  const positionStorage = new FilePositionStorage(folderPath);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === 'loadCommit') {
        try {
          let raw;
          if (message.commitHash === 'CURRENT') {
            raw = loadSemanticModelFiles(folderPath);
          } else {
            raw = await loadRawModelFromCommit(folderPath, message.commitHash);
          }
          const depGraph = buildDependencyGraph(raw);
          const newUI = buildSemanticModelUI(raw, depGraph);

          panel.webview.postMessage({
            command: 'commitLoaded',
            commitHash: message.commitHash,
            modelUI: serializeModelUI(newUI),
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to load commit: ${errorMessage}`);
        }
      } else if (message.command === 'compareCommits') {
        try {
          let baseRaw, selectedRaw;
          if (message.baseCommitHash === 'CURRENT') {
            baseRaw = loadSemanticModelFiles(folderPath);
          } else {
            baseRaw = await loadRawModelFromCommit(folderPath, message.baseCommitHash);
          }
          if (message.selectedCommitHash === 'CURRENT') {
            selectedRaw = loadSemanticModelFiles(folderPath);
          } else {
            selectedRaw = await loadRawModelFromCommit(folderPath, message.selectedCommitHash);
          }

          const mergedRaw = mergeForCompare(selectedRaw, baseRaw);
          const depGraph = buildDependencyGraph(mergedRaw);
          const mergedUI = buildSemanticModelUI(mergedRaw, depGraph);
          mergedUI.isCompareMode = true;

          panel.webview.postMessage({
            command: 'compareLoaded',
            baseCommitHash: message.baseCommitHash,
            selectedCommitHash: message.selectedCommitHash,
            modelUI: serializeModelUI(mergedUI),
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to compare commits: ${errorMessage}`);
        }
      } else if (message.command === 'runSemanticQuery') {
        try {
          if (!message.fields || message.fields.length === 0) {
            throw new Error('No fields to query.');
          }

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

          const fieldLabels: { [key: string]: string } = {};
          const queryFields = message.fields.map((f: { apiName: string; label: string; tableApiName: string }) => {
            const alias = `${f.tableApiName}.${f.apiName}`;
            fieldLabels[alias] = f.label;
            return {
              expression: { tableField: { name: f.apiName, tableName: f.tableApiName } },
              alias,
            };
          });

          const payload = {
            dataspace: modelUI.model.dataspace || 'default',
            source: 'vscode-extension',
            structuredSemanticQuery: {
              fields: queryFields,
              options: { limitOptions: { limit: 100 }, sortOrders: [], detailedRows: true },
            },
            semanticModelId: modelUI.model.id,
          };

          outputChannel.appendLine(`Query: ${JSON.stringify(payload, null, 2)}`);
          const result = await postSalesforceApi(instanceUrl, accessToken, `/services/data/${SF_API_VERSION}/semantic-engine/gateway`, payload);

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

function serializeModelUI(ui: SemanticModelUI): Record<string, unknown> {
  return {
    model: ui.model,
    dataObjects: ui.dataObjects,
    logicalViews: ui.logicalViews,
    relationships: ui.relationships,
    crossObjectEntities: ui.crossObjectEntities,
    orphanEntities: ui.orphanEntities,
    parameters: ui.parameters,
    modelInfo: ui.modelInfo,
    isCompareMode: ui.isCompareMode ?? false,
    allCalculatedDimensions: ui.allCalculatedDimensions,
    allCalculatedMeasurements: ui.allCalculatedMeasurements,
    allDimensionHierarchies: ui.allDimensionHierarchies,
    allMetrics: ui.allMetrics,
    allGroupings: ui.allGroupings,
  };
}