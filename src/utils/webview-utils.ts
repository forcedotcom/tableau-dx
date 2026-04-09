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
  cspSource: string;
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

  const cspSource = panel.webview.cspSource;

  return { panel, resources: { sldsUri, cspSource } };
}

/**
 * Returns the standard HTML head with SLDS CSS linked, CSP meta tag, and optional custom styles.
 */
export function sldsHead(sldsUri: string, customStyles?: string, cspSource?: string): string {
  const csp = cspSource
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'unsafe-inline'; font-src ${cspSource}; img-src ${cspSource} data:;" />`
    : '';
  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${csp}
  <link rel="stylesheet" href="${sldsUri}" />
  ${customStyles ? `<style>${customStyles}</style>` : ''}`;
}