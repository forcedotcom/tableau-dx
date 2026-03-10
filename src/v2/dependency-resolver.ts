import {
  RawSemanticModel,
  DependencyGraph,
  EntityPlacement,
  EntityType,
  ExpressionReference,
  CalculatedField,
} from './types';
import { parseExpressionReferences } from './expression-parser';
import {
  extractHierarchyReferencedObjects,
  extractMetricReferencedObjects,
  extractGroupingReferencedObjects,
} from './reference-extractors';

interface CalcFieldResolution {
  apiName: string;
  entityType: EntityType;
  directReferences: ExpressionReference[];
  directObjectRefs: Set<string>;
  directCalcRefs: Set<string>;
  resolvedObjectRefs: Set<string>;
}

/**
 * Builds a complete dependency graph from a raw semantic model.
 * Resolves all entity references (including transitive calc→calc→object chains)
 * and computes placement (exclusive / crossObject / orphan) for every entity.
 */
export function buildDependencyGraph(rawModel: RawSemanticModel): DependencyGraph {
  const knownDataObjects = new Set(rawModel.dataObjects.map((o) => o.apiName));
  const knownLogicalViews = new Set(rawModel.logicalViews.map((lv) => lv.apiName));
  const knownParameters = new Set(rawModel.parameters.map((p) => p.apiName));

  const allCalcFields = [
    ...rawModel.calculatedDimensions.map((c) => ({ ...c, _entityType: 'calculatedDimension' as EntityType })),
    ...rawModel.calculatedMeasurements.map((c) => ({ ...c, _entityType: 'calculatedMeasurement' as EntityType })),
  ];
  const knownCalcFields = new Set(allCalcFields.map((c) => c.apiName));

  const knownTables = new Set([...knownDataObjects, ...knownLogicalViews]);

  // --- Phase 1: Parse calc field expressions and classify direct references ---
  const calcResolutions = new Map<string, CalcFieldResolution>();

  for (const calc of allCalcFields) {
    const directRefs = parseExpressionReferences(calc.expression);
    const directObjectRefs = new Set<string>();
    const directCalcRefs = new Set<string>();

    for (const ref of directRefs) {
      if (ref.objectApiName) {
        // [Object].[Field] pattern - the objectApiName is a table reference
        if (knownTables.has(ref.objectApiName)) {
          directObjectRefs.add(ref.objectApiName);
        }
      } else {
        // Standalone [X] - classify it
        const name = ref.fieldApiName;
        if (knownTables.has(name)) {
          directObjectRefs.add(name);
        } else if (knownCalcFields.has(name)) {
          directCalcRefs.add(name);
        }
        // parameters and unknowns are ignored for dependency analysis
      }
    }

    calcResolutions.set(calc.apiName, {
      apiName: calc.apiName,
      entityType: calc._entityType,
      directReferences: directRefs,
      directObjectRefs,
      directCalcRefs,
      resolvedObjectRefs: new Set<string>(),
    });
  }

  // --- Phase 2: Resolve transitive calc→calc→object chains ---
  for (const resolution of calcResolutions.values()) {
    resolveTransitive(resolution, calcResolutions, new Set());
  }

  // --- Phase 3: Build placements for ALL entity types ---
  const placements = new Map<string, EntityPlacement>();

  // Calc fields
  for (const resolution of calcResolutions.values()) {
    placements.set(resolution.apiName, {
      entityApiName: resolution.apiName,
      entityType: resolution.entityType,
      placement: computePlacement(resolution.resolvedObjectRefs),
      referencedObjects: Array.from(resolution.resolvedObjectRefs),
      directReferences: resolution.directReferences,
    });
  }

  // Dimension hierarchies
  for (const hierarchy of rawModel.dimensionHierarchies) {
    const refs = extractHierarchyReferencedObjects(hierarchy);
    placements.set(hierarchy.apiName, {
      entityApiName: hierarchy.apiName,
      entityType: 'dimensionHierarchy',
      placement: computePlacement(refs),
      referencedObjects: Array.from(refs),
    });
  }

  // Metrics
  for (const metric of rawModel.metrics) {
    const refs = extractMetricReferencedObjects(metric);
    placements.set(metric.apiName, {
      entityApiName: metric.apiName,
      entityType: 'metric',
      placement: computePlacement(refs),
      referencedObjects: Array.from(refs),
    });
  }

  // Groupings
  for (const grouping of rawModel.groupings) {
    const refs = extractGroupingReferencedObjects(grouping);
    placements.set(grouping.apiName, {
      entityApiName: grouping.apiName,
      entityType: 'grouping',
      placement: computePlacement(refs),
      referencedObjects: Array.from(refs),
    });
  }

  // --- Phase 4: Build lookup maps ---
  const tableRelatedEntities = new Map<string, Set<string>>();
  const crossObjectEntities: EntityPlacement[] = [];
  const orphanEntities: EntityPlacement[] = [];

  for (const p of placements.values()) {
    if (p.placement === 'crossObject') {
      crossObjectEntities.push(p);
    } else if (p.placement === 'orphan') {
      orphanEntities.push(p);
    }

    for (const objApiName of p.referencedObjects) {
      if (!tableRelatedEntities.has(objApiName)) {
        tableRelatedEntities.set(objApiName, new Set());
      }
      tableRelatedEntities.get(objApiName)!.add(p.entityApiName);
    }
  }

  return {
    placements,
    tableRelatedEntities,
    crossObjectEntities,
    orphanEntities,
  };
}

/**
 * Recursively resolves a calc field's transitive object dependencies.
 * Walks calc→calc references and collects all reachable data objects/LVs.
 */
function resolveTransitive(
  resolution: CalcFieldResolution,
  allResolutions: Map<string, CalcFieldResolution>,
  visited: Set<string>,
): Set<string> {
  if (resolution.resolvedObjectRefs.size > 0) {
    return resolution.resolvedObjectRefs;
  }

  if (visited.has(resolution.apiName)) {
    return resolution.resolvedObjectRefs;
  }
  visited.add(resolution.apiName);

  for (const objRef of resolution.directObjectRefs) {
    resolution.resolvedObjectRefs.add(objRef);
  }

  for (const calcRef of resolution.directCalcRefs) {
    const depResolution = allResolutions.get(calcRef);
    if (depResolution) {
      const transitiveDeps = resolveTransitive(depResolution, allResolutions, visited);
      for (const dep of transitiveDeps) {
        resolution.resolvedObjectRefs.add(dep);
      }
    }
  }

  return resolution.resolvedObjectRefs;
}

function computePlacement(refs: Set<string>): 'exclusive' | 'crossObject' | 'orphan' {
  if (refs.size === 0) {
    return 'orphan';
  }
  if (refs.size === 1) {
    return 'exclusive';
  }
  return 'crossObject';
}
