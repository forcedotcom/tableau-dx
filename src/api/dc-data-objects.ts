/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import { callSalesforceApi, postSalesforceApi, SF_API_VERSION } from './index';

// ─── DC Data Object types (from /ssot/semantic/ui/cdp-data-objects) ──────────

export interface DCDimensionField {
  name: string;
  displayName: string;
  dataType: string;
  sortOrder?: string;
  displayCategory?: string;
  isVisible?: boolean;
  isPrimaryIndex?: boolean;
  keyQualifierName?: string;
  isAggregatable?: boolean;
  semanticDataType?: string;
  geoRole?: string;
  required?: boolean;
  id?: string;
}

export interface DCMeasurementField {
  name: string;
  displayName: string;
  dataType: string;
  aggregationType?: string;
  decimalPlace?: number;
  directionality?: string;
  shouldTreatNullsAsZeros?: boolean;
  sortOrder?: string;
  displayCategory?: string;
  isVisible?: boolean;
  isPrimaryIndex?: boolean;
  isAggregatable?: boolean;
  semanticDataType?: string;
  required?: boolean;
  id?: string;
}

export interface DCDataObject {
  name: string;
  displayName: string;
  description?: string;
  id?: string;
  dataSpaceName: string;
  dataObjectType: 'Dmo' | 'Dlo' | 'Cio';
  shouldIncludeAllFields: boolean;
  category: string;
  creationType: string;
  semanticDimensions: DCDimensionField[];
  semanticMeasurements: DCMeasurementField[];
}

export interface DCDataObjectsResponse {
  items: DCDataObject[];
  orgHierarchies?: unknown[];
}

// ─── Fetch available DC data objects ─────────────────────────────────────────

export const DC_PAGE_SIZE = 50;

export interface DCDataObjectsPage {
  items: DCDataObject[];
  hasMore: boolean;
}

export async function fetchDCDataObjectsPage(
  instanceUrl: string,
  accessToken: string,
  dataspace: string,
  dataObjectType?: 'Dmo' | 'Dlo' | 'Cio',
  offset = 0,
  limit = DC_PAGE_SIZE,
  search?: string,
  modelApiName?: string
): Promise<DCDataObjectsPage> {
  const params: Record<string, string> = {
    dataspace,
    limit: String(limit),
    offset: String(offset),
  };
  if (dataObjectType) { params.type = dataObjectType; }
  if (search) { params.search = search; }
  if (modelApiName) { params.model = modelApiName; }

  const response = await callSalesforceApi(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/ssot/semantic/ui/cdp-data-objects`,
    params
  ) as DCDataObjectsResponse;

  const items = response?.items ?? [];
  return { items, hasMore: items.length >= limit };
}

export async function fetchDCDataObjects(
  instanceUrl: string,
  accessToken: string,
  dataspace: string,
  dataObjectType?: 'Dmo' | 'Dlo' | 'Cio',
  search?: string,
  modelApiName?: string
): Promise<DCDataObject[]> {
  const allItems: DCDataObject[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchDCDataObjectsPage(
      instanceUrl, accessToken, dataspace, dataObjectType,
      offset, DC_PAGE_SIZE, search, modelApiName
    );
    allItems.push(...page.items);
    hasMore = page.hasMore;
    offset += DC_PAGE_SIZE;
  }

  return allItems;
}

// ─── Dataspace types & fetching ──────────────────────────────────────────────

export interface DataSpaceInfo {
  id: string;
  name: string;
  label: string;
  prefix: string;
  status: string;
}

interface DataSpaceCollectionResponse {
  totalSize: number;
  dataSpaces: DataSpaceInfo[];
  nextPageUrl?: string;
}

const DS_PAGE_SIZE = 200;

export async function fetchDataSpaces(
  instanceUrl: string,
  accessToken: string
): Promise<DataSpaceInfo[]> {
  const all: DataSpaceInfo[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await callSalesforceApi(
      instanceUrl,
      accessToken,
      `/services/data/${SF_API_VERSION}/ssot/data-spaces`,
      { batchSize: String(DS_PAGE_SIZE), offset: String(offset) }
    ) as DataSpaceCollectionResponse;

    const items = response?.dataSpaces ?? [];
    all.push(...items);

    if (items.length < DS_PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += DS_PAGE_SIZE;
    }
  }

  return all;
}

// ─── Create a new semantic model ─────────────────────────────────────────────

export async function createSemanticModel(
  instanceUrl: string,
  accessToken: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await postSalesforceApi(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/ssot/semantic/models?inheritDcRelationship=true`,
    payload
  );
  return result as Record<string, unknown>;
}
