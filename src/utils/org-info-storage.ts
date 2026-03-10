/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Config, OrgConfigProperties } from '@salesforce/core';

export interface StoredOrgInfo {
  orgId: string;
  instanceUrl: string;
  username: string;
  alias?: string;
  retrievedAt: string;
}

const ORG_INFO_FILE = 'orgInfo.json';
const METADATA_DIR = 'metadata';

export function saveOrgInfo(modelFolderPath: string, orgResult: { id: string; instanceUrl: string; username: string; alias?: string }): void {
  const metadataDir = path.join(modelFolderPath, METADATA_DIR);
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  const info: StoredOrgInfo = {
    orgId: orgResult.id,
    instanceUrl: orgResult.instanceUrl,
    username: orgResult.username,
    alias: orgResult.alias,
    retrievedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(metadataDir, ORG_INFO_FILE), JSON.stringify(info, null, 2), 'utf8');
}

export function loadOrgInfo(modelFolderPath: string): StoredOrgInfo | null {
  const filePath = path.join(modelFolderPath, METADATA_DIR, ORG_INFO_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as StoredOrgInfo;
    }
  } catch {
    // Corrupted file — treat as missing
  }
  return null;
}

/**
 * Checks if the currently connected org matches the org this model was retrieved from.
 * Returns 'proceed' if the operation should continue (same org, user chose continue, or switch succeeded),
 * or 'cancel' if the user cancelled.
 * When the user switches org, returns 'switched' so the caller can re-fetch credentials.
 */
export async function checkOrgMatch(
  modelFolderPath: string,
  currentOrg: { id: string; instanceUrl: string; username: string }
): Promise<'proceed' | 'switched' | 'cancel'> {
  const stored = loadOrgInfo(modelFolderPath);
  if (!stored) {
    return 'proceed';
  }

  if (stored.orgId === currentOrg.id) {
    return 'proceed';
  }

  const switchLabel = `Switch to "${stored.alias || stored.username}"`;

  const answer = await vscode.window.showWarningMessage(
    `Org mismatch! This model was retrieved from "${stored.username}" (${stored.instanceUrl}), ` +
    `but you are currently connected to "${currentOrg.username}" (${currentOrg.instanceUrl}).`,
    { modal: true },
    switchLabel,
    'Continue Anyway',
    'Cancel'
  );

  if (answer === switchLabel) {
    try {
      const targetOrg = stored.alias || stored.username;
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Switching to org "${targetOrg}"...` },
        async () => {
          await Config.update(false, OrgConfigProperties.TARGET_ORG, targetOrg);
        }
      );
      vscode.window.showInformationMessage(`Switched default org to "${targetOrg}".`);
      return 'switched';
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(
        `Failed to switch org: ${msg}. You may need to re-authenticate with "SFDX: Authorize an Org".`
      );
      return 'cancel';
    }
  }

  if (answer === 'Continue Anyway') {
    return 'proceed';
  }

  return 'cancel';
}