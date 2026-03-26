/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

interface SqlEditSession {
  logicalViewsPath: string;
  logicalViewApiName: string;
  logicalViewLabel: string;
  sqlFilePath: string;
}

const activeSessionsByFile = new Map<string, SqlEditSession>();

export class CustomSQLCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (path.basename(document.fileName) !== 'logicalViews.json') {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    const text = document.getText();

    let parsed: { items?: Array<Record<string, unknown>> };
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }

    const items = parsed.items ?? [];
    for (const item of items) {
      if (typeof item.customSQLV2 !== 'string') {
        continue;
      }

      const apiName = item.apiName as string;
      const label = (item.label as string) || apiName;
      const searchKey = `"customSQLV2"`;
      let searchFrom = 0;

      const apiNamePos = text.indexOf(`"apiName": "${apiName}"`, searchFrom);
      if (apiNamePos !== -1) {
        searchFrom = apiNamePos;
      }

      const keyPos = text.indexOf(searchKey, searchFrom);
      if (keyPos === -1) {
        continue;
      }

      const line = document.positionAt(keyPos).line;
      const range = new vscode.Range(line, 0, line, 0);

      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(edit) Edit Custom SQL — ${label}`,
          command: 'semanticLayer.editCustomSQL',
          arguments: [document.uri, apiName, label],
        })
      );
    }

    return lenses;
  }
}

function formatSQL(sql: string): string {
  const majorClauses = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING',
    'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT',
    'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'FULL JOIN',
    'CROSS JOIN', 'JOIN', 'WITH',
  ];

  let formatted = sql.replace(/\s+/g, ' ').trim();

  for (const clause of majorClauses) {
    const regex = new RegExp(`\\b(${clause})\\b`, 'gi');
    formatted = formatted.replace(regex, `\n${clause.toUpperCase()}`);
  }

  formatted = formatted.replace(/^\n/, '').trim();

  const lines = formatted.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { continue; }
    const upper = trimmed.toUpperCase();
    const isClause = majorClauses.some(c => upper.startsWith(c));
    result.push(isClause ? trimmed : '  ' + trimmed);
  }

  return result.join('\n');
}

function flattenSQL(sql: string): string {
  return sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function editCustomSQLCommand(
  sourceUri: vscode.Uri,
  logicalViewApiName: string,
  logicalViewLabel: string
): Promise<void> {
  const logicalViewsPath = sourceUri.fsPath;
  const content = fs.readFileSync(logicalViewsPath, 'utf8');
  const parsed = JSON.parse(content);
  const items: Array<Record<string, unknown>> = parsed.items ?? [];

  const view = items.find((v) => v.apiName === logicalViewApiName);
  if (!view || typeof view.customSQLV2 !== 'string') {
    vscode.window.showWarningMessage(`No customSQLV2 found for "${logicalViewApiName}".`);
    return;
  }

  const existing = Array.from(activeSessionsByFile.values()).find(
    s => s.logicalViewsPath === logicalViewsPath && s.logicalViewApiName === logicalViewApiName
  );
  if (existing) {
    const doc = await vscode.workspace.openTextDocument(existing.sqlFilePath);
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
    return;
  }

  const formattedSql = formatSQL(view.customSQLV2);

  const tmpDir = path.join(os.tmpdir(), 'tableau-dx-sql');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const sqlFilePath = path.join(tmpDir, `${logicalViewApiName}.sql`);
  fs.writeFileSync(sqlFilePath, formattedSql, 'utf8');

  activeSessionsByFile.set(sqlFilePath, {
    logicalViewsPath,
    logicalViewApiName,
    logicalViewLabel,
    sqlFilePath,
  });

  const doc = await vscode.workspace.openTextDocument(sqlFilePath);
  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: false,
  });
}

function syncSqlToLogicalViews(session: SqlEditSession): boolean {
  try {
    const editedSql = fs.readFileSync(session.sqlFilePath, 'utf8');
    const flatSql = flattenSQL(editedSql);

    const content = fs.readFileSync(session.logicalViewsPath, 'utf8');
    const parsed = JSON.parse(content);
    const items: Array<Record<string, unknown>> = parsed.items ?? [];

    const view = items.find((v) => v.apiName === session.logicalViewApiName);
    if (!view) {
      vscode.window.showErrorMessage(
        `Logical view "${session.logicalViewApiName}" no longer exists in logicalViews.json.`
      );
      return false;
    }

    view.customSQLV2 = flatSql;
    fs.writeFileSync(session.logicalViewsPath, JSON.stringify(parsed, null, 2), 'utf8');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to sync SQL: ${msg}`);
    return false;
  }
}

export function registerCustomSQLSaveHandler(): vscode.Disposable {
  return vscode.workspace.onDidSaveTextDocument((doc) => {
    const session = activeSessionsByFile.get(doc.uri.fsPath);
    if (!session) {
      return;
    }
    if (syncSqlToLogicalViews(session)) {
      vscode.window.showInformationMessage(
        `✓ SQL synced → "${session.logicalViewLabel}" in logicalViews.json`
      );
    }
  });
}

export function registerCustomSQLCleanup(): vscode.Disposable {
  return vscode.workspace.onDidCloseTextDocument((doc) => {
    const session = activeSessionsByFile.get(doc.uri.fsPath);
    if (!session) {
      return;
    }
    activeSessionsByFile.delete(doc.uri.fsPath);
    try {
      if (fs.existsSync(session.sqlFilePath)) {
        fs.unlinkSync(session.sqlFilePath);
      }
    } catch {
      // best-effort cleanup
    }
  });
}
