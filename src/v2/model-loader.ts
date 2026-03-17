/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  RawSemanticModel,
  SemanticModelMeta,
  DataObject,
  Relationship,
  CalculatedField,
  Grouping,
  LogicalView,
  Parameter,
  DimensionHierarchy,
  Metric,
  ModelInfo,
  FieldOverride,
  ModelFilter,
} from './types';
import { getFileAtCommit } from '../utils/git';

const BASE_ENTITY_FILES: { fileName: string; itemsKey: string; resultKey: keyof RawSemanticModel }[] = [
  { fileName: 'dataObjects.json', itemsKey: 'items', resultKey: 'dataObjects' },
  { fileName: 'relationships.json', itemsKey: 'items', resultKey: 'relationships' },
  { fileName: 'calculatedDimensions.json', itemsKey: 'items', resultKey: 'calculatedDimensions' },
  { fileName: 'calculatedMeasurements.json', itemsKey: 'items', resultKey: 'calculatedMeasurements' },
  { fileName: 'groupings.json', itemsKey: 'groupings', resultKey: 'groupings' },
  { fileName: 'logicalViews.json', itemsKey: 'items', resultKey: 'logicalViews' },
  { fileName: 'parameters.json', itemsKey: 'items', resultKey: 'parameters' },
  { fileName: 'dimensionHierarchies.json', itemsKey: 'items', resultKey: 'dimensionHierarchies' },
  { fileName: 'metrics.json', itemsKey: 'items', resultKey: 'metrics' },
  { fileName: 'fieldsOverrides.json', itemsKey: 'items', resultKey: 'fieldsOverrides' },
  { fileName: 'modelFilters.json', itemsKey: 'items', resultKey: 'modelFilters' },
];

function readJsonFile<T>(folderPath: string, filename: string, fallback: T): T {
  const filePath = path.join(folderPath, filename);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
}

function mergeBaseModelEntities(result: RawSemanticModel, folderPath: string): void {
  const baseFolderPath = path.join(folderPath, 'base');
  if (!fs.existsSync(baseFolderPath) || !fs.statSync(baseFolderPath).isDirectory()) {
    return;
  }

  const baseDirs = fs.readdirSync(baseFolderPath).filter(d =>
    fs.statSync(path.join(baseFolderPath, d)).isDirectory()
  );

  for (const baseDir of baseDirs) {
    const baseEntityPath = path.join(baseFolderPath, baseDir);
    for (const { fileName, itemsKey, resultKey } of BASE_ENTITY_FILES) {
      const file = readJsonFile<Record<string, unknown[]>>(baseEntityPath, fileName, {});
      const items = file[itemsKey] ?? [];
      (result[resultKey] as unknown[]).push(...items);
    }
  }
}

export function loadSemanticModelFiles(folderPath: string): RawSemanticModel {
  const model = readJsonFile<SemanticModelMeta>(folderPath, 'model.json', {} as SemanticModelMeta);

  const dataObjectsFile = readJsonFile<{ items: DataObject[] }>(folderPath, 'dataObjects.json', { items: [] });
  const relationshipsFile = readJsonFile<{ items: Relationship[] }>(folderPath, 'relationships.json', { items: [] });
  const calcDimsFile = readJsonFile<{ items: CalculatedField[] }>(folderPath, 'calculatedDimensions.json', { items: [] });
  const calcMeasFile = readJsonFile<{ items: CalculatedField[] }>(folderPath, 'calculatedMeasurements.json', { items: [] });
  const groupingsFile = readJsonFile<{ groupings: Grouping[] }>(folderPath, 'groupings.json', { groupings: [] });
  const logicalViewsFile = readJsonFile<{ items: LogicalView[] }>(folderPath, 'logicalViews.json', { items: [] });
  const parametersFile = readJsonFile<{ items: Parameter[] }>(folderPath, 'parameters.json', { items: [] });
  const dimHierarchiesFile = readJsonFile<{ items: DimensionHierarchy[] }>(folderPath, 'dimensionHierarchies.json', { items: [] });
  const metricsFile = readJsonFile<{ items: Metric[] }>(folderPath, 'metrics.json', { items: [] });
  const modelInfo = readJsonFile<ModelInfo>(folderPath, 'modelInfo.json', { definitionsCount: 0, maxDefinitionCount: 0, modelHierarchyDepth: 0 });
  const fieldsOverridesFile = readJsonFile<{ items: FieldOverride[] }>(folderPath, 'fieldsOverrides.json', { items: [] });
  const modelFiltersFile = readJsonFile<{ items: ModelFilter[] }>(folderPath, 'modelFilters.json', { items: [] });

  const result: RawSemanticModel = {
    model,
    dataObjects: dataObjectsFile.items ?? [],
    relationships: relationshipsFile.items ?? [],
    calculatedDimensions: calcDimsFile.items ?? [],
    calculatedMeasurements: calcMeasFile.items ?? [],
    groupings: groupingsFile.groupings ?? [],
    logicalViews: logicalViewsFile.items ?? [],
    parameters: parametersFile.items ?? [],
    dimensionHierarchies: dimHierarchiesFile.items ?? [],
    metrics: metricsFile.items ?? [],
    modelInfo,
    fieldsOverrides: fieldsOverridesFile.items ?? [],
    modelFilters: modelFiltersFile.items ?? [],
  };

  mergeBaseModelEntities(result, folderPath);

  return result;
}

