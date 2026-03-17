/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import { RawSemanticModel, DiffStatus } from '../v2/types';

const METADATA_KEYS = new Set([
  'id', 'createdBy', 'createdDate', 'lastModifiedBy', 'lastModifiedDate',
  'url', 'isQueryable',
]);

function stripMetadata(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripMetadata);
  if (typeof obj === 'object') {
    const clean: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (METADATA_KEYS.has(k)) continue;
      clean[k] = stripMetadata(v);
    }
    return clean;
  }
  if (typeof obj === 'string') {
    return obj
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
  return obj;
}

function semanticEqual(a: any, b: any): boolean {
  return JSON.stringify(stripMetadata(a)) === JSON.stringify(stripMetadata(b));
}

/**
 * Merges two arrays by apiName, tagging each item with a diffStatus.
 * Returns the merged array with local items preferred, remote-only items injected.
 */
function mergeArraysWithDiff<T extends { apiName: string }>(localArr: T[], remoteArr: T[]): (T & { diffStatus: DiffStatus })[] {
  const localMap = new Map(localArr.map(o => [o.apiName, o]));
  const remoteMap = new Map(remoteArr.map(o => [o.apiName, o]));
  const merged: (T & { diffStatus: DiffStatus })[] = [];

  for (const [apiName, localObj] of localMap) {
    if (!remoteMap.has(apiName)) {
      merged.push({ ...localObj, diffStatus: 'added' });
    } else if (!semanticEqual(localObj, remoteMap.get(apiName))) {
      merged.push({ ...localObj, diffStatus: 'modified' });
    } else {
      merged.push({ ...localObj, diffStatus: 'unchanged' });
    }
  }
  for (const [apiName, remoteObj] of remoteMap) {
    if (!localMap.has(apiName)) {
      merged.push({ ...remoteObj, diffStatus: 'removed' });
    }
  }
  return merged;
}

/**
 * Merges local and remote RawSemanticModels into a single model
 * where every entity carries a diffStatus property.
 */
export function mergeForCompare(local: RawSemanticModel, remote: RawSemanticModel): RawSemanticModel {
  return {
    model: local.model,
    dataObjects: mergeArraysWithDiff(local.dataObjects, remote.dataObjects),
    relationships: mergeArraysWithDiff(local.relationships, remote.relationships),
    calculatedDimensions: mergeArraysWithDiff(local.calculatedDimensions, remote.calculatedDimensions),
    calculatedMeasurements: mergeArraysWithDiff(local.calculatedMeasurements, remote.calculatedMeasurements),
    groupings: mergeArraysWithDiff(local.groupings, remote.groupings),
    logicalViews: mergeArraysWithDiff(local.logicalViews, remote.logicalViews),
    parameters: local.parameters,
    dimensionHierarchies: mergeArraysWithDiff(local.dimensionHierarchies, remote.dimensionHierarchies),
    metrics: mergeArraysWithDiff(local.metrics, remote.metrics),
    modelInfo: local.modelInfo,
    fieldsOverrides: local.fieldsOverrides,
    modelFilters: local.modelFilters,
  };
}

/**
 * Build a RawSemanticModel from the full model API response (same structure as export).
 */
export function rawModelFromApiResponse(fullModel: Record<string, any>): RawSemanticModel {
  const entityKeys = new Set([
    'semanticDataObjects', 'semanticRelationships', 'semanticCalculatedDimensions',
    'semanticCalculatedMeasurements', 'semanticGroupings', 'semanticLogicalViews',
    'semanticParameters', 'semanticDimensionHierarchies', 'semanticMetrics',
    'semanticModelInfo', 'semanticModelFilters', 'fieldsOverrides',
  ]);
  const meta: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fullModel)) {
    if (!entityKeys.has(key) && !key.endsWith('Url')) {
      meta[key] = val;
    }
  }

  return {
    model: meta as any,
    dataObjects: fullModel.semanticDataObjects ?? [],
    relationships: fullModel.semanticRelationships ?? [],
    calculatedDimensions: fullModel.semanticCalculatedDimensions ?? [],
    calculatedMeasurements: fullModel.semanticCalculatedMeasurements ?? [],
    groupings: fullModel.semanticGroupings ?? [],
    logicalViews: fullModel.semanticLogicalViews ?? [],
    parameters: fullModel.semanticParameters ?? [],
    dimensionHierarchies: fullModel.semanticDimensionHierarchies ?? [],
    metrics: fullModel.semanticMetrics ?? [],
    modelInfo: fullModel.semanticModelInfo ?? { definitionsCount: 0, maxDefinitionCount: 0, modelHierarchyDepth: 0 },
    fieldsOverrides: fullModel.fieldsOverrides ?? [],
    modelFilters: fullModel.semanticModelFilters ?? [],
  };
}

