/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FilePositionStorage } from '../utils/position-storage';

/**
 * Command to clear the ERD node position cache (file-based).
 * Deletes metadata/positions.json from a selected model folder.
 */
export async function clearPositionCacheCommand() {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: 'Select Model Folder'
  });

  if (!uris || uris.length === 0) { return; }

  const folderPath = uris[0].fsPath;
  const positionsFile = path.join(folderPath, 'metadata', 'positions.json');

  if (!fs.existsSync(positionsFile)) {
    vscode.window.showInformationMessage('No positions file found in this folder.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Delete positions cache for "${path.basename(folderPath)}"?`,
    'Yes',
    'No'
  );

  if (confirm === 'Yes') {
    const storage = new FilePositionStorage(folderPath);
    storage.clearPositions();
    vscode.window.showInformationMessage('Cleared position cache.');
  }
}

/**
 * Command to show position cache statistics for a model folder.
 */
export async function showPositionCacheStatsCommand() {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: 'Select Model Folder'
  });

  if (!uris || uris.length === 0) { return; }

  const folderPath = uris[0].fsPath;
  const storage = new FilePositionStorage(folderPath);
  const topLevel = storage.getPositions('topLevel');
  const topCount = Object.keys(topLevel).length;

  const positionsFile = path.join(folderPath, 'metadata', 'positions.json');
  let drilldownCount = 0;
  if (fs.existsSync(positionsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(positionsFile, 'utf-8'));
      drilldownCount = Object.keys(data.drilldown || {}).length;
    } catch { /* ignore */ }
  }

  vscode.window.showInformationMessage(
    `Position Cache: ${topCount} top-level nodes, ${drilldownCount} drill-down views`
  );
}