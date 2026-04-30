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
import { fetchDCDataObjectsPage, fetchDataSpaces, createSemanticModel } from '../api/dc-data-objects';
import { createWebviewPanel } from '../utils/webview-utils';
import { getDataObjectsPickerContent } from '../webviews/data-objects-picker';
import { buildCreateModelPayload, SelectedObjectInfo } from '../utils/dc-conversion';
import { resolveModelFolder, resolveSemanticModelsFolder } from '../utils/model-folder';
import { writeModelFiles } from '../utils/write-model-files';

export async function createModelCommand(context: vscode.ExtensionContext, uri?: vscode.Uri) {
  try {
    const { panel, resources } = createWebviewPanel(
      context, 'dataObjectsPicker', 'Create New Semantic Model', vscode.ViewColumn.One,
      { retainContextWhenHidden: true }
    );
    panel.webview.html = getDataObjectsPickerContent(resources.sldsUri, resources.cspSource);

    let orgInfo: Awaited<ReturnType<typeof getOrgInfo>> | null = null;
    let currentDataspace = 'default';
    let currentSearch = '';
    const allTabs: Array<'Dmo' | 'Dlo' | 'Cio'> = ['Dmo', 'Dlo', 'Cio'];
    const fetchedTabs = new Set<string>();

    async function fetchTabPage(tab: 'Dmo' | 'Dlo' | 'Cio', offset = 0, gen?: number): Promise<void> {
      try {
        if (!orgInfo) { orgInfo = await getOrgInfo(); }
        const page = await fetchDCDataObjectsPage(
          orgInfo.result.instanceUrl, orgInfo.result.accessToken,
          currentDataspace, tab, offset,
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

    let currentGeneration: number | undefined;

    async function fetchTab(tab: 'Dmo' | 'Dlo' | 'Cio'): Promise<void> {
      if (fetchedTabs.has(tab)) return;
      fetchedTabs.add(tab);
      await fetchTabPage(tab, 0, currentGeneration);
    }

    function prefetchRemainingTabs(completedTab: string): void {
      const remaining = allTabs.filter(t => t !== completedTab && !fetchedTabs.has(t));
      for (const t of remaining) { fetchTab(t); }
    }

    async function loadDataSpaces(retries = 2): Promise<void> {
      try {
        if (!orgInfo) { orgInfo = await getOrgInfo(); }
        const dataspaces = await fetchDataSpaces(
          orgInfo.result.instanceUrl, orgInfo.result.accessToken
        );
        panel.webview.postMessage({
          command: 'dataspaceListLoaded',
          dataspaces: dataspaces.map(ds => ({ name: ds.name, label: ds.label })),
        });
      } catch (err) {
        if (retries > 0) {
          orgInfo = null;
          await new Promise(r => setTimeout(r, 1500));
          return loadDataSpaces(retries - 1);
        }
        const msg = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to fetch dataspaces: ${msg}`);
      }
    }

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === 'cancel') {
          panel.dispose();

        } else if (message.command === 'dataspaceChanged') {
          currentDataspace = (message.dataspace as string) || 'default';
          currentSearch = '';
          currentGeneration = undefined;
          fetchedTabs.clear();

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

          const metadata = message.metadata as { label: string; apiName: string; dataspace: string };
          if (!metadata?.label || !metadata?.apiName || !metadata?.dataspace) {
            vscode.window.showErrorMessage('Please fill in all model metadata fields.');
            return;
          }

          panel.dispose();

          try {
            const result = await vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: 'Creating model on server...', cancellable: false },
              async () => {
                if (!orgInfo) { orgInfo = await getOrgInfo(); }
                const payload = buildCreateModelPayload(metadata.apiName, metadata.label, metadata.dataspace, selected);
                const created = await createSemanticModel(
                  orgInfo!.result.instanceUrl, orgInfo!.result.accessToken, payload
                );
                return { created, orgResult: orgInfo!.result };
              }
            );

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
              vscode.window.showErrorMessage('No workspace folder open.');
              return;
            }

            const semanticModelsDir = path.join(workspaceRoot, 'Semantic Models');
            if (!fs.existsSync(semanticModelsDir)) {
              fs.mkdirSync(semanticModelsDir, { recursive: true });
            }

            const modelFolder = resolveModelFolder(
              resolveSemanticModelsFolder(uri?.fsPath ?? semanticModelsDir),
              metadata.label, metadata.apiName
            );

            if (!fs.existsSync(modelFolder)) {
              fs.mkdirSync(modelFolder, { recursive: true });
            }

            writeModelFiles(modelFolder, result.created, result.orgResult);

            const modelJsonUri = vscode.Uri.file(path.join(modelFolder, 'model.json'));

            const action = await vscode.window.showInformationMessage(
              `Model "${metadata.label}" created successfully and exported locally.`,
              'Visualize ERD',
              'Open model.json'
            );

            if (action === 'Visualize ERD') {
              vscode.commands.executeCommand('semanticLayer.visualizeLocalERDV2', modelJsonUri);
            } else if (action === 'Open model.json') {
              const doc = await vscode.workspace.openTextDocument(modelJsonUri);
              vscode.window.showTextDocument(doc);
            }
          } catch (createError) {
            const msg = createError instanceof Error ? createError.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to create model: ${msg}`);
          }
        }
      },
      undefined,
      context.subscriptions
    );

    // Tell the webview it's ready, then load dataspaces from the server
    setTimeout(() => {
      panel.webview.postMessage({
        command: 'ready',
        mode: 'create',
        existingObjectNames: [],
      });
      loadDataSpaces();
    }, 200);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to create model: ${message}`);
  }
}
