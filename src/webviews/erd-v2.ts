/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as fs from 'fs';
import * as path from 'path';
import { SemanticModelUI } from '../v2/types';
import { escapeHtml } from '../utils/formatting';
import { sldsHead } from '../utils/webview-utils';
import { GroupsConfig } from '../utils/auto-group';

const SPLIT_DIR_BUNDLED = path.join(__dirname, 'webview-static');
const SPLIT_DIR_DEV = path.join(__dirname, '..', '..', 'src', 'webviews', 'erd-v2-split');
const SPLIT_DIR = fs.existsSync(SPLIT_DIR_BUNDLED) ? SPLIT_DIR_BUNDLED : SPLIT_DIR_DEV;

function readSplitFile(name: string): string {
  return fs.readFileSync(path.join(SPLIT_DIR, name), 'utf8');
}

export function getERDV2WebviewContent(
  modelUI: SemanticModelUI,
  icons: Record<string, string> = {},
  sldsUri: string = '',
  groupsConfig: GroupsConfig | null = null,
  viewMode: string = 'flat'
): string {
  const tableSvg = icons.table || '';
  const dataModelSvg = icons.data_model || '';
  const dataLakeSvg = icons.data_lake || '';
  const calcDimSvg = icons.calc_dim || '';
  const calcMesSvg = icons.calc_mes || '';
  const hierarchySvg = icons.hierarchy || '';
  const metricSvg = icons.metric || '';
  const groupingSvg = icons.grouping || '';
  const sharedSvg = icons.shared || '';
  const calcInsightSvg = icons.calc_insight || '';

  const baseModelLabels: Record<string, string> = {};
  (modelUI.model.baseModels || []).forEach(b => { baseModelLabels[b.apiName] = b.label; });

  // --- Build top-level nodes (data objects + logical views) ---
  const dataObjectNodes = modelUI.dataObjects.map((obj) => ({
    id: obj.apiName,
    label: obj.label,
    type: 'dataObject',
    dataObjectType: obj.dataObjectType || 'Dmo',
    dataObjectName: (obj as any).dataObjectName || obj.apiName,
    tableType: obj.tableType || 'Standard',
    baseModelApiName: obj.baseModelApiName || null,
    diffStatus: obj.diffStatus || null,
    unmapped: !!(obj as any).unmapped,
    dimCount: obj.semanticDimensions?.length ?? 0,
    measCount: obj.semanticMeasurements?.length ?? 0,
    dimensions: (obj.semanticDimensions ?? []).map(d => ({
      apiName: d.apiName, label: d.label, dataType: d.dataType ?? 'Text',
      dataObjectFieldName: d.dataObjectFieldName ?? d.apiName
    })),
    measurements: (obj.semanticMeasurements ?? []).map(m => ({
      apiName: m.apiName, label: m.label, dataType: m.dataType ?? 'Number',
      dataObjectFieldName: m.dataObjectFieldName ?? m.apiName
    })),
    relatedCalcDims: obj.relatedCalculatedDimensions.map(c => ({
      apiName: c.apiName, label: c.label, expression: c.expression,
      dataType: c.dataType ?? 'Calculated', placement: c.placement,
      referencedObjects: c.referencedObjects, isSystemDefinition: c.isSystemDefinition,
      baseModelApiName: c.baseModelApiName || null,
      diffStatus: c.diffStatus || null,
    })),
    relatedCalcMeas: obj.relatedCalculatedMeasurements.map(c => ({
      apiName: c.apiName, label: c.label, expression: c.expression,
      dataType: c.dataType ?? 'Calculated', placement: c.placement,
      referencedObjects: c.referencedObjects, isSystemDefinition: c.isSystemDefinition,
      baseModelApiName: c.baseModelApiName || null,
      diffStatus: c.diffStatus || null,
    })),
    relatedHierarchies: obj.relatedDimensionHierarchies.map(h => ({
      apiName: h.apiName, label: h.label, placement: h.placement,
      referencedObjects: h.referencedObjects,
      levels: h.levels.map(l => ({ definitionApiName: l.definitionApiName, definitionFieldName: l.definitionFieldName, position: l.position })),
      baseModelApiName: h.baseModelApiName || null,
      diffStatus: h.diffStatus || null,
    })),
    relatedMetrics: obj.relatedMetrics.map(m => ({
      apiName: m.apiName, label: m.label, placement: m.placement,
      referencedObjects: m.referencedObjects, aggregationType: m.aggregationType,
      measurementRef: m.measurementReference?.tableFieldReference
        ? { field: m.measurementReference.tableFieldReference.fieldApiName, table: m.measurementReference.tableFieldReference.tableApiName }
        : (m.measurementReference as any)?.calculatedFieldApiName
          ? { calcField: (m.measurementReference as any).calculatedFieldApiName } : null,
      timeDimRef: m.timeDimensionReference?.tableFieldReference
        ? { field: m.timeDimensionReference.tableFieldReference.fieldApiName, table: m.timeDimensionReference.tableFieldReference.tableApiName } : null,
      timeGrains: m.timeGrains ?? [],
      baseModelApiName: m.baseModelApiName || null,
      diffStatus: m.diffStatus || null,
    })),
    relatedGroupings: obj.relatedGroupings.map(g => ({
      apiName: g.apiName, label: g.label, placement: g.placement,
      referencedObjects: g.referencedObjects, type: g.type,
      fieldRef: g.fieldReference?.tableFieldReference
        ? { field: g.fieldReference.tableFieldReference.fieldApiName, table: g.fieldReference.tableFieldReference.tableApiName } : null,
      baseModelApiName: g.baseModelApiName || null,
      diffStatus: g.diffStatus || null,
    })),
  }));

  const logicalViewNodes = modelUI.logicalViews.map((lv) => {
    const lvDims: any[] = [];
    const lvMeas: any[] = [];
    (lv.semanticDataObjects ?? []).forEach(sdo => {
      (sdo.semanticDimensions ?? []).forEach(d => {
        if (!(d as any).unmapped) {
          lvDims.push({ apiName: d.apiName, label: d.label, dataType: d.dataType ?? 'Text', dataObjectFieldName: d.dataObjectFieldName ?? d.apiName, sourceObject: sdo.label || sdo.apiName });
        }
      });
      (sdo.semanticMeasurements ?? []).forEach(m => {
        if (!(m as any).unmapped) {
          lvMeas.push({ apiName: m.apiName, label: m.label, dataType: m.dataType ?? 'Number', dataObjectFieldName: m.dataObjectFieldName ?? m.apiName, sourceObject: sdo.label || sdo.apiName });
        }
      });
    });
    return {
    id: lv.apiName,
    label: lv.label,
    type: 'logicalView',
    tableType: lv.tableType || 'Standard',
    baseModelApiName: lv.baseModelApiName || null,
    diffStatus: lv.diffStatus || null,
    unmapped: !!(lv as any).unmapped,
    dimCount: lvDims.length, measCount: lvMeas.length,
    dimensions: lvDims, measurements: lvMeas,
    relatedCalcDims: lv.relatedCalculatedDimensions.map(c => ({
      apiName: c.apiName, label: c.label, expression: c.expression,
      dataType: c.dataType ?? 'Calculated', placement: c.placement,
      referencedObjects: c.referencedObjects, isSystemDefinition: c.isSystemDefinition,
      baseModelApiName: c.baseModelApiName || null,
      diffStatus: c.diffStatus || null,
    })),
    relatedCalcMeas: lv.relatedCalculatedMeasurements.map(c => ({
      apiName: c.apiName, label: c.label, expression: c.expression,
      dataType: c.dataType ?? 'Calculated', placement: c.placement,
      referencedObjects: c.referencedObjects, isSystemDefinition: c.isSystemDefinition,
      baseModelApiName: c.baseModelApiName || null,
      diffStatus: c.diffStatus || null,
    })),
    relatedHierarchies: lv.relatedDimensionHierarchies.map(h => ({
      apiName: h.apiName, label: h.label, placement: h.placement,
      referencedObjects: h.referencedObjects, levels: h.levels,
      baseModelApiName: h.baseModelApiName || null,
      diffStatus: h.diffStatus || null,
    })),
    relatedMetrics: lv.relatedMetrics.map(m => ({
      apiName: m.apiName, label: m.label, placement: m.placement,
      referencedObjects: m.referencedObjects, aggregationType: m.aggregationType,
      measurementRef: m.measurementReference?.tableFieldReference
        ? { field: m.measurementReference.tableFieldReference.fieldApiName, table: m.measurementReference.tableFieldReference.tableApiName }
        : (m.measurementReference as any)?.calculatedFieldApiName
          ? { calcField: (m.measurementReference as any).calculatedFieldApiName } : null,
      timeDimRef: m.timeDimensionReference?.tableFieldReference
        ? { field: m.timeDimensionReference.tableFieldReference.fieldApiName, table: m.timeDimensionReference.tableFieldReference.tableApiName } : null,
      timeGrains: m.timeGrains ?? [],
      baseModelApiName: m.baseModelApiName || null,
      diffStatus: m.diffStatus || null,
    })),
    relatedGroupings: lv.relatedGroupings.map(g => ({
      apiName: g.apiName, label: g.label, placement: g.placement,
      referencedObjects: g.referencedObjects, type: g.type,
      fieldRef: g.fieldReference?.tableFieldReference
        ? { field: g.fieldReference.tableFieldReference.fieldApiName, table: g.fieldReference.tableFieldReference.tableApiName } : null,
      baseModelApiName: g.baseModelApiName || null,
      diffStatus: g.diffStatus || null,
    })),
  };});

  // Infer LVs from relationships
  const allKnownNodeIds = new Set([...dataObjectNodes.map(n => n.id), ...logicalViewNodes.map(n => n.id)]);
  const inferredLVs: any[] = [];
  modelUI.relationships.forEach(rel => {
    for (const apiName of [rel.leftSemanticDefinitionApiName, rel.rightSemanticDefinitionApiName]) {
      if (!allKnownNodeIds.has(apiName)) {
        inferredLVs.push({
          id: apiName, label: apiName.replace(/_/g, ' '), type: 'logicalView',
          dimCount: 0, measCount: 0, dimensions: [], measurements: [],
          relatedCalcDims: [], relatedCalcMeas: [], relatedHierarchies: [],
          relatedMetrics: [], relatedGroupings: [],
        });
        allKnownNodeIds.add(apiName);
      }
    }
  });

  const allNodes = [...dataObjectNodes, ...logicalViewNodes, ...inferredLVs];

  const edges = modelUI.relationships.map(rel => {
    const criteria = rel.criteria?.[0];
    return {
      id: rel.apiName, from: rel.leftSemanticDefinitionApiName, to: rel.rightSemanticDefinitionApiName,
      label: rel.label, fromField: criteria?.leftSemanticFieldApiName ?? '',
      toField: criteria?.rightSemanticFieldApiName ?? '',
      cardinality: rel.cardinality, joinType: rel.joinType,
      diffStatus: (rel as any).diffStatus || null,
    };
  });

  const crossObjectEntities = modelUI.crossObjectEntities.map(e => ({
    entityApiName: e.entityApiName, entityType: e.entityType,
    placement: e.placement, referencedObjects: e.referencedObjects,
  }));

  const calcFieldsLookup: Record<string, any> = {};
  for (const c of modelUI.allCalculatedDimensions) {
    calcFieldsLookup[c.apiName] = {
      apiName: c.apiName, label: c.label, expression: c.expression,
      placement: c.placement, referencedObjects: c.referencedObjects,
      directReferences: c.directReferences, entityType: 'calculatedDimension',
      baseModelApiName: (c as any).baseModelApiName || null,
      diffStatus: (c as any).diffStatus || null,
    };
  }
  for (const c of modelUI.allCalculatedMeasurements) {
    calcFieldsLookup[c.apiName] = {
      apiName: c.apiName, label: c.label, expression: c.expression,
      placement: c.placement, referencedObjects: c.referencedObjects,
      directReferences: c.directReferences, entityType: 'calculatedMeasurement',
      baseModelApiName: (c as any).baseModelApiName || null,
      diffStatus: (c as any).diffStatus || null,
    };
  }

  const nodesJson = JSON.stringify(allNodes);
  const edgesJson = JSON.stringify(edges);
  const crossObjectJson = JSON.stringify(crossObjectEntities);
  const calcFieldsLookupJson = JSON.stringify(calcFieldsLookup);
  const baseModelLabelsJson = JSON.stringify(baseModelLabels);
  const isCompareModeVal = !!modelUI.isCompareMode;
  const isHistoryModeVal = !!modelUI.isHistoryMode;
  const commitsJson = JSON.stringify(modelUI.commits ?? []);
  const groupsConfigJson = groupsConfig ? JSON.stringify(groupsConfig) : 'null';
  const hasGroups = !!groupsConfig;
  const hasUnmappedNodes = allNodes.some((n: any) => n.unmapped);
  const hasBaseModelNodes = allNodes.some((n: any) => n.baseModelApiName);

  const countDMO = modelUI.dataObjects.filter((o: any) => !o.dataObjectType || o.dataObjectType === 'Dmo').length;
  const countDLO = modelUI.dataObjects.filter((o: any) => o.dataObjectType === 'Dlo').length;
  const countCI = modelUI.dataObjects.filter((o: any) => o.dataObjectType === 'Cio').length;
  const countLV = modelUI.logicalViews.length;
  const countRel = modelUI.relationships.length;
  const countBaseModel = allNodes.filter((n: any) => n.baseModelApiName).length;
  const countUnmapped = allNodes.filter((n: any) => n.unmapped).length;

  const totalCalcDims = modelUI.allCalculatedDimensions.length;
  const totalCalcMeas = modelUI.allCalculatedMeasurements.length;
  const totalHierarchies = modelUI.allDimensionHierarchies.length;
  const totalMetrics = modelUI.allMetrics.length;
  const totalGroupings = modelUI.allGroupings.length;
  const crossCount = modelUI.crossObjectEntities.length;

  // --- Read static assets from split dir ---
  const css = readSplitFile('erd-v2.css');
  const historyPanelHtml = isHistoryModeVal ? readSplitFile('erd-v2-history-panel.html') : '';
  const htmlShell = readSplitFile('erd-v2-shell.html');

  // Read the bundled ERD script (compiled from src/webviews/erd-v2-split/index.ts by esbuild).
  // Falls back to the monolithic erd-v2.js during development before the first build.
  const DIST_ERD_JS = path.join(__dirname, 'erd-v2.js');
  const DIST_ERD_JS_ALT = path.join(__dirname, '..', '..', 'dist', 'erd-v2.js');
  const LEGACY_ERD_JS = path.join(SPLIT_DIR, 'erd-v2.js');
  const jsPath = fs.existsSync(DIST_ERD_JS) ? DIST_ERD_JS
    : fs.existsSync(DIST_ERD_JS_ALT) ? DIST_ERD_JS_ALT
    : LEGACY_ERD_JS;
  // ESM build exports "export { initErd };" at the end — strip it so the script
  // runs as plain inline JS in the webview (initErd stays as a regular function in scope).
  const js = fs.readFileSync(jsPath, 'utf8').replace(/^export\s*\{[^}]*\};?\s*$/m, '');

  return `<!DOCTYPE html>
<html>
<head>
  ${sldsHead(sldsUri)}
  <style>${css}</style>
</head>
<body>
${htmlShell}
  <script>
    ${js}
    initErd(document.body, {
      nodes: ${nodesJson},
      edges: ${edgesJson},
      crossObjectEntities: ${crossObjectJson},
      calcFieldsLookup: ${calcFieldsLookupJson},
      baseModelLabels: ${baseModelLabelsJson},
      isCompareMode: ${isCompareModeVal},
      isHistoryMode: ${isHistoryModeVal},
      commits: ${commitsJson},
      groupsData: ${groupsConfigJson},
      hasGroups: ${hasGroups},
      hasUnmappedNodes: ${hasUnmappedNodes},
      initialViewMode: '${viewMode}',
      tableSvg: ${JSON.stringify(tableSvg)},
      dataModelSvg: ${JSON.stringify(dataModelSvg)},
      dataLakeSvg: ${JSON.stringify(dataLakeSvg)},
      calcDimSvg: ${JSON.stringify(calcDimSvg)},
      calcMesSvg: ${JSON.stringify(calcMesSvg)},
      hierarchySvg: ${JSON.stringify(hierarchySvg)},
      metricSvg: ${JSON.stringify(metricSvg)},
      groupingSvg: ${JSON.stringify(groupingSvg)},
      sharedSvg: ${JSON.stringify(sharedSvg)},
      calcInsightSvg: ${JSON.stringify(calcInsightSvg)},
      modelApiName: ${JSON.stringify(modelUI.model.apiName)},
      modelLabel: ${JSON.stringify(escapeHtml(modelUI.model.label))}
    }, false);
  </script>
  ${historyPanelHtml}
</body>
</html>`;
}