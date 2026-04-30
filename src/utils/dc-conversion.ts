/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { DCDimensionField, DCMeasurementField } from '../api/dc-data-objects';

export interface SelectedObjectInfo {
  name: string;
  displayName: string;
  dataObjectType: string;
  shouldIncludeAllFields: boolean;
  selectedDimensions: string[];
  selectedMeasurements: string[];
  allDimensions: DCDimensionField[];
  allMeasurements: DCMeasurementField[];
}

/**
 * Sanitize a DC name into a valid semantic API name:
 * no double underscores, no leading/trailing underscores,
 * must start with a letter, only alphanumeric + single underscores.
 */
function toSemanticApiName(dcName: string): string {
  let s = dcName;
  // Collapse consecutive underscores to single
  while (s.includes('__')) s = s.replace(/__/g, '_');
  // Strip leading/trailing underscores
  s = s.replace(/^_+|_+$/g, '');
  // Ensure starts with a letter
  if (s && !/^[a-zA-Z]/.test(s)) s = 'x' + s;
  return s || dcName;
}

export function convertSelectedToDataObject(sel: SelectedObjectInfo): Record<string, unknown> {
  const selectedDimSet = new Set(sel.selectedDimensions);
  const selectedMeasSet = new Set(sel.selectedMeasurements);

  const dims = sel.allDimensions
    .filter(d => selectedDimSet.has(d.name))
    .map(d => ({
      apiName: toSemanticApiName(d.name),
      label: d.displayName,
      dataType: d.dataType,
      dataObjectFieldName: d.name,
      ...(d.semanticDataType ? { semanticDataType: d.semanticDataType } : {}),
      ...(d.displayCategory ? { displayCategory: d.displayCategory } : {}),
      ...(d.sortOrder ? { sortOrder: d.sortOrder } : {}),
    }));

  const meas = sel.allMeasurements
    .filter(m => selectedMeasSet.has(m.name))
    .map(m => ({
      apiName: toSemanticApiName(m.name),
      label: m.displayName,
      dataType: m.dataType,
      dataObjectFieldName: m.name,
      ...(m.aggregationType ? { aggregationType: m.aggregationType } : {}),
      ...(m.semanticDataType ? { semanticDataType: m.semanticDataType } : {}),
      ...(m.displayCategory ? { displayCategory: m.displayCategory } : {}),
      ...(m.decimalPlace != null ? { decimalPlace: m.decimalPlace } : {}),
      ...(m.directionality ? { directionality: m.directionality } : {}),
      ...(m.shouldTreatNullsAsZeros != null ? { shouldTreatNullsAsZeros: m.shouldTreatNullsAsZeros } : {}),
      ...(m.sortOrder ? { sortOrder: m.sortOrder } : {}),
    }));

  return {
    apiName: toSemanticApiName(sel.name),
    label: sel.displayName,
    dataObjectName: sel.name,
    dataObjectType: sel.dataObjectType,
    shouldIncludeAllFields: sel.shouldIncludeAllFields,
    autoCreateRowCountSystemCalc: true,
    semanticDimensions: dims,
    semanticMeasurements: meas,
  };
}

export function buildCreateModelPayload(
  apiName: string,
  label: string,
  dataspace: string,
  selectedObjects: SelectedObjectInfo[]
): Record<string, unknown> {
  return {
    apiName,
    label,
    dataspace,
    sourceCreation: 'DataCloud',
    semanticDataObjects: selectedObjects.map(convertSelectedToDataObject),
  };
}
