/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import {
  RawSemanticModel,
  DependencyGraph,
  SemanticModelUI,
  DataObjectUI,
  LogicalViewUI,
  CalculatedFieldUI,
  DimensionHierarchyUI,
  MetricUI,
  GroupingUI,
  RelationshipUI,
  EntityPlacement,
  DiffStatus,
} from './types';

/**
 * Builds the enriched UI representation from a raw model + dependency graph.
 *
 * Each DataObjectUI / LogicalViewUI carries ALL entities that touch it
 * (both exclusive and cross-object), so the drill-down view can show
 * everything related to a given object.
 */
export function buildSemanticModelUI(
  rawModel: RawSemanticModel,
  depGraph: DependencyGraph,
): SemanticModelUI {

  // --- Build enriched entity lists with placement info ---

  const allCalcDims: CalculatedFieldUI[] = rawModel.calculatedDimensions.map((c) => {
    const p = depGraph.placements.get(c.apiName);
    return {
      ...c,
      placement: p?.placement ?? 'orphan',
      referencedObjects: p?.referencedObjects ?? [],
      directReferences: p?.directReferences ?? [],
    };
  });

  const allCalcMeas: CalculatedFieldUI[] = rawModel.calculatedMeasurements.map((c) => {
    const p = depGraph.placements.get(c.apiName);
    return {
      ...c,
      placement: p?.placement ?? 'orphan',
      referencedObjects: p?.referencedObjects ?? [],
      directReferences: p?.directReferences ?? [],
    };
  });

  const allDimHierarchies: DimensionHierarchyUI[] = rawModel.dimensionHierarchies.map((h) => {
    const p = depGraph.placements.get(h.apiName);
    return {
      ...h,
      placement: p?.placement ?? 'orphan',
      referencedObjects: p?.referencedObjects ?? [],
    };
  });

  const allMetrics: MetricUI[] = rawModel.metrics.map((m) => {
    const p = depGraph.placements.get(m.apiName);
    return {
      ...m,
      placement: p?.placement ?? 'orphan',
      referencedObjects: p?.referencedObjects ?? [],
    };
  });

  const allGroupings: GroupingUI[] = rawModel.groupings.map((g) => {
    const p = depGraph.placements.get(g.apiName);
    return {
      ...g,
      placement: p?.placement ?? 'orphan',
      referencedObjects: p?.referencedObjects ?? [],
    };
  });

  // --- Build lookup maps by apiName ---

  const calcDimsByName = new Map(allCalcDims.map((c) => [c.apiName, c]));
  const calcMeasByName = new Map(allCalcMeas.map((c) => [c.apiName, c]));
  const dimHierByName = new Map(allDimHierarchies.map((h) => [h.apiName, h]));
  const metricByName = new Map(allMetrics.map((m) => [m.apiName, m]));
  const groupingByName = new Map(allGroupings.map((g) => [g.apiName, g]));

  const calculatedFieldsByApiName = new Map<string, CalculatedFieldUI>();
  for (const c of allCalcDims) { calculatedFieldsByApiName.set(c.apiName, c); }
  for (const c of allCalcMeas) { calculatedFieldsByApiName.set(c.apiName, c); }

  // --- Attach related entities to each data object ---

  function buildRelatedEntities(objectApiName: string) {
    const relatedEntityNames = depGraph.tableRelatedEntities.get(objectApiName) ?? new Set();

    const relatedCalcDims: CalculatedFieldUI[] = [];
    const relatedCalcMeas: CalculatedFieldUI[] = [];
    const relatedHierarchies: DimensionHierarchyUI[] = [];
    const relatedMetrics: MetricUI[] = [];
    const relatedGroupings: GroupingUI[] = [];

    for (const entityName of relatedEntityNames) {
      if (calcDimsByName.has(entityName)) {
        relatedCalcDims.push(calcDimsByName.get(entityName)!);
      } else if (calcMeasByName.has(entityName)) {
        relatedCalcMeas.push(calcMeasByName.get(entityName)!);
      } else if (dimHierByName.has(entityName)) {
        relatedHierarchies.push(dimHierByName.get(entityName)!);
      } else if (metricByName.has(entityName)) {
        relatedMetrics.push(metricByName.get(entityName)!);
      } else if (groupingByName.has(entityName)) {
        relatedGroupings.push(groupingByName.get(entityName)!);
      }
    }

    return {
      relatedCalculatedDimensions: relatedCalcDims,
      relatedCalculatedMeasurements: relatedCalcMeas,
      relatedDimensionHierarchies: relatedHierarchies,
      relatedMetrics: relatedMetrics,
      relatedGroupings: relatedGroupings,
    };
  }

  const dataObjects: DataObjectUI[] = rawModel.dataObjects.map((obj) => {
    const related = buildRelatedEntities(obj.apiName);
    const ownDiff = (obj as any).diffStatus as DiffStatus | undefined;
    let effectiveDiff = ownDiff;
    if (effectiveDiff === 'unchanged' || !effectiveDiff) {
      const allChildren = [
        ...related.relatedCalculatedDimensions,
        ...related.relatedCalculatedMeasurements,
        ...related.relatedDimensionHierarchies,
        ...related.relatedMetrics,
        ...related.relatedGroupings,
      ];
      if (allChildren.some(c => c.diffStatus && c.diffStatus !== 'unchanged')) {
        effectiveDiff = 'modified';
      }
    }
    return { ...obj, ...related, diffStatus: effectiveDiff };
  });

  const logicalViews: LogicalViewUI[] = rawModel.logicalViews.map((lv) => {
    const related = buildRelatedEntities(lv.apiName);
    const ownDiff = (lv as any).diffStatus as DiffStatus | undefined;
    let effectiveDiff = ownDiff;
    if (effectiveDiff === 'unchanged' || !effectiveDiff) {
      const allChildren = [
        ...related.relatedCalculatedDimensions,
        ...related.relatedCalculatedMeasurements,
        ...related.relatedDimensionHierarchies,
        ...related.relatedMetrics,
        ...related.relatedGroupings,
      ];
      if (allChildren.some(c => c.diffStatus && c.diffStatus !== 'unchanged')) {
        effectiveDiff = 'modified';
      }
    }
    return { ...lv, ...related, diffStatus: effectiveDiff };
  });

  const relationships: RelationshipUI[] = rawModel.relationships.map(r => ({
    ...r,
    diffStatus: (r as any).diffStatus as DiffStatus | undefined,
  }));

  const crossObjectEntities: EntityPlacement[] = depGraph.crossObjectEntities;
  const orphanEntities: EntityPlacement[] = depGraph.orphanEntities;

  return {
    model: rawModel.model,
    dataObjects,
    logicalViews,
    relationships,
    crossObjectEntities,
    orphanEntities,
    parameters: rawModel.parameters,
    modelInfo: rawModel.modelInfo,
    fieldsOverrides: rawModel.fieldsOverrides,
    modelFilters: rawModel.modelFilters,
    calculatedFieldsByApiName,
    allCalculatedDimensions: allCalcDims,
    allCalculatedMeasurements: allCalcMeas,
    allDimensionHierarchies: allDimHierarchies,
    allMetrics: allMetrics,
    allGroupings: allGroupings,
  };
}