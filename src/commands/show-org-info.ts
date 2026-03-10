/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import { getOrgInfo, callSalesforceApi } from '../api';
import { getOrgInfoWebviewContent } from '../webviews/org-info';
import { createWebviewPanel } from '../utils/webview-utils';

export async function showOrgInfoCommand(context: vscode.ExtensionContext) {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching Salesforce Org Info...',
        cancellable: false,
      },
      async () => {
        const orgInfo = await getOrgInfo();
        const apiResult = await callSalesforceApi(
          orgInfo.result.instanceUrl,
          orgInfo.result.accessToken,
          '/services/data/v59.0/limits'
        );

        const { panel, resources } = createWebviewPanel(
          context, 'orgInfo', 'Salesforce Org Info', vscode.ViewColumn.One
        );
        panel.webview.html = getOrgInfoWebviewContent(orgInfo, apiResult, resources.sldsUri);
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to get org info: ${message}`);
  }
}