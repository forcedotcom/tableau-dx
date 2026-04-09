/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildModelRepresentation, SemanticModelUI, loadSemanticModelFiles } from '../v2';
import { getERDV2WebviewContent } from '../webviews/erd-v2';
import { getOrgInfo, postSalesforceApi, SF_API_VERSION } from '../api';
import { checkOrgMatch } from '../utils/org-info-storage';
import { FilePositionStorage } from '../utils/position-storage';
import { createWebviewPanel } from '../utils/webview-utils';
import { GroupsConfig } from '../utils/auto-group';

export type ViewMode = 'flat' | 'grouped' | 'listGrouped';

export async function visualizeLocalERDV2Command(context: vscode.ExtensionContext, uri: vscode.Uri) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click on a model.json file to visualize the ERD.');
      return;
    }
    const filePath = uri.fsPath;
    const folderPath = path.dirname(filePath);
    if (path.basename(filePath) !== 'model.json') {
      vscode.window.showWarningMessage('Please select a model.json file.');
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Building ERD...', cancellable: false },
      async () => {
        const modelUI = buildModelRepresentation(folderPath);
        showERDV2Panel(context, modelUI, folderPath, null, 'flat');
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to visualize ERD: ${message}`);
  }
}

export async function visualizeGroupedERDCommand(context: vscode.ExtensionContext, uri: vscode.Uri) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click on a model.json file.');
      return;
    }
    const filePath = uri.fsPath;
    const folderPath = path.dirname(filePath);
    if (path.basename(filePath) !== 'model.json') {
      vscode.window.showWarningMessage('Please select a model.json file.');
      return;
    }
    const groupsFile = path.join(folderPath, 'metadata', 'groups.json');
    if (!fs.existsSync(groupsFile)) {
      vscode.window.showWarningMessage('No groups.json found. Run "Auto-Generate Groups" first.');
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Building Grouped ERD...', cancellable: false },
      async () => {
        const modelUI = buildModelRepresentation(folderPath);
        let groupsConfig: GroupsConfig | null = null;
        try { groupsConfig = JSON.parse(fs.readFileSync(groupsFile, 'utf-8')); } catch { /* ignore */ }
        if (!groupsConfig) {
          vscode.window.showErrorMessage('Failed to parse groups.json.');
          return;
        }
        showERDV2Panel(context, modelUI, folderPath, groupsConfig, 'grouped');
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to visualize Grouped ERD: ${message}`);
  }
}

export async function visualizeListGroupedERDCommand(context: vscode.ExtensionContext, uri: vscode.Uri) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click on a model.json file.');
      return;
    }
    const filePath = uri.fsPath;
    const folderPath = path.dirname(filePath);
    if (path.basename(filePath) !== 'model.json') {
      vscode.window.showWarningMessage('Please select a model.json file.');
      return;
    }
    const groupsFile = path.join(folderPath, 'metadata', 'groups.json');
    if (!fs.existsSync(groupsFile)) {
      vscode.window.showWarningMessage('No groups.json found. Run "Auto-Generate Groups" first.');
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Building List Grouped ERD...', cancellable: false },
      async () => {
        const modelUI = buildModelRepresentation(folderPath);
        let groupsConfig: GroupsConfig | null = null;
        try { groupsConfig = JSON.parse(fs.readFileSync(groupsFile, 'utf-8')); } catch { /* ignore */ }
        if (!groupsConfig) {
          vscode.window.showErrorMessage('Failed to parse groups.json.');
          return;
        }
        showERDV2Panel(context, modelUI, folderPath, groupsConfig, 'listGrouped');
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to visualize List Grouped ERD: ${message}`);
  }
}

function showERDV2Panel(
  context: vscode.ExtensionContext,
  modelUI: SemanticModelUI,
  folderPath: string,
  groupsConfig: GroupsConfig | null,
  viewMode: ViewMode = 'flat'
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
    context, 'semanticERDV2', `ERD V2: ${modelUI.model.label}`, vscode.ViewColumn.One
  );

  panel.webview.html = getERDV2WebviewContent(modelUI, icons, resources.sldsUri, groupsConfig, viewMode, resources.cspSource);

  const rawModel = loadSemanticModelFiles(folderPath);

  const outputChannel = vscode.window.createOutputChannel('Semantic Layer ERD V2');
  const positionStorage = new FilePositionStorage(folderPath);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === 'runSemanticQuery') {
        try {
          outputChannel.appendLine('=== Semantic Query Request (V2) ===');
          outputChannel.appendLine(`Node: ${message.nodeLabel} (${message.nodeId})`);

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

          const fieldLabels: {[key: string]: string} = {};
          const queryFields = message.fields.map((f: {apiName: string; label: string; tableApiName: string}) => {
            const alias = `${f.tableApiName}.${f.apiName}`;
            fieldLabels[alias] = f.label;
            return {
              expression: {
                tableField: { name: f.apiName, tableName: f.tableApiName }
              },
              alias: alias
            };
          });

          let semanticModel: Record<string, unknown>;

          if (message.nodeType === 'logicalView') {
            const base: Record<string, unknown> = { ...(rawModel.model as unknown as Record<string, unknown>) };
            base.semanticDataObjects = rawModel.dataObjects;
            base.semanticLogicalViews = rawModel.logicalViews;
            base.semanticRelationships = [];
            base.semanticCalculatedDimensions = rawModel.calculatedDimensions;
            base.semanticCalculatedMeasurements = rawModel.calculatedMeasurements;
            base.semanticGroupings = rawModel.groupings;
            base.semanticParameters = rawModel.parameters;
            base.semanticDimensionHierarchies = rawModel.dimensionHierarchies;
            base.semanticMetrics = rawModel.metrics;
            base.fieldsOverrides = rawModel.fieldsOverrides;
            if (!base.isQueryable) { base.isQueryable = 'Queryable'; }
            if (!base.currency) { base.currency = { useOrgDefault: true }; }
            semanticModel = base;
          } else {
            const queriedDmo = rawModel.dataObjects.find(d => d.apiName === message.nodeId);
            if (!queriedDmo) {
              throw new Error(`Data object "${message.nodeId}" not found in local model.`);
            }
            semanticModel = {
              apiName: rawModel.model.apiName,
              semanticDataObjects: [queriedDmo],
              semanticGroupings: rawModel.groupings,
              semanticParameters: rawModel.parameters,
              semanticCalculatedDimensions: rawModel.calculatedDimensions,
              semanticCalculatedMeasurements: rawModel.calculatedMeasurements,
            };
          }

          const payload = {
            dataspace: modelUI.model.dataspace || 'default',
            source: 'vscode-extension',
            structuredSemanticQuery: {
              fields: queryFields,
              options: {
                limitOptions: { limit: 100 },
                sortOrders: [],
                detailedRows: true
              }
            },
            semanticModel
          };

          const result = await postSalesforceApi(
            instanceUrl, accessToken,
            `/services/data/${SF_API_VERSION}/semantic-engine/gateway`,
            payload
          );

          panel.webview.postMessage({
            command: 'queryResult',
            success: true,
            data: result,
            fieldLabels,
            nodeLabel: message.nodeLabel
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          panel.webview.postMessage({
            command: 'queryResult',
            success: false,
            error: errorMessage
          });
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