/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as fs from 'fs';
import * as path from 'path';
import { saveOrgInfo } from './org-info-storage';

/**
 * Writes the full model API response to local JSON files in the given folder.
 * Reusable by export-to-folder, create-model, and any command that needs to
 * persist a full model response from the server.
 */
export function writeModelFiles(
  modelFolderPath: string,
  apiResponse: Record<string, unknown>,
  orgResult?: { id: string; instanceUrl: string; username: string; alias?: string }
): void {
  const decoded = decodeHtmlEntitiesDeep(apiResponse) as Record<string, unknown>;

  if (!fs.existsSync(modelFolderPath)) {
    fs.mkdirSync(modelFolderPath, { recursive: true });
  }

  const modelMeta: Record<string, unknown> = {};
  const entityKeys = new Set([
    'semanticDataObjects', 'semanticRelationships', 'semanticCalculatedDimensions',
    'semanticCalculatedMeasurements', 'semanticGroupings', 'semanticLogicalViews',
    'semanticParameters', 'semanticDimensionHierarchies', 'semanticMetrics',
    'semanticModelInfo', 'semanticModelFilters', 'fieldsOverrides',
  ]);
  for (const [key, val] of Object.entries(decoded)) {
    if (!entityKeys.has(key) && !key.endsWith('Url')) {
      modelMeta[key] = val;
    }
  }

  const entities: Record<string, unknown> = {
    'model.json': modelMeta,
    'dataObjects.json': { items: decoded.semanticDataObjects ?? [] },
    'relationships.json': { items: decoded.semanticRelationships ?? [] },
    'calculatedDimensions.json': { items: decoded.semanticCalculatedDimensions ?? [] },
    'calculatedMeasurements.json': { items: decoded.semanticCalculatedMeasurements ?? [] },
    'groupings.json': { groupings: decoded.semanticGroupings ?? [] },
    'parameters.json': { items: decoded.semanticParameters ?? [] },
    'logicalViews.json': { items: decoded.semanticLogicalViews ?? [] },
    'dimensionHierarchies.json': { items: decoded.semanticDimensionHierarchies ?? [] },
    'metrics.json': { items: decoded.semanticMetrics ?? [] },
    'modelInfo.json': decoded.semanticModelInfo ?? {},
    'fieldsOverrides.json': { items: decoded.fieldsOverrides ?? [] },
    'modelFilters.json': { items: decoded.semanticModelFilters ?? [] },
  };

  const baseModels = (modelMeta.baseModels ?? []) as { apiName: string; label: string }[];
  if (baseModels.length > 0) {
    const baseModelLabelMap = new Map(baseModels.map(bm => [bm.apiName, bm.label]));

    const partitionableFiles = [
      'dataObjects.json', 'relationships.json', 'calculatedDimensions.json',
      'calculatedMeasurements.json', 'parameters.json', 'logicalViews.json',
      'dimensionHierarchies.json', 'metrics.json', 'fieldsOverrides.json',
      'modelFilters.json', 'groupings.json',
    ];

    for (const fileName of partitionableFiles) {
      const data = entities[fileName] as Record<string, unknown>;
      const itemsKey = fileName === 'groupings.json' ? 'groupings' : 'items';
      const allItems = (data[itemsKey] as Array<Record<string, unknown>>) ?? [];

      const mainItems: Record<string, unknown>[] = [];
      const byBase = new Map<string, Record<string, unknown>[]>();

      for (const item of allItems) {
        const baseApiName = item.baseModelApiName as string | undefined;
        if (baseApiName && baseModelLabelMap.has(baseApiName)) {
          const labelVal = baseModelLabelMap.get(baseApiName)!;
          if (!byBase.has(labelVal)) { byBase.set(labelVal, []); }
          byBase.get(labelVal)!.push(item);
        } else {
          mainItems.push(item);
        }
      }

      data[itemsKey] = mainItems;

      for (const [labelVal, items] of byBase) {
        if (items.length === 0) continue;
        const baseFolderPath = path.join(modelFolderPath, 'base', labelVal);
        if (!fs.existsSync(baseFolderPath)) {
          fs.mkdirSync(baseFolderPath, { recursive: true });
        }
        fs.writeFileSync(
          path.join(baseFolderPath, fileName),
          JSON.stringify({ [itemsKey]: items }, null, 2),
          'utf8'
        );
      }
    }
  }

  for (const [fileName, data] of Object.entries(entities)) {
    const filePath = path.join(modelFolderPath, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  if (orgResult) {
    saveOrgInfo(modelFolderPath, orgResult);
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function decodeHtmlEntitiesDeep(obj: unknown): unknown {
  if (typeof obj === 'string') return decodeHtmlEntities(obj);
  if (Array.isArray(obj)) return obj.map(decodeHtmlEntitiesDeep);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = decodeHtmlEntitiesDeep(val);
    }
    return result;
  }
  return obj;
}