function compareArraysByApiName(localArr: any[], remoteArr: any[]) {
  const localMap = new Map(localArr.map((o: any) => [o.apiName, o]));
  const remoteMap = new Map(remoteArr.map((o: any) => [o.apiName, o]));
  const onlyLocal: string[] = [];
  const onlyRemote: string[] = [];
  const modified: string[] = [];
  for (const [apiName, localObj] of localMap) {
    if (!remoteMap.has(apiName)) onlyLocal.push(apiName);
    else if (!semanticEqual(localObj, remoteMap.get(apiName))) modified.push(apiName);
  }
  for (const apiName of remoteMap.keys()) {
    if (!localMap.has(apiName)) onlyRemote.push(apiName);
  }
  return { onlyLocal, onlyRemote, modified };
}

/**
 * Legacy compare function used by model-history command.
 */
export function compareModels(
  localDataObjects: any[],
  localRelationships: any[],
  remoteDataObjects: any[],
  remoteRelationships: any[],
  localCalcDimensions: any[],
  localCalcMeasurements: any[],
  remoteCalcDimensions: any[],
  remoteCalcMeasurements: any[],
  localDependencies: any[],
  remoteDependencies: any[]
): any {
  const differences: any = {
    hasRemote: true,
    dataObjects: { onlyLocal: [] as string[], onlyRemote: [] as string[], modified: [] as string[] },
    relationships: { onlyLocal: [] as string[], onlyRemote: [] as string[], modified: [] as string[] },
    calculatedFields: { onlyLocal: [] as string[], onlyRemote: [] as string[], modified: [] as string[], dependenciesChanged: [] as string[] }
  };

  const doResult = compareArraysByApiName(localDataObjects, remoteDataObjects);
  differences.dataObjects = doResult;

  const relResult = compareArraysByApiName(localRelationships, remoteRelationships);
  differences.relationships = relResult;

  const allLocalCalcFields = [
    ...localCalcDimensions.map((c: any) => ({ ...c, _calcType: 'dimension' })),
    ...localCalcMeasurements.map((c: any) => ({ ...c, _calcType: 'measurement' }))
  ];
  const allRemoteCalcFields = [
    ...remoteCalcDimensions.map((c: any) => ({ ...c, _calcType: 'dimension' })),
    ...remoteCalcMeasurements.map((c: any) => ({ ...c, _calcType: 'measurement' }))
  ];
  const calcResult = compareArraysByApiName(allLocalCalcFields, allRemoteCalcFields);
  differences.calculatedFields.onlyLocal = calcResult.onlyLocal;
  differences.calculatedFields.onlyRemote = calcResult.onlyRemote;
  differences.calculatedFields.modified = calcResult.modified;

  const changedCalcFieldApiNames = new Set<string>([...calcResult.onlyLocal, ...calcResult.onlyRemote, ...calcResult.modified]);
  const affectedDataObjects = new Set<string>();
  changedCalcFieldApiNames.forEach(calcApiName => {
    [localDependencies, remoteDependencies].forEach(deps => {
      const dep = (deps || []).find((d: any) => d.definitionApiName === calcApiName);
      if (dep?.dependencies) {
        dep.dependencies.forEach((d: any) => {
          if (d.definitionType === 'DataObject') affectedDataObjects.add(d.apiName);
        });
      }
    });
  });
  differences.calculatedFields.dependenciesChanged = Array.from(affectedDataObjects);

  return differences;
}