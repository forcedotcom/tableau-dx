import * as vscode from 'vscode';
import * as path from 'path';
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

export function activate(context: vscode.ExtensionContext) {
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

  const showOrgInfoDisposable = vscode.commands.registerCommand(
    'semanticLayer.showOrgInfo',
    async () => {
      await showOrgInfoCommand(context);
    }
  );

  const listModelsDisposable = vscode.commands.registerCommand(
    'semanticLayer.listModels',
    async () => {
      await listModelsCommand(context);
    }
  );

  const exportToFolderDisposable = vscode.commands.registerCommand(
    'semanticLayer.exportToFolder',
    async (uri: vscode.Uri) => {
      await exportToFolderCommand(uri);
    }
  );

  const updateModelDisposable = vscode.commands.registerCommand(
    'semanticLayer.updateModel',
    async (uri: vscode.Uri) => {
      await updateModelCommand(uri);
    }
  );

  const visualizeCompareERDDisposable = vscode.commands.registerCommand(
    'semanticLayer.visualizeCompareERD',
    async (uri: vscode.Uri) => {
      await visualizeCompareERDCommand(context, uri);
    }
  );

  const visualizeModelHistoryDisposable = vscode.commands.registerCommand(
    'semanticLayer.viewModelHistory',
    async (uri: vscode.Uri) => {
      await visualizeModelHistoryCommand(context, uri);
    }
  );

  const visualizeLocalERDV2Disposable = vscode.commands.registerCommand(
    'semanticLayer.visualizeLocalERDV2',
    async (uri: vscode.Uri) => {
      await visualizeLocalERDV2Command(context, uri);
    }
  );

  const testModelDisposable = vscode.commands.registerCommand(
    'semanticLayer.testModel',
    async (uri: vscode.Uri) => {
      await testModelCommand(context, uri);
    }
  );

  const clearPositionCacheDisposable = vscode.commands.registerCommand(
    'semanticLayer.clearPositionCache',
    async () => {
      await clearPositionCacheCommand();
    }
  );

  const showPositionCacheStatsDisposable = vscode.commands.registerCommand(
    'semanticLayer.showPositionCacheStats',
    async () => {
      await showPositionCacheStatsCommand();
    }
  );

  const autoGenerateGroupsDisposable = vscode.commands.registerCommand(
    'semanticLayer.autoGenerateGroups',
    async (uri: vscode.Uri) => {
      await autoGenerateGroupsCommand(uri);
    }
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

export function deactivate() {}
