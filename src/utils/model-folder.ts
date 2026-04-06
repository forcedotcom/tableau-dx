/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as fs from 'fs';
import * as path from 'path';

const SEMANTIC_MODELS_FOLDER = 'Semantic Models';

/** Strip characters that enable path traversal or invalid folder names on common platforms. */
const UNSAFE_FOLDER_CHARS = /[/\\:\0\u202e]/g;

/**
 * Returns a single path segment safe for use under `parentDir` (no `..`, separators, or NUL).
 * @param fallback Used when the result would otherwise be empty or reserved (`.`, `..`).
 */
function sanitizeModelFolderSegment(raw: string, fallback: string): string {
  let s = raw.replace(UNSAFE_FOLDER_CHARS, '');
  s = s.replace(/\.\./g, '_');
  s = s.trim().replace(/^[\s.]+|[\s.]+$/g, '');
  if (!s || s === '.' || s === '..') {
    return fallback;
  }
  return s;
}

function assertResolvedPathInsideParent(parentDir: string, candidatePath: string): void {
  const parentResolved = path.resolve(parentDir);
  const candidateResolved = path.resolve(candidatePath);
  const rel = path.relative(parentResolved, candidateResolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Model folder must stay inside the selected directory.');
  }
}

/**
 * Walks up from the given path to find the "Semantic Models" folder.
 * If the path IS "Semantic Models", returns it directly.
 * If the path is a child of "Semantic Models", returns the parent.
 */
export function resolveSemanticModelsFolder(folderPath: string): string {
  if (path.basename(folderPath) === SEMANTIC_MODELS_FOLDER) {
    return folderPath;
  }
  let current = folderPath;
  while (current && current !== path.dirname(current)) {
    if (path.basename(current) === SEMANTIC_MODELS_FOLDER) {
      return current;
    }
    current = path.dirname(current);
  }
  return folderPath;
}

/**
 * Finds a safe folder path for a model, avoiding collisions with different models
 * that share the same label. If a folder already exists with a matching apiName,
 * it returns that folder (safe to overwrite). If the folder exists but has a
 * different apiName, it appends " (2)", " (3)", etc. until a free slot is found.
 */
export function resolveModelFolder(parentDir: string, label: string, apiName: string): string {
  const safeLabel = sanitizeModelFolderSegment(label, 'model');
  const safeApi = sanitizeModelFolderSegment(apiName, 'model');

  const candidate = path.join(parentDir, safeLabel);
  assertResolvedPathInsideParent(parentDir, candidate);

  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  const existingApiName = readApiNameFromFolder(candidate);
  if (existingApiName === apiName) {
    return candidate;
  }

  for (let i = 2; i < 100; i++) {
    const numbered = path.join(parentDir, `${safeLabel} (${i})`);
    assertResolvedPathInsideParent(parentDir, numbered);
    if (!fs.existsSync(numbered)) {
      return numbered;
    }
    const numberedApiName = readApiNameFromFolder(numbered);
    if (numberedApiName === apiName) {
      return numbered;
    }
  }

  const fallback = path.join(parentDir, `${safeLabel} (${safeApi})`);
  assertResolvedPathInsideParent(parentDir, fallback);
  return fallback;
}

function readApiNameFromFolder(folderPath: string): string | null {
  const modelJsonPath = path.join(folderPath, 'model.json');
  try {
    if (fs.existsSync(modelJsonPath)) {
      const data = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
      return (data.apiName as string) ?? null;
    }
  } catch {
    // Corrupted or unreadable — treat as unknown
  }
  return null;
}
