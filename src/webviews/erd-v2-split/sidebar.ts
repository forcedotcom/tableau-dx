import type { ErdContext, ErdNode } from './types';
import { diffBadgeHtml, escapeHtmlStr } from './utils';

export interface SidebarModule {
  openSidebar(nodeData: any): void;
  closeSidebar(): void;
  openEntitySidebar(ent: any): void;
  showCrossObjectEntities(): void;
  buildSidebarSection(dotClass: string, title: string, items: any[], renderItem: (item: any) => string): string;
  runQuery(): void;
  handleQueryResult(message: any): void;
  closeResults(): void;
}

export function createSidebarModule(ctx: ErdContext): SidebarModule {
  const entityTypes: Record<string, number> = { 'calc-dim': 1, 'calc-meas': 1, 'dim-hier': 1, 'metric': 1, 'grouping': 1 };

  function buildSidebarSection(dotClass: string, title: string, items: any[], renderItem: (item: any) => string): string {
    let html = '<div class="sidebar-section">';
    html += '<div class="sidebar-section-header">';
    html += '<span class="sidebar-section-title"><span class="dot ' + dotClass + '"></span> ' + title + '</span>';
    html += '<span class="sidebar-section-count">' + items.length + '</span>';
    html += '</div><div class="sidebar-section-body">';
    if (items.length === 0) {
      html += '<div class="empty-state">None</div>';
    } else {
      items.forEach(item => { html += '<div class="field-item">' + renderItem(item) + '</div>'; });
    }
    html += '</div></div>';
    return html;
  }

  function openSidebar(nodeData: any): void {
    ctx.updateEmbeddedBackBtnPosition();
    if (nodeData.type in entityTypes) {
      openEntitySidebar(nodeData);
      return;
    }
    const typeLabel = nodeData.type === 'logicalView' ? 'Logical View'
      : nodeData.dataObjectType === 'Cio' ? 'Calculated Insight'
      : nodeData.dataObjectType === 'Dlo' ? 'Data Lake Object'
      : 'Data Model Object';
    const sharedLabel = nodeData.tableType === 'Shared' ? ' <span class="sidebar-shared-badge">Shared Table</span>' : '';
    const baseLabel = nodeData.baseModelApiName ? ' <span class="sidebar-base-badge">Base: ' + (ctx.baseModelLabels[nodeData.baseModelApiName] || nodeData.baseModelApiName) + '</span>' : '';
    const unmappedLabel = nodeData.unmapped ? ' <span class="sidebar-unmapped-badge">Unmapped</span>' : '';

    (ctx.root.querySelector('#sidebar-title') as HTMLElement).innerHTML = nodeData.label + diffBadgeHtml(ctx, nodeData.diffStatus) + sharedLabel + baseLabel + unmappedLabel;
    (ctx.root.querySelector('#sidebar-type') as HTMLElement).textContent = typeLabel;
    (ctx.root.querySelector('#sidebar-api') as HTMLElement).textContent = nodeData.id;

    const content = ctx.root.querySelector('#sidebar-content') as HTMLElement;
    const dims = nodeData.dimensions || [];
    const meas = nodeData.measurements || [];
    const calcDims = (nodeData.relatedCalcDims || []).filter((c: any) => !c.isSystemDefinition);
    const calcMeas = (nodeData.relatedCalcMeas || []).filter((c: any) => !c.isSystemDefinition);
    const hiers = nodeData.relatedHierarchies || [];
    const metrics = nodeData.relatedMetrics || [];
    const groupings = nodeData.relatedGroupings || [];

    let html = '';
    const isLV = nodeData.type === 'logicalView';

    html += buildSidebarSection('dim', 'Dimensions', dims, (d: any) =>
      '<div><div class="field-name">' + (d.label || d.apiName) + '</div><div class="field-api">' + d.apiName + '</div>' +
      (isLV && d.sourceObject ? '<div class="field-source">from ' + d.sourceObject + '</div>' : '') +
      '</div><span class="field-type">' + (d.dataType || 'Text') + '</span>'
    );
    html += buildSidebarSection('meas', 'Measurements', meas, (m: any) =>
      '<div><div class="field-name">' + (m.label || m.apiName) + '</div><div class="field-api">' + m.apiName + '</div>' +
      (isLV && m.sourceObject ? '<div class="field-source">from ' + m.sourceObject + '</div>' : '') +
      '</div><span class="field-type">' + (m.dataType || 'Number') + '</span>'
    );
    if (calcDims.length > 0) {
      html += buildSidebarSection('calc', 'Calc Dimensions', calcDims, (c: any) =>
        '<div><div class="field-name">' + (c.label || c.apiName) + '</div><div class="field-api">' + c.apiName + '</div>' +
        (c.placement === 'crossObject' ? '<div class="field-placement cross">' + c.placement + '</div><div class="field-refs">→ ' + (c.referencedObjects || []).join(', ') + '</div>' : '') +
        '</div><span class="field-type">' + (c.dataType || 'Calc') + '</span>'
      );
    }
    if (calcMeas.length > 0) {
      html += buildSidebarSection('calc', 'Calc Measurements', calcMeas, (c: any) =>
        '<div><div class="field-name">' + (c.label || c.apiName) + '</div><div class="field-api">' + c.apiName + '</div>' +
        (c.placement === 'crossObject' ? '<div class="field-placement cross">' + c.placement + '</div><div class="field-refs">→ ' + (c.referencedObjects || []).join(', ') + '</div>' : '') +
        '</div><span class="field-type">' + (c.dataType || 'Calc') + '</span>'
      );
    }
    if (hiers.length > 0) {
      html += buildSidebarSection('hier', 'Dim Hierarchies', hiers, (h: any) =>
        '<div><div class="field-name">' + (h.label || h.apiName) + '</div><div class="field-api">' + h.apiName + '</div>' +
        (h.placement === 'crossObject' ? '<div class="field-placement cross">' + h.placement + '</div><div class="field-refs">→ ' + (h.referencedObjects || []).join(', ') + '</div>' : '') +
        '</div><span class="field-type">Hierarchy</span>'
      );
    }
    if (metrics.length > 0) {
      html += buildSidebarSection('met', 'Metrics', metrics, (m: any) =>
        '<div><div class="field-name">' + (m.label || m.apiName) + '</div><div class="field-api">' + m.apiName + '</div>' +
        (m.placement === 'crossObject' ? '<div class="field-placement cross">' + m.placement + '</div><div class="field-refs">→ ' + (m.referencedObjects || []).join(', ') + '</div>' : '') +
        '</div><span class="field-type">' + (m.aggregationType || 'Metric') + '</span>'
      );
    }
    if (groupings.length > 0) {
      html += buildSidebarSection('grp', 'Groupings', groupings, (g: any) =>
        '<div><div class="field-name">' + (g.label || g.apiName) + '</div><div class="field-api">' + g.apiName + '</div>' +
        '</div><span class="field-type">' + (g.type || 'Group') + '</span>'
      );
    }

    content.innerHTML = html;
    ctx.sidebar.classList.add('open');

    const actionsDiv = ctx.root.querySelector('#sidebar-actions') as HTMLElement;
    if ((nodeData.type === 'dataObject' || nodeData.type === 'logicalView') && (dims.length > 0 || meas.length > 0) && !nodeData.unmapped) {
      actionsDiv.style.display = 'block';
      ctx.currentQueryNode = nodeData;
    } else {
      actionsDiv.style.display = 'none';
      ctx.currentQueryNode = null;
    }
  }

  function openEntitySidebar(ent: any): void {
    const typeLabelMap: Record<string, string> = {
      'calc-dim': 'Calculated Dimension', 'calc-meas': 'Calculated Measurement',
      'dim-hier': 'Dimension Hierarchy', 'metric': 'Metric', 'grouping': 'Grouping',
    };

    const iconHtml = ctx.entitySvgIcons[ent.cssClass || ent.type]
      ? '<span class="entity-type-badge ' + (ent.cssClass || ent.type) + '">' + ctx.entitySvgIcons[ent.cssClass || ent.type] + ' ' + (typeLabelMap[ent.type] || ent.typeLabel || 'Entity') + '</span>'
      : '<span class="entity-type-badge ' + (ent.cssClass || ent.type) + '">' + (typeLabelMap[ent.type] || ent.typeLabel || 'Entity') + '</span>';

    const entBaseLabel = ent.baseModelApiName ? ' <span class="sidebar-base-badge">Base: ' + (ctx.baseModelLabels[ent.baseModelApiName] || ent.baseModelApiName) + '</span>' : '';
    (ctx.root.querySelector('#sidebar-title') as HTMLElement).innerHTML = (ent.label || ent.apiName) + diffBadgeHtml(ctx, ent.diffStatus) + entBaseLabel;
    (ctx.root.querySelector('#sidebar-type') as HTMLElement).innerHTML = iconHtml;
    (ctx.root.querySelector('#sidebar-api') as HTMLElement).textContent = ent.apiName;

    const content = ctx.root.querySelector('#sidebar-content') as HTMLElement;
    let html = '<div class="entity-detail">';

    if (ent.type === 'calc-dim' || ent.type === 'calc-meas') {
      const calcInfo = ctx.calcFieldsLookup[ent.apiName];
      if (ent.expression) {
        html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Expression</div>';
        html += '<div class="entity-expression">' + escapeHtmlStr(ent.expression) + '</div></div>';
      }
      html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Properties</div>';
      html += '<div class="entity-kv"><span class="entity-kv-label">Data Type</span><span class="entity-kv-value">' + (ent.dataType || 'N/A') + '</span></div>';
      if (ent.placement === 'crossObject') {
        html += '<div class="entity-kv"><span class="entity-kv-label">Placement</span><span class="entity-kv-value"><span class="entity-placement-badge crossObject">' + ent.placement + '</span></span></div>';
      }
      html += '</div>';

      const refs = ent.referencedObjects || [];
      if (refs.length > 0) {
        html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Referenced Objects</div><ul class="entity-ref-list">';
        refs.forEach((objApiName: string) => {
          const nd = ctx.nodes.find(n => n.id === objApiName);
          const lbl = nd ? nd.label : objApiName.replace(/_/g, ' ');
          html += '<li class="entity-ref-item"><span class="entity-ref-icon obj">O</span><div><div style="color:#080707;font-size:12px">' + lbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + objApiName + '</div></div></li>';
        });
        html += '</ul></div>';
      }

      if (calcInfo && calcInfo.directReferences && calcInfo.directReferences.length > 0) {
        html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Dependency Chain</div><div class="entity-chain">';
        const visited: Record<string, boolean> = {};
        visited[ent.apiName] = true;

        function buildChainTree(apiName: string): any[] {
          const children: any[] = [];
          const seen: Record<string, boolean> = {};
          const info = ctx.calcFieldsLookup[apiName];
          if (!info || !info.directReferences) return children;
          (info.directReferences as any[]).forEach(ref => {
            if (ref.objectApiName) {
              const key = ref.objectApiName + '.' + ref.fieldApiName;
              if (seen[key]) return; seen[key] = true;
              const nd2 = ctx.nodes.find(n => n.id === ref.objectApiName);
              const objLbl = nd2 ? nd2.label : ref.objectApiName.replace(/_/g, ' ');
              children.push({ name: objLbl + '.' + ref.fieldApiName, type: 'Object Field', children: [] });
            } else {
              const refName = ref.fieldApiName;
              if (seen[refName]) return; seen[refName] = true;
              const refCalc = ctx.calcFieldsLookup[refName];
              if (refCalc && !visited[refName]) {
                visited[refName] = true;
                const subChildren = buildChainTree(refName);
                children.push({ name: refCalc.label || refName, api: refName, type: (refCalc as any).entityType === 'calculatedDimension' ? 'Calc Dimension' : 'Calc Measurement', children: subChildren });
              } else if (!refCalc) {
                children.push({ name: refName, type: 'Parameter / Other', children: [] });
              }
            }
          });
          return children;
        }

        function renderChainNode(node: any, isRoot: boolean): void {
          html += '<div class="entity-chain-node' + (isRoot ? ' entity-chain-root' : '') + '">';
          html += '<div class="entity-chain-step' + (isRoot ? ' current' : '') + '"><div class="entity-chain-step-name">' + node.name + '</div>';
          if (node.api) html += '<div class="entity-chain-step-api">' + node.api + '</div>';
          html += '<div class="entity-chain-step-type">' + node.type + '</div></div>';
          if (node.children && node.children.length > 0) {
            node.children.forEach((child: any) => { renderChainNode(child, false); });
          }
          html += '</div>';
        }

        const rootChildren = buildChainTree(ent.apiName);
        const rootNode = { name: ent.label || ent.apiName, type: typeLabelMap[ent.type] || 'Calc', children: rootChildren };
        renderChainNode(rootNode, true);
        html += '</div></div>';
      }
    }

    if (ent.type === 'dim-hier') {
      const levels = ent.levels || [];
      if (levels.length > 0) {
        html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Hierarchy Levels (' + levels.length + ')</div>';
        levels.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
        levels.forEach((lvl: any) => {
          const fieldName = lvl.definitionFieldName || lvl.definitionApiName;
          const sourceName = lvl.definitionApiName || '';
          const nd3 = ctx.nodes.find(n => n.id === sourceName);
          const srcLabel = nd3 ? nd3.label : sourceName.replace(/_/g, ' ');
          html += '<div class="hier-level"><div class="hier-level-pos">' + (lvl.position || '?') + '</div>';
          html += '<div class="hier-level-info"><div class="hier-level-field">' + fieldName.replace(/_/g, ' ') + '</div><div class="hier-level-source">' + srcLabel + ' → ' + fieldName + '</div></div></div>';
        });
        html += '</div>';
      }
      html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Properties</div>';
      if (ent.placement === 'crossObject') { html += '<div class="entity-kv"><span class="entity-kv-label">Placement</span><span class="entity-kv-value"><span class="entity-placement-badge crossObject">' + ent.placement + '</span></span></div>'; }
      html += '<div class="entity-kv"><span class="entity-kv-label">Levels</span><span class="entity-kv-value">' + levels.length + '</span></div></div>';
      const hierRefs = ent.referencedObjects || [];
      if (hierRefs.length > 0) {
        html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Referenced Objects</div><ul class="entity-ref-list">';
        hierRefs.forEach((objApiName: string) => {
          const nd4 = ctx.nodes.find(n => n.id === objApiName);
          const lbl = nd4 ? nd4.label : objApiName.replace(/_/g, ' ');
          html += '<li class="entity-ref-item"><span class="entity-ref-icon obj">O</span><div><div style="color:#080707;font-size:12px">' + lbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + objApiName + '</div></div></li>';
        });
        html += '</ul></div>';
      }
    }

    if (ent.type === 'metric') {
      html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Properties</div>';
      html += '<div class="entity-kv"><span class="entity-kv-label">Aggregation</span><span class="entity-kv-value">' + (ent.aggregationType || 'N/A') + '</span></div>';
      if (ent.placement === 'crossObject') { html += '<div class="entity-kv"><span class="entity-kv-label">Placement</span><span class="entity-kv-value"><span class="entity-placement-badge crossObject">' + ent.placement + '</span></span></div>'; }
      html += '</div>';
      const metRefs = ent.referencedObjects || [];
      if (metRefs.length > 0) {
        html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Referenced Objects</div><ul class="entity-ref-list">';
        metRefs.forEach((objApiName: string) => {
          const nd5 = ctx.nodes.find(n => n.id === objApiName);
          const lbl = nd5 ? nd5.label : objApiName.replace(/_/g, ' ');
          html += '<li class="entity-ref-item"><span class="entity-ref-icon obj">O</span><div><div style="color:#080707;font-size:12px">' + lbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + objApiName + '</div></div></li>';
        });
        html += '</ul></div>';
      }
    }

    if (ent.type === 'grouping') {
      html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Properties</div>';
      html += '<div class="entity-kv"><span class="entity-kv-label">Grouping Type</span><span class="entity-kv-value">' + (ent.origType || 'N/A') + '</span></div>';
      if (ent.placement === 'crossObject') { html += '<div class="entity-kv"><span class="entity-kv-label">Placement</span><span class="entity-kv-value"><span class="entity-placement-badge crossObject">' + ent.placement + '</span></span></div>'; }
      html += '</div>';
      const grpRefs = ent.referencedObjects || [];
      if (grpRefs.length > 0) {
        html += '<div class="entity-detail-section"><div class="entity-detail-section-title">Referenced Objects</div><ul class="entity-ref-list">';
        grpRefs.forEach((objApiName: string) => {
          const nd6 = ctx.nodes.find(n => n.id === objApiName);
          const lbl = nd6 ? nd6.label : objApiName.replace(/_/g, ' ');
          html += '<li class="entity-ref-item"><span class="entity-ref-icon obj">O</span><div><div style="color:#080707;font-size:12px">' + lbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + objApiName + '</div></div></li>';
        });
        html += '</ul></div>';
      }
    }

    html += '</div>';
    content.innerHTML = html;
    ctx.sidebar.classList.add('open');
    const actionsDiv = ctx.root.querySelector('#sidebar-actions') as HTMLElement | null;
    if (actionsDiv) actionsDiv.style.display = 'none';
  }

  function closeSidebar(): void {
    ctx.sidebar.classList.remove('open');
    ctx.currentQueryNode = null;
    ctx.updateEmbeddedBackBtnPosition();
  }

  function showCrossObjectEntities(): void {
    (ctx.root.querySelector('#sidebar-title') as HTMLElement).textContent = 'Cross-Object Entities';
    (ctx.root.querySelector('#sidebar-type') as HTMLElement).textContent = 'Bridges between objects';
    (ctx.root.querySelector('#sidebar-api') as HTMLElement).textContent = ctx.crossObjectEntities.length + ' entities';

    const content = ctx.root.querySelector('#sidebar-content') as HTMLElement;
    let html = '';
    if (ctx.crossObjectEntities.length === 0) {
      html = '<div class="empty-state">No cross-object entities found</div>';
    } else {
      const typeMap: Record<string, string> = { calculatedDimension: 'Calc Dim', calculatedMeasurement: 'Calc Meas', dimensionHierarchy: 'Hierarchy', metric: 'Metric', grouping: 'Grouping' };
      html += '<div class="sidebar-section"><div class="sidebar-section-header"><span class="sidebar-section-title"><span class="dot calc"></span> Cross-Object</span>';
      html += '<span class="sidebar-section-count">' + ctx.crossObjectEntities.length + '</span></div><div class="sidebar-section-body">';
      ctx.crossObjectEntities.forEach(e => {
        html += '<div class="field-item"><div><div class="field-name">' + (e as any).entityApiName + '</div>';
        html += '<div class="field-placement cross">' + (typeMap[(e as any).entityType] || (e as any).entityType) + '</div>';
        html += '<div class="field-refs">→ ' + ((e as any).referencedObjects || []).join(', ') + '</div></div></div>';
      });
      html += '</div></div>';
    }
    content.innerHTML = html;
    ctx.sidebar.classList.add('open');
    const actionsDiv = ctx.root.querySelector('#sidebar-actions') as HTMLElement | null;
    if (actionsDiv) actionsDiv.style.display = 'none';
  }

  function runQuery(): void {
    if (!ctx.currentQueryNode) return;
    const btn = ctx.root.querySelector('#queryBtn') as HTMLButtonElement;
    btn.disabled = true; btn.textContent = 'Querying...';
    const dims = ctx.currentQueryNode.dimensions || [];
    const meas = ctx.currentQueryNode.measurements || [];
    const fields = [
      ...dims.map(d => ({ apiName: d.apiName, label: d.label, dataType: d.dataType, dataObjectFieldName: d.dataObjectFieldName, tableApiName: ctx.currentQueryNode!.id, fieldType: 'dimension' })),
      ...meas.map(m => ({ apiName: m.apiName, label: m.label, dataType: m.dataType, dataObjectFieldName: (m as any).dataObjectFieldName, tableApiName: ctx.currentQueryNode!.id, fieldType: 'measurement' })),
    ];
    ctx.vscode.postMessage({ command: 'runSemanticQuery', nodeId: ctx.currentQueryNode.id, nodeLabel: ctx.currentQueryNode.label, nodeType: ctx.currentQueryNode.type, dataObjectName: ctx.currentQueryNode.dataObjectName || ctx.currentQueryNode.id, fields });
    (ctx.root.querySelector('#resultsBody') as HTMLElement).innerHTML = '<div class="results-loading">Running query...</div>';
    (ctx.root.querySelector('#resultsPanel') as HTMLElement).classList.add('open');
  }

  function handleQueryResult(message: any): void {
    const btn = ctx.root.querySelector('#queryBtn') as HTMLButtonElement;
    btn.disabled = false; btn.textContent = 'Query Sample Data';
    const body = ctx.root.querySelector('#resultsBody') as HTMLElement;
    const rowCountEl = ctx.root.querySelector('#rowCount') as HTMLElement | null;

    if (!message.success) {
      body.innerHTML = '<div class="results-error">' + escapeHtmlStr(message.error || 'Unknown error') + '</div>';
      if (rowCountEl) rowCountEl.textContent = 'Error';
      return;
    }

    const data = message.data;
    if (data.status !== 'SUCCESS' || !data.queryResults) {
      body.innerHTML = '<div class="results-error">Query failed: ' + escapeHtmlStr(data.message || 'Unknown') + '</div>';
      return;
    }

    const metadata = data.queryResults.queryMetadata?.fields || {};
    const rows = data.queryResults.queryData?.rows || [];
    const fieldLabels = message.fieldLabels || {};

    const columns = Object.entries(metadata)
      .sort((a: any, b: any) => a[1].placeInOrder - b[1].placeInOrder)
      .map(([name, info]: [string, any]) => ({ name, type: info.type, label: fieldLabels[name] || name }));

    if (columns.length === 0 || rows.length === 0) {
      body.innerHTML = '<div class="results-loading">No data returned</div>';
      if (rowCountEl) rowCountEl.textContent = '0 rows';
      return;
    }

    let html = '<table class="results-table"><thead><tr>';
    columns.forEach(c => { html += '<th>' + escapeHtmlStr(c.label) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach((r: any) => {
      html += '<tr>';
      r.values.forEach((v: any) => {
        html += '<td>' + (v === null ? '<em style="color:#706e6b">null</em>' : escapeHtmlStr(String(v))) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
    if (rowCountEl) rowCountEl.textContent = rows.length + ' rows';
  }

  function closeResults(): void {
    const panel = ctx.root.querySelector('#resultsPanel') as HTMLElement | null;
    if (panel) panel.classList.remove('open');
  }

  return { openSidebar, closeSidebar, openEntitySidebar, showCrossObjectEntities, buildSidebarSection, runQuery, handleQueryResult, closeResults };
}
