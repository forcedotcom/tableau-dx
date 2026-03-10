import { DimensionHierarchy, Metric, Grouping } from './types';

/**
 * Extracts referenced data object API names from a dimension hierarchy's levels.
 * Each level has a definitionApiName pointing to a data object.
 */
export function extractHierarchyReferencedObjects(hierarchy: DimensionHierarchy): Set<string> {
  const refs = new Set<string>();
  for (const level of hierarchy.levels ?? []) {
    if (level.definitionApiName) {
      refs.add(level.definitionApiName);
    }
  }
  return refs;
}

/**
 * Extracts referenced data object API names from a metric.
 * A metric can reference objects via measurementReference and timeDimensionReference.
 */
export function extractMetricReferencedObjects(metric: Metric): Set<string> {
  const refs = new Set<string>();

  const measTable = metric.measurementReference?.tableFieldReference?.tableApiName;
  if (measTable) {
    refs.add(measTable);
  }

  const timeTable = metric.timeDimensionReference?.tableFieldReference?.tableApiName;
  if (timeTable) {
    refs.add(timeTable);
  }

  return refs;
}

/**
 * Extracts the referenced data object API name from a grouping.
 * A grouping always references exactly one data object via fieldReference.
 */
export function extractGroupingReferencedObjects(grouping: Grouping): Set<string> {
  const refs = new Set<string>();
  const table = grouping.fieldReference?.tableFieldReference?.tableApiName;
  if (table) {
    refs.add(table);
  }
  return refs;
}
