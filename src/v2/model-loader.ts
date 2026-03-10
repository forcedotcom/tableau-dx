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

function readJsonFile<T>(folderPath: string, filename: string, fallback: T): T {
  const filePath = path.join(folderPath, filename);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
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

  return {
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
}

async function readGitJsonFile<T>(folderPath: string, filename: string, commitHash: string, fallback: T): Promise<T> {
  try {
    const content = await getFileAtCommit(path.join(folderPath, filename), commitHash);
    return JSON.parse(content) as T;
  } catch {
    return fallback;
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

  return {
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
}
