/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import { getOrgInfo, callSalesforceApi, SF_API_VERSION } from '../api';
import { SemanticModelsResponse } from '../types';
import { getModelsWebviewContent } from '../webviews/models-list';
import { createWebviewPanel } from '../utils/webview-utils';

export async function listModelsCommand(context: vscode.ExtensionContext) {
  try {
    const config = vscode.workspace.getConfiguration('semanticLayer');
    const defaultFilter = config.get<string>('defaultModelFilter', '');
    
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: defaultFilter ? `Fetching Semantic Models (filtered: ${defaultFilter})...` : 'Fetching Semantic Models...',
        cancellable: false,
      },
      async () => {
        const orgInfo = await getOrgInfo();
        
        const queryParams: Record<string, string> = {};
        if (defaultFilter && defaultFilter.trim() !== '') {
          queryParams.searchTerm = defaultFilter.trim();
        }
        
        const modelsResponse = await callSalesforceApi(
          orgInfo.result.instanceUrl,
          orgInfo.result.accessToken,
          `/services/data/${SF_API_VERSION}/ssot/semantic/models`,
          queryParams
        ) as SemanticModelsResponse;

        const { panel, resources } = createWebviewPanel(
          context, 'semanticModels',
          defaultFilter ? `Semantic Models (filtered: ${defaultFilter})` : 'Semantic Models',
          vscode.ViewColumn.One
        );
        panel.webview.html = getModelsWebviewContent(orgInfo, modelsResponse, defaultFilter || undefined, resources.sldsUri, resources.cspSource);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to list semantic models: ${message}`);
  }
}