async function readGitJsonFile<T>(folderPath: string, filename: string, commitHash: string, fallback: T): Promise<T> {
  try {
    const content = await getFileAtCommit(path.join(folderPath, filename), commitHash);
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function mergeBaseModelEntitiesFromCommit(
  result: RawSemanticModel,
  folderPath: string,
  commitHash: string
): Promise<void> {
  const baseModels = result.model.baseModels;
  if (!baseModels || baseModels.length === 0) {
    return;
  }

  for (const baseModel of baseModels) {
    const basePrefix = path.join('base', baseModel.label);
    for (const { fileName, itemsKey, resultKey } of BASE_ENTITY_FILES) {
      const file = await readGitJsonFile<Record<string, unknown[]>>(
        folderPath, path.join(basePrefix, fileName), commitHash, {}
      );
      const items = file[itemsKey] ?? [];
      (result[resultKey] as unknown[]).push(...items);
    }
  }
}

export async function loadRawModelFromCommit(folderPath: string, commitHash: string): Promise<RawSemanticModel> {
  const model = await readGitJsonFile<SemanticModelMeta>(folderPath, 'model.json', commitHash, {} as SemanticModelMeta);

  const dataObjectsFile = await readGitJsonFile<{ items: DataObject[] }>(folderPath, 'dataObjects.json', commitHash, { items: [] });
  const relationshipsFile = await readGitJsonFile<{ items: Relationship[] }>(folderPath, 'relationships.json', commitHash, { items: [] });
  const calcDimsFile = await readGitJsonFile<{ items: CalculatedField[] }>(folderPath, 'calculatedDimensions.json', commitHash, { items: [] });
  const calcMeasFile = await readGitJsonFile<{ items: CalculatedField[] }>(folderPath, 'calculatedMeasurements.json', commitHash, { items: [] });
  const groupingsFile = await readGitJsonFile<{ groupings: Grouping[] }>(folderPath, 'groupings.json', commitHash, { groupings: [] });
  const logicalViewsFile = await readGitJsonFile<{ items: LogicalView[] }>(folderPath, 'logicalViews.json', commitHash, { items: [] });
  const parametersFile = await readGitJsonFile<{ items: Parameter[] }>(folderPath, 'parameters.json', commitHash, { items: [] });
  const dimHierarchiesFile = await readGitJsonFile<{ items: DimensionHierarchy[] }>(folderPath, 'dimensionHierarchies.json', commitHash, { items: [] });
  const metricsFile = await readGitJsonFile<{ items: Metric[] }>(folderPath, 'metrics.json', commitHash, { items: [] });
  const modelInfo = await readGitJsonFile<ModelInfo>(folderPath, 'modelInfo.json', commitHash, { definitionsCount: 0, maxDefinitionCount: 0, modelHierarchyDepth: 0 });
  const fieldsOverridesFile = await readGitJsonFile<{ items: FieldOverride[] }>(folderPath, 'fieldsOverrides.json', commitHash, { items: [] });
  const modelFiltersFile = await readGitJsonFile<{ items: ModelFilter[] }>(folderPath, 'modelFilters.json', commitHash, { items: [] });

  const result: RawSemanticModel = {
    model,
    dataObjects: dataObjectsFile.items ?? [],
    relationships: relationshipsFile.items ?? [],
    calculatedDimensions: calcDimsFile.items ?? [],
    calculatedMeasurements: calcMeasFile.items ?? [],
    groupings: groupingsFile.groupings ?? [],
    logicalViews: logicalViewsFile.items ?? [],
    parameters: parametersFile.items ?? [],
    dimensionHierarchies: dimHierarchiesFile.items ?? [],
    metrics: metricsFile.items ?? [],
    modelInfo,
    fieldsOverrides: fieldsOverridesFile.items ?? [],
    modelFilters: modelFiltersFile.items ?? [],
  };

  await mergeBaseModelEntitiesFromCommit(result, folderPath, commitHash);

  return result;
}