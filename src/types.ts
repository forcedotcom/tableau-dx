/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

export interface OrgInfo {
  status: number;
  result: {
    id: string;
    accessToken: string;
    instanceUrl: string;
    username: string;
    clientId: string;
    connectedStatus: string;
    alias?: string;
  };
}

export interface SemanticModel {
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
  semanticDataObjectsUrl: string;
  semanticRelationshipsUrl: string;
  semanticCalculatedDimensionsUrl: string;
  semanticCalculatedMeasurementsUrl: string;
  semanticGroupingsUrl: string;
  semanticParametersUrl: string;
  semanticDependenciesUrl?: string;
  semanticLogicalViewsUrl?: string;
}

export interface SemanticModelsResponse {
  count: number;
  total: number;
  currentPageUrl: string;
  nextPageUrl: string | null;
  previousPageUrl: string | null;
  items: SemanticModel[];
}

export interface Dimension {
  apiName: string;
  label: string;
  dataType?: string;
  dataObjectFieldName?: string;
}

export interface Measurement {
  apiName: string;
  label: string;
  dataType?: string;
  aggregation?: string;
  dataObjectFieldName?: string;
}

export interface DataObject {
  apiName: string;
  dataObjectName?: string;
  label: string;
  dataSourceObjectUrl?: string;
  dimensions?: Dimension[];
  measurements?: Measurement[];
  semanticDimensions?: Dimension[];
  semanticMeasurements?: Measurement[];
}

export interface Relationship {
  apiName: string;
  label: string;
  leftSemanticDefinitionApiName: string;
  rightSemanticDefinitionApiName: string;
  cardinality: string;
  joinType: string;
  isEnabled: boolean;
  criteria: Array<{
    joinOperator: string;
    leftSemanticFieldApiName: string;
    rightSemanticFieldApiName: string;
  }>;
}

export interface Grouping {
  apiName: string;
  label: string;
  type: string;
  fieldReference: {
    tableFieldReference?: {
      fieldApiName: string;
      tableApiName: string;
    };
  };
  configuration?: {
    groupDimension?: {
      groups: Array<{ name: string; values: string[] }>;
    };
  };
}

export interface DataObjectsResponse {
  items: DataObject[];
}

export interface RelationshipsResponse {
  items: Relationship[];
}

export interface UpdatePayload {
  // Model metadata
  dataspace?: string;
  label?: string;
  queryUnrelatedDataObjects?: string;
  businessPreferences?: string;
  // Entity arrays
  semanticDataObjects?: unknown[];
  semanticRelationships?: unknown[];
  semanticCalculatedDimensions?: unknown[];
  semanticCalculatedMeasurements?: unknown[];
  semanticGroupings?: unknown[];
  semanticParameters?: unknown[];
  semanticMetrics?: unknown[];
  semanticLogicalViews?: unknown[];
  semanticDimensionHierarchies?: unknown[];
  semanticModelFilters?: unknown[];
  semanticModelInfo?: unknown;
  baseModels?: unknown[];
  externalConnections?: unknown[];
  fieldsOverrides?: unknown[];
}