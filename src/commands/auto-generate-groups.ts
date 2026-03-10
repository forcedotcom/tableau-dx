import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { loadSemanticModelFiles } from '../v2/model-loader';
import { autoGroupEntities } from '../utils/auto-group';

export async function autoGenerateGroupsCommand(uri: vscode.Uri) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click on a model.json file to auto-generate groups.');
      return;
    }

    const filePath = uri.fsPath;
    const fileName = path.basename(filePath);

    if (fileName !== 'model.json') {
      vscode.window.showWarningMessage('Please select a model.json file.');
      return;
    }

    const folderPath = path.dirname(filePath);
    const groupsFile = path.join(folderPath, 'metadata', 'groups.json');

    if (fs.existsSync(groupsFile)) {
      const overwrite = await vscode.window.showWarningMessage(
        'groups.json already exists. Overwrite?',
        'Yes',
        'No'
      );
      if (overwrite !== 'Yes') {
        return;
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Auto-generating entity groups...',
        cancellable: false,
      },
      async () => {
        const rawModel = loadSemanticModelFiles(folderPath);

        const totalEntities = rawModel.dataObjects.length + rawModel.logicalViews.length;
        if (totalEntities === 0) {
          vscode.window.showWarningMessage('No data objects or logical views found in this model.');
          return;
        }

        const groupsConfig = autoGroupEntities(rawModel);

        const metadataDir = path.join(folderPath, 'metadata');
        if (!fs.existsSync(metadataDir)) {
          fs.mkdirSync(metadataDir, { recursive: true });
        }

        fs.writeFileSync(groupsFile, JSON.stringify(groupsConfig, null, 2), 'utf-8');

        const groupedCount = groupsConfig.groups.reduce((sum, g) => sum + g.objects.length, 0);
        const ungroupedCount = groupsConfig.ungrouped.length;
        const categoryCount = groupsConfig.groups.length;

        vscode.window.showInformationMessage(
          `Grouped ${groupedCount} entities into ${categoryCount} categories` +
          (ungroupedCount > 0 ? ` (${ungroupedCount} ungrouped)` : '') +
          '.'
        );

        const doc = await vscode.workspace.openTextDocument(groupsFile);
        await vscode.window.showTextDocument(doc);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to auto-generate groups: ${message}`);
  }
}
