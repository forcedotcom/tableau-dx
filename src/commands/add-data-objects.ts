/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOrgInfo } from '../api';
import { fetchDCDataObjectsPage } from '../api/dc-data-objects';
import { checkOrgMatch } from '../utils/org-info-storage';
import { createWebviewPanel } from '../utils/webview-utils';
import { getDataObjectsPickerContent } from '../webviews/data-objects-picker';
import { convertSelectedToDataObject, SelectedObjectInfo } from '../utils/dc-conversion';

export async function addDataObjectsCommand(context: vscode.ExtensionContext, uri: vscode.Uri) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click on a dataObjects.json file.');
      return;
    }

    const filePath = uri.fsPath;
    const baseName = path.basename(filePath);
    if (baseName !== 'dataObjects.json' && baseName !== 'model.json') {
      vscode.window.showWarningMessage('Please select a dataObjects.json file.');
      return;
    }

    const folderPath = path.dirname(filePath);

    const modelJsonPath = path.join(folderPath, 'model.json');
    if (!fs.existsSync(modelJsonPath)) {
      vscode.window.showErrorMessage('model.json not found in the same folder. Cannot determine dataspace.');
      return;
    }

    const modelContent = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
    const modelApiName = modelContent.apiName as string;
    const dataspace = (modelContent.dataspace as string) || 'default';

    const dataObjectsFile = path.join(folderPath, 'dataObjects.json');
    let existingObjectNames: string[] = [];
    if (fs.existsSync(dataObjectsFile)) {
      const existing = JSON.parse(fs.readFileSync(dataObjectsFile, 'utf8'));
      existingObjectNames = (existing.items ?? []).map((o: Record<string, unknown>) => o.dataObjectName ?? o.apiName);
    }

    const { panel, resources } = createWebviewPanel(
      context, 'dataObjectsPicker', `Add Data Objects: ${modelApiName}`, vscode.ViewColumn.One,
      { retainContextWhenHidden: true }
    );
    panel.webview.html = getDataObjectsPickerContent(resources.sldsUri, resources.cspSource);

    let orgInfo: Awaited<ReturnType<typeof getOrgInfo>> | null = null;
    let currentSearch = '';
    const allTabs: Array<'Dmo' | 'Dlo' | 'Cio'> = ['Dmo', 'Dlo', 'Cio'];
    const fetchedTabs = new Set<string>();

    async function ensureOrgInfo(): Promise<boolean> {
      if (!orgInfo) {
        orgInfo = await getOrgInfo();
        const orgCheckResult = await checkOrgMatch(folderPath, orgInfo.result);
        if (orgCheckResult === 'cancel') { panel.dispose(); return false; }
        if (orgCheckResult === 'switched') { orgInfo = await getOrgInfo(); }
      }
      return true;
    }

    let currentGeneration: number | undefined;

    async function fetchTabPage(tab: 'Dmo' | 'Dlo' | 'Cio', offset = 0, gen?: number): Promise<void> {
      try {
        if (!(await ensureOrgInfo())) return;
        const page = await fetchDCDataObjectsPage(
          orgInfo!.result.instanceUrl, orgInfo!.result.accessToken,
          dataspace, tab, offset,
          undefined, currentSearch || undefined
        );
        if (offset === 0) {
          panel.webview.postMessage({ command: 'tabDataLoaded', tab, dcObjects: page.items, hasMore: page.hasMore, generation: gen });
        } else {
          panel.webview.postMessage({ command: 'tabDataAppended', tab, dcObjects: page.items, hasMore: page.hasMore, generation: gen });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        panel.webview.postMessage({ command: 'tabDataError', tab, error: msg, generation: gen });
        vscode.window.showErrorMessage(`Failed to fetch ${tab} objects: ${msg}`);
      }
    }

    async function fetchTab(tab: 'Dmo' | 'Dlo' | 'Cio'): Promise<void> {
      if (fetchedTabs.has(tab)) return;
      fetchedTabs.add(tab);
      await fetchTabPage(tab, 0, currentGeneration);
    }

    async function prefetchRemainingTabs(completedTab: string): Promise<void> {
      const remaining = allTabs.filter(t => t !== completedTab && !fetchedTabs.has(t));
      for (const t of remaining) { await fetchTab(t); }
    }

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === 'cancel') {
          panel.dispose();

        } else if (message.command === 'searchChanged') {
          currentSearch = (message.search as string) || '';
          currentGeneration = undefined;
          fetchedTabs.clear();

        } else if (message.command === 'requestTabData') {
          const tab = message.tab as 'Dmo' | 'Dlo' | 'Cio';
          currentGeneration = message.generation as number | undefined;
          await fetchTab(tab);
          prefetchRemainingTabs(tab);

        } else if (message.command === 'requestMoreTabData') {
          const tab = message.tab as 'Dmo' | 'Dlo' | 'Cio';
          const offset = (message.offset as number) || 0;
          const gen = message.generation as number | undefined;
          await fetchTabPage(tab, offset, gen);

        } else if (message.command === 'confirm') {
          const selected = message.selectedObjects as SelectedObjectInfo[];
          if (selected.length === 0) return;

          try {
            const newDataObjects = selected.map(convertSelectedToDataObject);

            const existing = fs.existsSync(dataObjectsFile)
              ? JSON.parse(fs.readFileSync(dataObjectsFile, 'utf8'))
              : { items: [] };
            existing.items.push(...newDataObjects);
            fs.writeFileSync(dataObjectsFile, JSON.stringify(existing, null, 2), 'utf8');

            panel.dispose();

            const modelJsonUri = vscode.Uri.file(path.join(folderPath, 'model.json'));
            const action = await vscode.window.showInformationMessage(
              `Added ${selected.length} data object${selected.length > 1 ? 's' : ''} to "${modelApiName}"`,
              'Visualize ERD',
              'Deploy Model'
            );

            if (action === 'Visualize ERD') {
              vscode.commands.executeCommand('semanticLayer.visualizeLocalERDV2', modelJsonUri);
            } else if (action === 'Deploy Model') {
              vscode.commands.executeCommand('semanticLayer.updateModel', modelJsonUri);
            }
          } catch (confirmError) {
            panel.dispose();
            const msg = confirmError instanceof Error ? confirmError.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to add data objects: ${msg}`);
          }
        }
      },
      undefined,
      context.subscriptions
    );

    // Tell the webview it's ready — it will request tab data as needed
    setTimeout(() => {
      panel.webview.postMessage({
        command: 'ready',
        mode: 'add',
        existingObjectNames,
      });
    }, 200);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to add data objects: ${message}`);
  }
}
