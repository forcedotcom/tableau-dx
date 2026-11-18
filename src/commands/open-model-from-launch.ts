/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOrgInfo, callSalesforceApi, SF_API_VERSION } from '../api';
import { resolveModelFolder } from '../utils/model-folder';
import { writeModelFiles } from '../utils/write-model-files';
import { sendCommandEvent, sendException } from '../telemetry';

/**
 * Set by Agentforce Vibes when launched from Semantic Model Builder, via the launch URL's
 * base64 `instanceEnvironmentContext` param, e.g. {"TABLEAU_MODEL_ID":"Account_SDM"}.
 */
export const LAUNCH_MODEL_ENV_KEY = 'TABLEAU_MODEL_ID';

const EVENT_NAME = 'semanticLayer.openModelFromLaunch';
const SEMANTIC_MODELS_FOLDER = 'Semantic Models';

/**
 * If the workspace was launched with a model API name, pull that model from the org into
 * "Semantic Models/<label>" and open its ERD. The env var persists for the life of the
 * workspace (including window reloads), so an existing local copy is never overwritten
 * silently: it is opened as-is and the user can choose to refresh it from the org.
 */
export async function openModelFromLaunchContext(context: vscode.ExtensionContext): Promise<void> {
  const apiName = process.env[LAUNCH_MODEL_ENV_KEY]?.trim();
  if (!apiName) {
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }

  const startTime = performance.now();
  try {
    const semanticModelsFolder = path.join(workspaceRoot, SEMANTIC_MODELS_FOLDER);
    const existingFolder = findLocalModelFolder(semanticModelsFolder, apiName);

    if (existingFolder) {
      await openModel(context, existingFolder);
      const action = await vscode.window.showInformationMessage(
        `Opened local copy of "${apiName}". Refresh it from the org? Local changes will be replaced.`,
        'Refresh from Org'
      );
      if (action === 'Refresh from Org') {
        await openModel(context, await pullModel(semanticModelsFolder, apiName));
      }
    } else {
      await openModel(context, await pullModel(semanticModelsFolder, apiName));
    }
    sendCommandEvent(EVENT_NAME, startTime);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendException(EVENT_NAME, message);
    vscode.window.showErrorMessage(`Failed to open semantic model "${apiName}": ${message}`);
  }
}

async function pullModel(semanticModelsFolder: string, apiName: string): Promise<string> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Loading semantic model ${apiName}...`,
      cancellable: false,
    },
    async () => {
      const orgInfo = await getOrgInfo();
      const { instanceUrl, accessToken } = orgInfo.result;

      const fullModel = await callSalesforceApi(
        instanceUrl,
        accessToken,
        `/services/data/${SF_API_VERSION}/ssot/semantic/models/${encodeURIComponent(apiName)}`,
        { allowUnmapped: 'true' }
      ) as Record<string, unknown>;

      const label = typeof fullModel.label === 'string' ? fullModel.label : apiName;
      const modelFolderPath = resolveModelFolder(semanticModelsFolder, label, apiName);
      writeModelFiles(modelFolderPath, fullModel, orgInfo.result);
      return modelFolderPath;
    }
  );
}

async function openModel(context: vscode.ExtensionContext, modelFolderPath: string): Promise<void> {
  const modelJsonUri = vscode.Uri.file(path.join(modelFolderPath, 'model.json'));
  await vscode.commands.executeCommand('revealInExplorer', modelJsonUri);
  await vscode.commands.executeCommand('semanticLayer.visualizeLocalERDV2', modelJsonUri);
}

/** Returns the folder under "Semantic Models" whose model.json has the given apiName, if any. */
function findLocalModelFolder(semanticModelsFolder: string, apiName: string): string | undefined {
  if (!fs.existsSync(semanticModelsFolder)) {
    return undefined;
  }
  for (const entry of fs.readdirSync(semanticModelsFolder, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const modelJsonPath = path.join(semanticModelsFolder, entry.name, 'model.json');
    try {
      const model = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8')) as { apiName?: string };
      if (model.apiName === apiName) {
        return path.join(semanticModelsFolder, entry.name);
      }
    } catch {
      // No model.json or unreadable — not a model folder.
    }
  }
  return undefined;
}
