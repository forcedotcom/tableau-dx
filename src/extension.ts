/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  showOrgInfoCommand,
  listModelsCommand,
  exportToFolderCommand,
  updateModelCommand,
  visualizeCompareERDCommand,
  visualizeModelHistoryCommand,
  visualizeLocalERDV2Command,
  // TODO: Re-enable grouped ERD commands when grouping feature is ready
  // visualizeGroupedERDCommand,
  // visualizeListGroupedERDCommand,
  testModelCommand,
  autoGenerateGroupsCommand
} from './commands';
import { clearPositionCacheCommand, showPositionCacheStatsCommand } from './commands/clear-position-cache';
import {
  initTelemetry,
  sendActivationEvent,
  sendDeactivationEvent,
  sendCommandEvent,
  sendException,
  disposeTelemetry,
} from './telemetry';
import { McpServerManager } from './mcp/manager';

let mcpManager: McpServerManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
  const activationStart = performance.now();
  console.log('Salesforce Semantic Layer extension is now active!');

  const currentVersion: string = context.extension.packageJSON.version ?? '0.0.0';
  const welcomeKey = `semanticLayer.welcomed_${currentVersion}`;

  if (!context.globalState.get<boolean>(welcomeKey)) {
    context.globalState.update(welcomeKey, true);
    const readmePath = path.join(context.extensionPath, 'README.md');
    const readmeUri = vscode.Uri.file(readmePath);
    vscode.commands.executeCommand('markdown.showPreview', readmeUri).then(undefined, () => {
      vscode.commands.executeCommand('vscode.open', readmeUri);
    });
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    const semanticModelsFolder = path.join(workspaceRoot, 'Semantic Models');
    if (!fs.existsSync(semanticModelsFolder)) {
      fs.mkdirSync(semanticModelsFolder, { recursive: true });
    }
  }

  await initTelemetry(context);
  sendActivationEvent(activationStart);

  mcpManager = new McpServerManager(context);
  context.subscriptions.push(mcpManager);
  mcpManager.start().catch((err) => {
    console.error('MCP server registration failed:', err);
  });

  function trackedCommand(
    commandId: string,
    handler: (...args: unknown[]) => Promise<void>
  ): vscode.Disposable {
    return vscode.commands.registerCommand(commandId, async (...args: unknown[]) => {
      const cmdStart = performance.now();
      try {
        await handler(...args);
        sendCommandEvent(commandId, cmdStart);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        sendException(commandId, msg);
        throw e;
      }
    });
  }

  const restartMcpDisposable = trackedCommand(
    'semanticLayer.restartMcp',
    async () => {
      await mcpManager?.restart();
      vscode.window.showInformationMessage('Tableau Next MCP server config updated.');
    }
  );

  const showOrgInfoDisposable = trackedCommand(
    'semanticLayer.showOrgInfo',
    async () => { await showOrgInfoCommand(context); }
  );

  const listModelsDisposable = trackedCommand(
    'semanticLayer.listModels',
    async () => { await listModelsCommand(context); }
  );

  const exportToFolderDisposable = trackedCommand(
    'semanticLayer.exportToFolder',
    async (...args: unknown[]) => { await exportToFolderCommand(args[0] as vscode.Uri); }
  );

  const updateModelDisposable = trackedCommand(
    'semanticLayer.updateModel',
    async (...args: unknown[]) => { await updateModelCommand(args[0] as vscode.Uri); }
  );

  const visualizeCompareERDDisposable = trackedCommand(
    'semanticLayer.visualizeCompareERD',
    async (...args: unknown[]) => { await visualizeCompareERDCommand(context, args[0] as vscode.Uri); }
  );

  const visualizeModelHistoryDisposable = trackedCommand(
    'semanticLayer.viewModelHistory',
    async (...args: unknown[]) => { await visualizeModelHistoryCommand(context, args[0] as vscode.Uri); }
  );

  const visualizeLocalERDV2Disposable = trackedCommand(
    'semanticLayer.visualizeLocalERDV2',
    async (...args: unknown[]) => { await visualizeLocalERDV2Command(context, args[0] as vscode.Uri); }
  );

  const testModelDisposable = trackedCommand(
    'semanticLayer.testModel',
    async (...args: unknown[]) => { await testModelCommand(context, args[0] as vscode.Uri); }
  );

  const clearPositionCacheDisposable = trackedCommand(
    'semanticLayer.clearPositionCache',
    async () => { await clearPositionCacheCommand(); }
  );

  const showPositionCacheStatsDisposable = trackedCommand(
    'semanticLayer.showPositionCacheStats',
    async () => { await showPositionCacheStatsCommand(); }
  );

  const autoGenerateGroupsDisposable = trackedCommand(
    'semanticLayer.autoGenerateGroups',
    async (...args: unknown[]) => { await autoGenerateGroupsCommand(args[0] as vscode.Uri); }
  );

  // TODO: Re-enable grouped ERD commands when grouping feature is ready
  // const visualizeGroupedERDDisposable = vscode.commands.registerCommand(
  //   'semanticLayer.visualizeGroupedERD',
  //   async (uri: vscode.Uri) => {
  //     await visualizeGroupedERDCommand(context, uri);
  //   }
  // );
  //
  // const visualizeListGroupedERDDisposable = vscode.commands.registerCommand(
  //   'semanticLayer.visualizeListGroupedERD',
  //   async (uri: vscode.Uri) => {
  //     await visualizeListGroupedERDCommand(context, uri);
  //   }
  // );

  context.subscriptions.push(
    restartMcpDisposable,
    showOrgInfoDisposable,
    listModelsDisposable,
    exportToFolderDisposable,
    updateModelDisposable,
    visualizeCompareERDDisposable,
    visualizeModelHistoryDisposable,
    visualizeLocalERDV2Disposable,
    testModelDisposable,
    clearPositionCacheDisposable,
    showPositionCacheStatsDisposable,
    autoGenerateGroupsDisposable
  );
}

export function deactivate() {
  if (mcpManager) {
    mcpManager.dispose();
    mcpManager = null;
  }
  sendDeactivationEvent();
  disposeTelemetry();
}
