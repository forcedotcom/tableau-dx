/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

// ─── Raw model types (matching the JSON file structures) ───

export interface SemanticModelMeta {
  apiName: string;
  label: string;
  id: string;
  dataspace: string;
  createdBy: string;
  createdDate: string;
  lastModifiedBy: string;
  lastModifiedDate: string;
  isLocked: boolean;
  sourceCreation: string;
  queryUnrelatedDataObjects?: string;
  categories?: unknown[];
  currency?: { useOrgDefault?: boolean };
  isQueryable?: string;
  cacheKey?: string;
  agentEnabled?: boolean;
  hasUnmapped?: boolean;
  isAiDrafted?: boolean;
  isPartialSdm?: boolean;
  lockedActions?: unknown;
  baseModels?: { apiName: string; label: string }[];
  [key: string]: unknown;
}

export interface Dimension {
  apiName: string;
  label: string;
  dataType?: string;
  displayCategory?: string;
  dataObjectFieldName?: string;
  semanticDataType?: string;
  sortOrder?: string;
  isVisible?: boolean;
  isQueryable?: string;
  storageDataType?: string;
}

export interface Measurement {
  apiName: string;
  label: string;
  dataType?: string;
  aggregationType?: string;
  dataObjectFieldName?: string;
  displayCategory?: string;
  decimalPlace?: number;
  directionality?: string;
  isAggregatable?: boolean;
  isVisible?: boolean;
  isQueryable?: string;
  semanticDataType?: string;
  sentiment?: string;
  shouldTreatNullsAsZeros?: boolean;
  sortOrder?: string;
  storageDataType?: string;
}

export interface DataObject {
  apiName: string;
  label: string;
  id?: string;
  dataObjectName?: string;
  dataObjectType?: string;
  semanticDimensions: Dimension[];
  semanticMeasurements: Measurement[];
  shouldIncludeAllFields?: boolean;
  tableType?: string;
  filters?: unknown[];
  isQueryable?: string;
  baseModelApiName?: string;
  unmapped?: boolean;
}

export interface RelationshipCriterion {
  joinOperator: string;
  leftFieldType?: string;
  leftSemanticFieldApiName: string;
  rightFieldType?: string;
  rightSemanticFieldApiName: string;
}

export interface Relationship {
  apiName: string;
  label: string;
  leftSemanticDefinitionApiName: string;
  rightSemanticDefinitionApiName: string;
  cardinality: string;
  joinType: string;
  isEnabled: boolean;
  criteria: RelationshipCriterion[];
  isQueryable?: string;
  baseModelApiName?: string;
}

export interface CalculatedField {
  apiName: string;
  label: string;
  expression: string;
  dataType?: string;
  displayCategory?: string;
  aggregationType?: string;
  decimalPlace?: number;
  directionality?: string;
  filters?: unknown[];
  id?: string;
  isOverrideBase?: boolean;
  isQueryable?: string;
  isSystemDefinition?: boolean;
  isVisible?: boolean;
  level?: string;
  semanticDataType?: string;
  sentiment?: string;
  shouldTreatNullsAsZeros?: boolean;
  sortOrder?: string;
  totalAggregationType?: string;
  baseModelApiName?: string;
}

export interface DimensionHierarchyLevel {
  definitionApiName: string;
  definitionFieldName: string;
  definitionType: string;
  position: number;
}

export interface DimensionHierarchy {
  apiName: string;
  label: string;
  id?: string;
  levels: DimensionHierarchyLevel[];
  isQueryable?: string;
  baseModelApiName?: string;
}

export interface TableFieldReference {
  fieldApiName: string;
  tableApiName: string;
}

export interface FieldReference {
  tableFieldReference?: TableFieldReference;
}

export interface Metric {
  apiName: string;
  label: string;
  id?: string;
  aggregationType?: string;
  measurementReference?: { tableFieldReference?: TableFieldReference };
  timeDimensionReference?: { tableFieldReference?: TableFieldReference };
  additionalDimensions?: unknown[];
  filters?: unknown[];
  insightsSettings?: unknown;
  isCumulative?: boolean;
  isQueryable?: string;
  timeGrains?: string[];
  baseModelApiName?: string;
}

export interface GroupingConfiguration {
  groupDimension?: {
    groups: Array<{ name: string; values: string[] }>;
    ungroupedValuesGroupName?: string;
  };
  binDimension?: {
    constantBinSize?: number;
  };
}

export interface Grouping {
  apiName: string;
  label: string;
  type: string;
  fieldReference: FieldReference;
  configuration?: GroupingConfiguration;
  id?: string;
  isQueryable?: string;
  baseModelApiName?: string;
}

export interface Parameter {
  apiName: string;
  label: string;
  dataType?: string;
  defaultValue?: string;
  type?: string;
  allowedValues?: unknown[];
  values?: unknown[];
  id?: string;
  baseModelApiName?: string;
}

export interface LogicalViewDataObject extends DataObject {
  logicalViewId?: string;
}

