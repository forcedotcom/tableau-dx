/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const HIDDEN_FIELDS = ['"createdBy"', '"createdDate"', '"lastModifiedBy"', '"lastModifiedDate"'];

const EXCLUDED_FILES = new Set(['model.json', 'modelInfo.json']);

const VIEW_CONFIG_FILE = 'viewConfig.json';
const METADATA_DIR = 'metadata';

const dimDecoration = vscode.window.createTextEditorDecorationType({
  opacity: '0.15',
  fontStyle: 'italic',
});

const codeLensEmitter = new vscode.EventEmitter<void>();

function isSemanticModelEntityFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('/Semantic Models/')) {
    return false;
  }
  const fileName = path.basename(filePath);
  if (!fileName.endsWith('.json') || EXCLUDED_FILES.has(fileName)) {
    return false;
  }
  const relative = normalized.split('/Semantic Models/').pop() ?? '';
  if (relative.includes('/metadata/') || relative.includes('/base/')) {
    return false;
  }
  return true;
}

function findModelFolder(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/Semantic Models/';
  const idx = normalized.indexOf(marker);
  if (idx === -1) { return null; }

  const afterMarker = normalized.substring(idx + marker.length);
  const modelName = afterMarker.split('/')[0];
  if (!modelName) { return null; }

  return path.join(normalized.substring(0, idx), 'Semantic Models', modelName);
}

function readViewConfig(modelFolder: string): { hideServerFields: boolean } {
  const configPath = path.join(modelFolder, METADATA_DIR, VIEW_CONFIG_FILE);
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { hideServerFields: data.hideServerFields === true };
    }
  } catch {
    // Corrupted — treat as default
  }
  return { hideServerFields: false };
}

function writeViewConfig(modelFolder: string, config: { hideServerFields: boolean }): void {
  const metadataDir = path.join(modelFolder, METADATA_DIR);
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }
  const configPath = path.join(metadataDir, VIEW_CONFIG_FILE);

  let existing: Record<string, unknown> = {};
  try {
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {
    // Start fresh
  }

  existing.hideServerFields = config.hideServerFields;
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf8');
}

export class FieldVisibilityCodeLensProvider implements vscode.CodeLensProvider {
  readonly onDidChangeCodeLenses = codeLensEmitter.event;

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!isSemanticModelEntityFile(document.fileName)) {
      return [];
    }

    const modelFolder = findModelFolder(document.fileName);
    if (!modelFolder) { return []; }

    const config = readViewConfig(modelFolder);
    const hidden = config.hideServerFields;

    const title = hidden
      ? '$(eye) Show Server Fields'
      : '$(eye-closed) Hide Server Fields';

    return [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title,
        command: 'semanticLayer.toggleFieldVisibility',
        arguments: [document.uri],
      }),
    ];
  }
}

export async function toggleFieldVisibilityCommand(uri?: vscode.Uri): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const filePath = uri?.fsPath ?? editor?.document.fileName;
  if (!filePath) { return; }

  const modelFolder = findModelFolder(filePath);
  if (!modelFolder) { return; }

  const config = readViewConfig(modelFolder);
  config.hideServerFields = !config.hideServerFields;
  writeViewConfig(modelFolder, config);

  codeLensEmitter.fire();
  applyDecorationsToAllVisibleEditors();
}

export function applyFieldVisibilityDecorations(editor: vscode.TextEditor): void {
  if (!isSemanticModelEntityFile(editor.document.fileName)) {
    editor.setDecorations(dimDecoration, []);
    return;
  }

  const modelFolder = findModelFolder(editor.document.fileName);
  if (!modelFolder) {
    editor.setDecorations(dimDecoration, []);
    return;
  }

  const config = readViewConfig(modelFolder);
  if (!config.hideServerFields) {
    editor.setDecorations(dimDecoration, []);
    return;
  }

  const ranges: vscode.Range[] = [];
  const doc = editor.document;

  for (let i = 0; i < doc.lineCount; i++) {
    const line = doc.lineAt(i);
    const trimmed = line.text.trim();
    if (HIDDEN_FIELDS.some(field => trimmed.startsWith(field))) {
      ranges.push(line.range);
    }
  }

  editor.setDecorations(dimDecoration, ranges);
}

function applyDecorationsToAllVisibleEditors(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    applyFieldVisibilityDecorations(editor);
  }
}

export function registerFieldVisibilityListeners(): vscode.Disposable[] {
  const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      applyFieldVisibilityDecorations(editor);
    }
  });

  const onDocChange = vscode.workspace.onDidChangeTextDocument((e) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === e.document) {
      applyFieldVisibilityDecorations(editor);
    }
  });

  if (vscode.window.activeTextEditor) {
    applyFieldVisibilityDecorations(vscode.window.activeTextEditor);
  }

  return [onEditorChange, onDocChange];
}
