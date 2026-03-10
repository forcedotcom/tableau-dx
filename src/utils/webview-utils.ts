/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface WebviewResources {
  sldsUri: string;
}

/**
 * Creates a webview panel with SLDS resources configured.
 * Returns the panel and the resolved SLDS CSS URI for use in HTML templates.
 */
export function createWebviewPanel(
  context: vscode.ExtensionContext,
  viewType: string,
  title: string,
  column: vscode.ViewColumn,
  options?: { retainContextWhenHidden?: boolean }
): { panel: vscode.WebviewPanel; resources: WebviewResources } {
  const mediaDir = vscode.Uri.file(path.join(context.extensionPath, 'media'));

  const panel = vscode.window.createWebviewPanel(
    viewType,
    title,
    column,
    {
      enableScripts: true,
      localResourceRoots: [mediaDir],
      ...(options?.retainContextWhenHidden ? { retainContextWhenHidden: true } : {}),
    }
  );

  const sldsUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'media', 'slds', 'salesforce-lightning-design-system.min.css'))
  ).toString();

  return { panel, resources: { sldsUri } };
}

/**
 * Returns the standard HTML head with SLDS CSS linked and optional custom styles.
 */
export function sldsHead(sldsUri: string, customStyles?: string): string {
  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${sldsUri}" />
  ${customStyles ? `<style>${customStyles}</style>` : ''}`;
}