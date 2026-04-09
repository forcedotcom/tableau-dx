/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import { SemanticModelUI } from '../v2/types';
import { escapeHtml } from '../utils/formatting';
import { sldsHead } from '../utils/webview-utils';

export function getTestModelWebviewContent(modelUI: SemanticModelUI, sldsUri: string, cspSource: string = ''): string {

  // Build field tree: objects -> (dims, meas, calcDims, calcMeas)
  const objectTree: any[] = [];

  for (const obj of modelUI.dataObjects.filter((o: any) => !o.unmapped)) {
    const sysDims = obj.relatedCalculatedDimensions.filter(c => c.isSystemDefinition).map(c => ({
      apiName: c.apiName, label: c.label, dataType: c.dataType ?? 'Text',
      tableApiName: obj.apiName, fieldType: 'dimension', category: 'Dimensions',
    }));
    const sysMeas = obj.relatedCalculatedMeasurements.filter(c => c.isSystemDefinition).map(c => ({
      apiName: c.apiName, label: c.label, dataType: c.dataType ?? 'Number',
      tableApiName: obj.apiName, fieldType: 'measurement', category: 'Measurements',
      aggregationType: c.aggregationType ?? 'Sum',
    }));
    const dims = [
      ...(obj.semanticDimensions ?? []).filter((d: any) => !d.unmapped).map(d => ({
        apiName: d.apiName, label: d.label, dataType: d.dataType ?? 'Text',
        tableApiName: obj.apiName, fieldType: 'dimension', category: 'Dimensions',
      })),
      ...sysDims,
    ];
    const meas = [
      ...(obj.semanticMeasurements ?? []).filter((m: any) => !m.unmapped).map(m => ({
        apiName: m.apiName, label: m.label, dataType: m.dataType ?? 'Number',
        tableApiName: obj.apiName, fieldType: 'measurement', category: 'Measurements',
        aggregationType: m.aggregationType ?? 'Sum',
      })),
      ...sysMeas,
    ];
    const calcDims = obj.relatedCalculatedDimensions
      .filter(c => !c.isSystemDefinition)
      .map(c => ({
        apiName: c.apiName, label: c.label, dataType: c.dataType ?? 'Calculated',
        tableApiName: obj.apiName, fieldType: 'calcDimension', category: 'Calc Dimensions',
        placement: c.placement, expression: c.expression,
      }));
    const calcMeas = obj.relatedCalculatedMeasurements
      .filter(c => !c.isSystemDefinition)
      .map(c => ({
        apiName: c.apiName, label: c.label, dataType: c.dataType ?? 'Calculated',
        tableApiName: obj.apiName, fieldType: 'calcMeasurement', category: 'Calc Measurements',
        placement: c.placement, expression: c.expression,
      }));

    objectTree.push({
      apiName: obj.apiName, label: obj.label, type: 'dataObject',
      dataObjectType: obj.dataObjectType || '',
      baseModelApiName: (obj as any).baseModelApiName || null,
      groups: [
        { category: 'Dimensions', fields: dims, dotClass: 'dim' },
        { category: 'Measurements', fields: meas, dotClass: 'meas' },
        ...(calcDims.length > 0 ? [{ category: 'Calc Dimensions', fields: calcDims, dotClass: 'calc-dim' }] : []),
        ...(calcMeas.length > 0 ? [{ category: 'Calc Measurements', fields: calcMeas, dotClass: 'calc-meas' }] : []),
      ],
    });
  }

  for (const lv of modelUI.logicalViews.filter((v: any) => !v.unmapped)) {
    const lvDims: any[] = [];
    const lvMeas: any[] = [];
    ((lv as any).semanticDataObjects ?? []).forEach((sdo: any) => {
      (sdo.semanticDimensions ?? []).forEach((d: any) => {
        if (!(d as any).unmapped) {
          lvDims.push({
            apiName: d.apiName, label: d.label, dataType: d.dataType ?? 'Text',
            tableApiName: lv.apiName, fieldType: 'dimension', category: 'Dimensions',
          });
        }
      });
      (sdo.semanticMeasurements ?? []).forEach((m: any) => {
        if (!(m as any).unmapped) {
          lvMeas.push({
            apiName: m.apiName, label: m.label, dataType: m.dataType ?? 'Number',
            tableApiName: lv.apiName, fieldType: 'measurement', category: 'Measurements',
            aggregationType: m.aggregationType ?? 'Sum',
          });
        }
      });
    });

    lv.relatedCalculatedDimensions.filter(c => c.isSystemDefinition).forEach(c => {
      lvDims.push({ apiName: c.apiName, label: c.label, dataType: c.dataType ?? 'Text',
        tableApiName: lv.apiName, fieldType: 'dimension', category: 'Dimensions' });
    });
    lv.relatedCalculatedMeasurements.filter(c => c.isSystemDefinition).forEach(c => {
      lvMeas.push({ apiName: c.apiName, label: c.label, dataType: c.dataType ?? 'Number',
        tableApiName: lv.apiName, fieldType: 'measurement', category: 'Measurements',
        aggregationType: c.aggregationType ?? 'Sum' });
    });
    const calcDims = lv.relatedCalculatedDimensions
      .filter(c => !c.isSystemDefinition)
      .map(c => ({
        apiName: c.apiName, label: c.label, dataType: c.dataType ?? 'Calculated',
        tableApiName: lv.apiName, fieldType: 'calcDimension', category: 'Calc Dimensions',
        placement: c.placement, expression: c.expression,
      }));
    const calcMeas = lv.relatedCalculatedMeasurements
      .filter(c => !c.isSystemDefinition)
      .map(c => ({
        apiName: c.apiName, label: c.label, dataType: c.dataType ?? 'Calculated',
        tableApiName: lv.apiName, fieldType: 'calcMeasurement', category: 'Calc Measurements',
        placement: c.placement, expression: c.expression,
      }));

    const groups: any[] = [];
    if (lvDims.length > 0) { groups.push({ category: 'Dimensions', fields: lvDims, dotClass: 'dim' }); }
    if (lvMeas.length > 0) { groups.push({ category: 'Measurements', fields: lvMeas, dotClass: 'meas' }); }
    if (calcDims.length > 0) { groups.push({ category: 'Calc Dimensions', fields: calcDims, dotClass: 'calc-dim' }); }
    if (calcMeas.length > 0) { groups.push({ category: 'Calc Measurements', fields: calcMeas, dotClass: 'calc-meas' }); }

    if (groups.length > 0) {
      objectTree.push({
        apiName: lv.apiName, label: lv.label, type: 'logicalView',
        baseModelApiName: (lv as any).baseModelApiName || null,
        groups,
      });
    }
  }

  const objectTreeJson = JSON.stringify(objectTree);
  const modelLabel = modelUI.model.label || modelUI.model.apiName;
  const modelApiName = modelUI.model.apiName;

  const customStyles = `
    html, body { height: 100%; margin: 0; overflow: hidden; }
    .slds-scope { height: 100%; display: flex; flex-direction: column; }

    .main-layout { display: flex; flex: 1; overflow: hidden; }

    /* Left panel: field selector */
    .left-panel {
      width: 340px; min-width: 280px; border-right: 1px solid var(--slds-g-color-border-base-1, #e5e5e5);
      display: flex; flex-direction: column;
    }
    .field-tree { flex: 1; overflow-y: auto; padding: 0.25rem 0; }

    /* Object group */
    .object-group { border-bottom: 1px solid var(--slds-g-color-border-base-1, #e5e5e5); }
    .object-header {
      padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
    }
    .object-header:hover { background: var(--slds-g-color-neutral-base-95, #f3f3f3); }
    .object-chevron { font-size: 10px; color: var(--slds-g-color-neutral-base-50, #747474); transition: transform 0.2s; width: 14px; text-align: center; }
    .object-chevron.open { transform: rotate(90deg); }
    .object-icon {
      width: 32px; height: 20px; border-radius: 4px; display: flex; align-items: center;
      justify-content: center; font-size: 9px; font-weight: 700; flex-shrink: 0;
    }
    .object-icon.dmo { background: #FF538A; color: #ffffff; }
    .object-icon.dlo { background: #5A1BA9; color: #ffffff; }
    .object-icon.lv { background: #FF5D2D; color: #ffffff; }
    .object-icon.base-model {
      position: relative; overflow: hidden;
    }
    .object-icon.base-model::after {
      content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.25) 3px, rgba(255,255,255,0.25) 6px);
      border-radius: 4px; pointer-events: none;
    }
    .object-name { font-size: 13px; font-weight: 600; flex: 1; color: #080707; }
    .object-count { font-size: 10px; color: var(--slds-g-color-neutral-base-50, #747474); background: var(--slds-g-color-neutral-base-95, #f3f3f3); padding: 1px 6px; border-radius: 8px; }
    .object-body { display: none; padding-bottom: 0.25rem; }
    .object-body.open { display: block; }

    /* Category sub-group */
    .category-header {
      padding: 0.25rem 1rem 0.25rem 2.75rem; font-size: 10px; font-weight: 600; color: var(--slds-g-color-neutral-base-50, #747474);
      text-transform: uppercase; letter-spacing: 0.8px; display: flex; align-items: center; gap: 6px;
    }
    .cat-dot { width: 6px; height: 6px; border-radius: 50%; }
    .cat-dot.dim { background: #0176d3; }
    .cat-dot.meas { background: #0b827c; }
    .cat-dot.calc-dim { background: #0b5cab; }
    .cat-dot.calc-meas { background: #06a59a; }

    /* Field item */
    .field-item {
      padding: 0.35rem 1rem 0.35rem 2.75rem; display: flex; align-items: center; gap: 0.5rem;
      cursor: pointer;
    }
    .field-item:hover { background: var(--slds-g-color-neutral-base-95, #f3f3f3); }
    .field-item.selected { background: var(--slds-g-color-brand-base-95, #eef4ff); }
    .field-cb {
      width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid var(--slds-g-color-neutral-base-50, #747474);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: all 0.15s; font-size: 10px; color: transparent;
    }
    .field-item.selected .field-cb { background: #0070d2; border-color: #0070d2; color: #fff; }
    .field-label { font-size: 12.5px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; color: #181818; }
    .field-type-tag { font-size: 9px; padding: 1px 6px; border-radius: 3px; color: var(--slds-g-color-neutral-base-50, #747474); background: var(--slds-g-color-neutral-base-95, #f3f3f3); }
    .field-placement-tag { font-size: 8px; padding: 1px 5px; border-radius: 3px; font-weight: 600; text-transform: uppercase; }
    .field-placement-tag.exclusive { background: #d1fae5; color: #065f46; }
    .field-placement-tag.crossObject { background: #fef3c7; color: #92400e; }

    /* Page header overrides */
    .slds-page-header { background: #ffffff; border-bottom: 1px solid #d8dde6; }
    .slds-page-header__title { color: #080707 !important; font-weight: 700; }
    .slds-page-header__name-meta { color: #3e3e3c !important; }

    /* Right panel */
    .right-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .sample-size-bar {
      display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;
      padding: 0.4rem 1rem;
    }
    .sample-size-label { font-size: 12px; color: #3e3e3c; white-space: nowrap; }
    .sample-size-bar .slds-select_container { width: 80px; }

    /* Results area */
    .results-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .results-status-bar {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem;
      background: #f4f6f9; border-bottom: 1px solid #d8dde6;
    }
    .results-status-label { font-size: 12px; font-weight: 600; color: #3e3e3c; display: flex; align-items: center; }
    .results-status-count {
      font-size: 11px; font-weight: 700; color: #0070d2; background: #eef4ff;
      padding: 2px 10px; border-radius: 10px;
    }
    .results-status-time { font-size: 11px; color: #706e6b; margin-left: auto; }

    /* Empty state */
    .empty-state {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;
      background: linear-gradient(180deg, #f9fafb 0%, #f4f6f9 100%);
    }
    .empty-icon { font-size: 48px; opacity: 0.35; }
    .empty-title { font-size: 16px; color: #3e3e3c; font-weight: 600; }
    .empty-desc { font-size: 13px; color: #706e6b; max-width: 300px; text-align: center; line-height: 1.6; }

    /* Loading overlay */
    .loading-overlay {
      position: absolute; inset: 0; background: rgba(244,246,249,0.9); display: flex;
      align-items: center; justify-content: center; z-index: 10; flex-direction: column; gap: 0.75rem;
      backdrop-filter: blur(2px);
    }

    /* Error */
    .error-box { margin: 1rem; }
    .error-box .slds-notify { border-radius: 6px; }

    /* Table */
    .table-container { flex: 1; overflow: auto; position: relative; }
    .data-table { border-collapse: separate; border-spacing: 0; }
    .data-table thead { position: sticky; top: 0; z-index: 2; }
    .data-table th {
      cursor: pointer; user-select: none; white-space: nowrap;
      background: #f4f6f9 !important; color: #080707 !important;
      font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
      border-bottom: 2px solid #d8dde6 !important; padding: 0.55rem 0.75rem !important;
    }
    .data-table th:hover { background: #eef1f6 !important; }
    .data-table th .sort-icon { margin-left: 5px; font-size: 9px; opacity: 0.35; }
    .data-table th.sorted { background: #eef4ff !important; color: #0070d2 !important; }
    .data-table th.sorted .sort-icon { opacity: 1; color: #0070d2; }
    .data-table td {
      max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      padding: 0.5rem 0.75rem !important; font-size: 12.5px; color: #181818;
      border-bottom: 1px solid #e5e5e5 !important;
    }
    .data-table tbody tr { transition: background 0.12s; }
    .data-table tbody tr:hover { background-color: #f3f7fb !important; }
    .data-table tbody tr:nth-child(even) { background-color: #fafbfc; }
    .data-table tbody tr:nth-child(even):hover { background-color: #f3f7fb !important; }
    .null-val { color: #b0adab !important; font-style: italic; font-size: 11.5px; }
    .num-val { font-family: 'SF Mono', Menlo, Consolas, monospace; text-align: right; color: #032d60; font-size: 12px; }

    /* Query preview */
    .query-preview { border-top: 1px solid #d8dde6; max-height: 0; overflow: hidden; transition: max-height 0.3s; }
    .query-preview.open { max-height: 300px; }
    .query-preview-toggle {
      padding: 0.5rem 1.25rem; border-top: 1px solid #d8dde6;
      font-size: 11px; font-weight: 600; color: #0070d2; cursor: pointer; display: flex; align-items: center; gap: 6px;
      background: #f4f6f9;
    }
    .query-preview-toggle:hover { background: #eef1f6; }
    .query-code {
      padding: 1rem 1.25rem; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 11px;
      white-space: pre-wrap; word-break: break-all; overflow-y: auto; max-height: 260px; line-height: 1.7;
      background: #fafbfc; color: #181818;
    }

    /* Resizer */
    .resizer { width: 4px; cursor: col-resize; background: transparent; transition: background 0.2s; flex-shrink: 0; }
    .resizer:hover, .resizer.active { background: #0070d2; }
  `;

  return `<!DOCTYPE html>
<html>
<head>
  ${sldsHead(sldsUri, customStyles, cspSource)}
</head>
<body>
  <div class="slds-scope">
    <div class="slds-page-header slds-m-top_small" role="banner">
      <div class="slds-page-header__row">
        <div class="slds-page-header__col-title">
          <div class="slds-media">
            <div class="slds-media__body">
              <div class="slds-page-header__name">
                <div class="slds-page-header__name-title">
                  <h1><span class="slds-page-header__title slds-truncate">Test Model: ${escapeHtml(modelLabel)}</span></h1>
                </div>
              </div>
              <p class="slds-page-header__name-meta">
                <span class="slds-badge" id="selectedCount">0 fields selected</span>
              </p>
            </div>
          </div>
        </div>
        <div class="slds-page-header__col-actions">
          <div class="slds-page-header__controls">
            <div class="slds-page-header__control">
              <button class="slds-button slds-button_neutral" id="resetBtn" onclick="resetAll()">Reset</button>
            </div>
            <div class="slds-page-header__control">
              <button class="slds-button slds-button_brand" id="runBtn" disabled onclick="runQuery()">Run Query</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="main-layout">
      <div class="left-panel" id="leftPanel">
        <div class="slds-p-around_small slds-border_bottom">
          <div class="slds-form-element">
            <div class="slds-form-element__control">
              <input class="slds-input" id="searchInput" type="text" placeholder="Search fields..." oninput="filterFields()" />
            </div>
          </div>
        </div>
        <div class="field-tree" id="fieldTree"></div>
      </div>
      <div class="resizer" id="resizer"></div>
      <div class="right-panel">
        <div class="sample-size-bar slds-border_bottom">
          <label class="sample-size-label" for="limitSelect">Sample size</label>
          <div class="slds-select_container">
                <select class="slds-select" id="limitSelect">
                  <option value="10">10</option>
                  <option value="50">50</option>
                  <option value="100" selected>100</option>
                  <option value="500">500</option>
                  <option value="1000">1000</option>
                </select>
          </div>
        </div>
        <div class="results-area" id="resultsArea">
          <div class="empty-state" id="emptyState">
            <div class="empty-icon">&#x1F50D;</div>
            <div class="empty-title">Select fields to query</div>
            <div class="empty-desc">Choose dimensions and measurements from the left panel, then click Run to execute a test query against the semantic model.</div>
          </div>
        </div>
        <div class="query-preview-toggle" id="queryToggle" onclick="toggleQueryPreview()" style="display:none;">
          <span id="queryToggleIcon">&#x25B6;</span> Query Preview
        </div>
        <div class="query-preview" id="queryPreview">
          <div class="query-code" id="queryCode"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const objectTree = ${objectTreeJson};

    let selectedFields = new Map();
    let queryStartTime = 0;
    let lastPayload = null;
    let sortCol = -1;
    let sortAsc = true;
    let tableData = null;
    let tableColumns = null;
    let currentFieldLabelMap = {};

    function renderFieldTree(filter) {
      const tree = document.getElementById('fieldTree');
      const filterLower = (filter || '').toLowerCase();
      let html = '';

      objectTree.forEach(function(obj, oi) {
        let totalFields = 0;
        let matchedFields = 0;
        let groupsHtml = '';

        obj.groups.forEach(function(grp) {
          let fieldsHtml = '';
          grp.fields.forEach(function(f) {
            totalFields++;
            if (filterLower && !(f.label || '').toLowerCase().includes(filterLower) && !(f.apiName || '').toLowerCase().includes(filterLower)) {
              return;
            }
            matchedFields++;
            const key = f.tableApiName + '.' + f.apiName;
            const sel = selectedFields.has(key) ? ' selected' : '';
            let tags = '<span class="field-type-tag">' + f.dataType + '</span>';
            if (f.placement === 'crossObject') {
              tags = '<span class="field-placement-tag crossObject">cross</span>' + tags;
            }
            fieldsHtml += '<div class="field-item' + sel + '" data-key="' + escapeHtml(key) + '" onclick="toggleField(this, ' + oi + ', ' + "'" + key + "'" + ')">';
            fieldsHtml += '<span class="field-cb">' + (sel ? '\\u2713' : '') + '</span>';
            fieldsHtml += '<span class="field-label" title="' + escapeHtml(f.label || f.apiName) + '">' + escapeHtml(f.label || f.apiName) + '</span>';
            fieldsHtml += tags;
            fieldsHtml += '</div>';
          });

          if (fieldsHtml) {
            groupsHtml += '<div class="category-header"><span class="cat-dot ' + grp.dotClass + '"></span>' + grp.category + '</div>';
            groupsHtml += fieldsHtml;
          }
        });

        if (filterLower && matchedFields === 0) return;

        const openClass = (!filterLower && oi > 0) ? '' : ' open';
        const chevronClass = (!filterLower && oi > 0) ? '' : ' open';
        const iconClass = obj.type === 'logicalView' ? 'lv' : (obj.dataObjectType === 'Dlo' ? 'dlo' : 'dmo');
        const iconText = obj.type === 'logicalView' ? 'LV' : (obj.dataObjectType === 'Dlo' ? 'DLO' : 'DMO');
        const baseClass = obj.baseModelApiName ? ' base-model' : '';

        html += '<div class="object-group">';
        html += '<div class="object-header" onclick="toggleObject(this)">';
        html += '<span class="object-chevron' + chevronClass + '">\\u25B6</span>';
        html += '<span class="object-icon ' + iconClass + baseClass + '">' + iconText + '</span>';
        html += '<span class="object-name">' + escapeHtml(obj.label) + '</span>';
        html += '<span class="object-count">' + totalFields + '</span>';
        html += '</div>';
        html += '<div class="object-body' + openClass + '">' + groupsHtml + '</div>';
        html += '</div>';
      });

      tree.innerHTML = html || '<div class="slds-align_absolute-center slds-p-around_large"><p class="slds-text-color_weak">No fields found</p></div>';
    }

    function toggleObject(header) {
      const chevron = header.querySelector('.object-chevron');
      const body = header.nextElementSibling;
      chevron.classList.toggle('open');
      body.classList.toggle('open');
    }

    function toggleField(el, objIdx, key) {
      if (selectedFields.has(key)) {
        selectedFields.delete(key);
        el.classList.remove('selected');
        el.querySelector('.field-cb').textContent = '';
      } else {
        const obj = objectTree[objIdx];
        for (const grp of obj.groups) {
          for (const f of grp.fields) {
            if (f.tableApiName + '.' + f.apiName === key) {
              selectedFields.set(key, f);
              el.classList.add('selected');
              el.querySelector('.field-cb').textContent = '\\u2713';
              break;
            }
          }
        }
      }
      updateSelectedCount();
    }

    function updateSelectedCount() {
      const n = selectedFields.size;
      document.getElementById('selectedCount').textContent = n + ' field' + (n !== 1 ? 's' : '') + ' selected';
      document.getElementById('runBtn').disabled = n === 0;
    }

    function filterFields() {
      renderFieldTree(document.getElementById('searchInput').value);
    }

    function resetAll() {
      selectedFields.clear();
      document.getElementById('searchInput').value = '';
      renderFieldTree('');
      updateSelectedCount();
      document.getElementById('resultsArea').innerHTML = '<div class="empty-state" id="emptyState"><div class="empty-icon">\\u{1F50D}</div><div class="empty-title">Select fields to query</div><div class="empty-desc">Choose dimensions and measurements from the left panel, then click Run to execute a test query against the semantic model.</div></div>';
      document.getElementById('queryToggle').style.display = 'none';
      document.getElementById('queryPreview').classList.remove('open');
    }

    function runQuery() {
      if (selectedFields.size === 0) return;

      const labelMap = {};
      const objLabelByApi = {};
      objectTree.forEach(function(o) { objLabelByApi[o.apiName] = o.label; });

      const fields = [];
      selectedFields.forEach(function(f) {
        fields.push({ apiName: f.apiName, label: f.label, tableApiName: f.tableApiName, fieldType: f.fieldType, aggregationType: f.aggregationType });
        const isCalc = f.fieldType === 'calcDimension' || f.fieldType === 'calcMeasurement';
        const alias = isCalc ? f.apiName : f.tableApiName + '.' + f.apiName;
        const parentLabel = objLabelByApi[f.tableApiName] || f.tableApiName;
        labelMap[alias] = isCalc ? f.label : parentLabel + ' \\u203A ' + f.label;
      });
      currentFieldLabelMap = labelMap;

      const limit = parseInt(document.getElementById('limitSelect').value) || 100;

      const area = document.getElementById('resultsArea');
      area.innerHTML = '<div class="loading-overlay"><div role="status" class="slds-spinner slds-spinner_medium"><span class="slds-assistive-text">Loading</span><div class="slds-spinner__dot-a"></div><div class="slds-spinner__dot-b"></div></div></div>';

      queryStartTime = Date.now();
      vscode.postMessage({ command: 'runQuery', fields: fields, limit: limit });
    }

    window.addEventListener('message', function(event) {
      const msg = event.data;
      if (msg.command !== 'queryResult') return;

      const elapsed = Date.now() - queryStartTime;
      const area = document.getElementById('resultsArea');

      if (!msg.success) {
        area.innerHTML = '<div class="error-box"><div class="slds-notify slds-notify_alert slds-alert_error" role="alert"><h2>' + escapeHtml(msg.error || 'Unknown error') + '</h2></div></div>';
        showQueryPreview(msg.payload || lastPayload);
        return;
      }

      lastPayload = msg.payload;

      if (msg.fieldLabels) {
        Object.keys(msg.fieldLabels).forEach(function(k) {
          if (!currentFieldLabelMap[k]) currentFieldLabelMap[k] = msg.fieldLabels[k];
        });
      }

      const data = msg.data || {};

      if (data.status !== 'SUCCESS' || !data.queryResults) {
        area.innerHTML = '<div class="error-box"><div class="slds-notify slds-notify_alert slds-alert_error" role="alert"><h2>' + escapeHtml(data.message || JSON.stringify(data, null, 2)) + '</h2></div></div>';
        showQueryPreview(lastPayload);
        return;
      }

      const fieldsMetadata = data.queryResults.queryMetadata?.fields || {};
      const rawRows = data.queryResults.queryData?.rows || [];

      const fullCols = Object.entries(fieldsMetadata)
        .sort(function(a, b) { return (a[1].placeInOrder || 0) - (b[1].placeInOrder || 0); })
        .map(function(entry) { return { name: entry[0], type: entry[1].type }; });

      const allCols = fullCols
        .filter(function(c) { return !!currentFieldLabelMap[c.name]; })
        .map(function(c) { return { name: c.name, type: c.type, label: c.name }; });

      if (allCols.length === 0) {
        area.innerHTML = '<div class="empty-state"><div class="empty-icon">\\u{1F4ED}</div><div class="empty-title">No data returned</div><div class="empty-desc">The query executed successfully but returned no columns.</div></div>';
        showQueryPreview(lastPayload);
        return;
      }

      const colIndexByName = {};
      fullCols.forEach(function(c, i) { colIndexByName[c.name] = i; });

      const isDataRowIdx = colIndexByName['is_data_row__sl'];
      const dataRows = (isDataRowIdx !== undefined)
        ? rawRows.filter(function(row) { return row.values[isDataRowIdx] !== false; })
        : rawRows;

      const rows = dataRows.map(function(row) {
        var obj = {};
        allCols.forEach(function(col) {
          var idx = colIndexByName[col.name];
          obj[col.name] = (row.values && idx !== undefined && row.values[idx] !== undefined) ? row.values[idx] : null;
        });
        return obj;
      });

      tableColumns = allCols;
      tableData = rows;
      sortCol = -1;
      sortAsc = true;

      renderTable(allCols, rows, elapsed);
      showQueryPreview(lastPayload);
    });

    function renderTable(cols, rows, elapsed) {
      const area = document.getElementById('resultsArea');
      let html = '<div class="results-status-bar">';
      html += '<span class="results-status-label"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 52 52" style="vertical-align:-2px;margin-right:4px;"><path fill="#0070d2" d="M48 7H4a2 2 0 0 0-2 2v4.5a1 1 0 0 0 .3.7l18.2 18.2a1 1 0 0 1 .3.7V46a1 1 0 0 0 1.6.8l7.6-5.7a1 1 0 0 0 .4-.8V33.1a1 1 0 0 1 .3-.7L49.7 14.2a1 1 0 0 0 .3-.7V9a2 2 0 0 0-2-2z"/></svg>Results</span>';
      html += '<span class="results-status-count">' + rows.length + ' row' + (rows.length !== 1 ? 's' : '') + '</span>';
      if (elapsed) html += '<span class="results-status-time">' + elapsed + 'ms</span>';
      html += '</div>';

      html += '<div class="table-container"><table class="data-table slds-table slds-table_cell-buffer slds-table_bordered"><thead><tr class="slds-line-height_reset">';
      cols.forEach(function(c, ci) {
        const sortedClass = sortCol === ci ? ' sorted' : '';
        const icon = sortCol === ci ? (sortAsc ? '\\u25B2' : '\\u25BC') : '\\u21C5';
        html += '<th class="slds-text-title_caps' + sortedClass + '" scope="col" onclick="sortTable(' + ci + ')" title="' + escapeHtml(c.name) + '">' + escapeHtml(friendlyLabel(c.label)) + '<span class="sort-icon">' + icon + '</span></th>';
      });
      html += '</tr></thead><tbody>';

      rows.forEach(function(row) {
        html += '<tr>';
        cols.forEach(function(c) {
          var val = row[c.name];
          if (val === null || val === undefined) {
            html += '<td class="null-val">null</td>';
          } else if (typeof val === 'number') {
            html += '<td class="num-val">' + val.toLocaleString() + '</td>';
          } else {
            html += '<td>' + escapeHtml(String(val)) + '</td>';
          }
        });
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      area.innerHTML = html;
    }

    function sortTable(colIdx) {
      if (!tableData || !tableColumns) return;
      if (sortCol === colIdx) {
        sortAsc = !sortAsc;
      } else {
        sortCol = colIdx;
        sortAsc = true;
      }
      const colName = tableColumns[colIdx].name;
      const sorted = [...tableData].sort(function(a, b) {
        var va = a[colName], vb = b[colName];
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
        return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
      renderTable(tableColumns, sorted, null);
    }

    function friendlyLabel(alias) {
      if (!alias) return '';
      if (currentFieldLabelMap[alias]) return currentFieldLabelMap[alias];
      var parts = alias.split('.');
      var fieldPart = parts.length > 1 ? parts[parts.length - 1] : alias;
      return fieldPart.replace(/_/g, ' ');
    }

    function showQueryPreview(payload) {
      document.getElementById('queryToggle').style.display = 'flex';
      if (payload) {
        document.getElementById('queryCode').textContent = JSON.stringify(payload, null, 2);
      }
    }

    function toggleQueryPreview() {
      const panel = document.getElementById('queryPreview');
      const icon = document.getElementById('queryToggleIcon');
      panel.classList.toggle('open');
      icon.textContent = panel.classList.contains('open') ? '\\u25BC' : '\\u25B6';
    }

    (function() {
      const resizer = document.getElementById('resizer');
      const leftPanel = document.getElementById('leftPanel');
      let startX, startW;
      resizer.addEventListener('mousedown', function(e) {
        startX = e.clientX;
        startW = leftPanel.offsetWidth;
        resizer.classList.add('active');
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
      });
      function onDrag(e) {
        const w = startW + (e.clientX - startX);
        if (w > 200 && w < 600) leftPanel.style.width = w + 'px';
      }
      function stopDrag() {
        resizer.classList.remove('active');
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
      }
    })();

    function escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    renderFieldTree('');
    updateSelectedCount();
  </script>
</body>
</html>`;
}