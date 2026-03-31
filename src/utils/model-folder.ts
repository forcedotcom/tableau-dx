/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as fs from 'fs';
import * as path from 'path';

const SEMANTIC_MODELS_FOLDER = 'Semantic Models';

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
  const candidate = path.join(parentDir, label);

  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  const existingApiName = readApiNameFromFolder(candidate);
  if (existingApiName === apiName) {
    return candidate;
  }

  for (let i = 2; i < 100; i++) {
    const numbered = path.join(parentDir, `${label} (${i})`);
    if (!fs.existsSync(numbered)) {
      return numbered;
    }
    const numberedApiName = readApiNameFromFolder(numbered);
    if (numberedApiName === apiName) {
      return numbered;
    }
  }

  return path.join(parentDir, `${label} (${apiName})`);
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