export interface LogicalViewUnion {
  apiName: string;
  label: string;
  id?: string;
  isQueryable?: string;
  semanticDataObjects: LogicalViewDataObject[];
  semanticMappedFields?: unknown[];
}

export interface LogicalView {
  apiName: string;
  label: string;
  id?: string;
  isQueryable?: string;
  semanticViewTypeEnum?: string;
  tableType?: string;
  customSQLV2?: string;
  overriddenProperties?: unknown[];
  filters?: unknown[];
  semanticDataObjects: LogicalViewDataObject[];
  semanticRelationships: Relationship[];
  semanticUnions: LogicalViewUnion[];
  referenceIntegritySemanticDataObjects?: unknown[];
  baseModelApiName?: string;
  unmapped?: boolean;
}

export interface ModelInfo {
  definitionsCount: number;
  maxDefinitionCount: number;
  modelHierarchyDepth: number;
}

export interface FieldOverride {
  [key: string]: unknown;
}

export interface ModelFilter {
  [key: string]: unknown;
}

// ─── Raw model (what the loader returns) ───

export interface RawSemanticModel {
  model: SemanticModelMeta;
  dataObjects: DataObject[];
  relationships: Relationship[];
  calculatedDimensions: CalculatedField[];
  calculatedMeasurements: CalculatedField[];
  groupings: Grouping[];
  logicalViews: LogicalView[];
  parameters: Parameter[];
  dimensionHierarchies: DimensionHierarchy[];
  metrics: Metric[];
  modelInfo: ModelInfo;
  fieldsOverrides: FieldOverride[];
  modelFilters: ModelFilter[];
}

export type DiffStatus = 'added' | 'modified' | 'removed' | 'unchanged';

// ─── Expression parsing types ───

export interface ExpressionReference {
  objectApiName: string | null;
  fieldApiName: string;
  raw: string;
}

// ─── Dependency / placement types ───

export type EntityType =
  | 'calculatedDimension'
  | 'calculatedMeasurement'
  | 'dimensionHierarchy'
  | 'metric'
  | 'grouping';

export type PlacementType = 'exclusive' | 'crossObject' | 'orphan';

export interface EntityPlacement {
  entityApiName: string;
  entityType: EntityType;
  placement: PlacementType;
  referencedObjects: string[];
  directReferences?: ExpressionReference[];
}

export interface DependencyGraph {
  placements: Map<string, EntityPlacement>;
  tableRelatedEntities: Map<string, Set<string>>;
  crossObjectEntities: EntityPlacement[];
  orphanEntities: EntityPlacement[];
}

// ─── UI representation types ───

export interface CalculatedFieldUI extends CalculatedField {
  placement: PlacementType;
  referencedObjects: string[];
  directReferences: ExpressionReference[];
  diffStatus?: DiffStatus;
}

export interface DimensionHierarchyUI extends DimensionHierarchy {
  placement: PlacementType;
  referencedObjects: string[];
  diffStatus?: DiffStatus;
}

export interface MetricUI extends Metric {
  placement: PlacementType;
  referencedObjects: string[];
  diffStatus?: DiffStatus;
}

export interface GroupingUI extends Grouping {
  placement: PlacementType;
  referencedObjects: string[];
  diffStatus?: DiffStatus;
}

export interface DataObjectUI extends DataObject {
  relatedCalculatedDimensions: CalculatedFieldUI[];
  relatedCalculatedMeasurements: CalculatedFieldUI[];
  relatedDimensionHierarchies: DimensionHierarchyUI[];
  relatedMetrics: MetricUI[];
  relatedGroupings: GroupingUI[];
  diffStatus?: DiffStatus;
}

export interface LogicalViewUI extends LogicalView {
  relatedCalculatedDimensions: CalculatedFieldUI[];
  relatedCalculatedMeasurements: CalculatedFieldUI[];
  relatedDimensionHierarchies: DimensionHierarchyUI[];
  relatedMetrics: MetricUI[];
  relatedGroupings: GroupingUI[];
  diffStatus?: DiffStatus;
}

export interface RelationshipUI extends Relationship {
  diffStatus?: DiffStatus;
}

export interface SemanticModelUI {
  model: SemanticModelMeta;
  dataObjects: DataObjectUI[];
  logicalViews: LogicalViewUI[];
  relationships: RelationshipUI[];
  crossObjectEntities: EntityPlacement[];
  orphanEntities: EntityPlacement[];
  parameters: Parameter[];
  modelInfo: ModelInfo;
  fieldsOverrides: FieldOverride[];
  modelFilters: ModelFilter[];
  calculatedFieldsByApiName: Map<string, CalculatedFieldUI>;
  allCalculatedDimensions: CalculatedFieldUI[];
  allCalculatedMeasurements: CalculatedFieldUI[];
  allDimensionHierarchies: DimensionHierarchyUI[];
  allMetrics: MetricUI[];
  allGroupings: GroupingUI[];
  isCompareMode?: boolean;
  isHistoryMode?: boolean;
  commits?: GitCommitInfo[];
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: string[];
}