/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext } from './types';
import { formatCommitDate, truncateStr } from './utils';

export interface HistoryModule {
  toggleHistoryPanel(): void;
  closeHistoryPanel(): void;
  setHistoryMode(mode: string): void;
  renderHistoryPanel(): void;
  updateCommitCardStates(): void;
  showErdLoading(show: boolean): void;
  onCommitClick(hash: string): void;
  onCommitRightClick(e: Event, hash: string): void;
  applyNewModelData(modelData: any, compareMode: boolean): void;
  buildNodesFromModelUI(data: any): any[];
  buildEdgesFromModelUI(data: any): any[];
  setDiffLegendLabels(isGitCompare: boolean): void;
  initHistory(): void;
}

export function createHistoryModule(ctx: ErdContext): HistoryModule {
  function toggleHistoryPanel(): void {
    const panel = ctx.root.querySelector('#historyPanel') as HTMLElement | null;
    if (!panel) return;
    if (panel.classList.contains('visible')) {
      closeHistoryPanel();
    } else {
      ctx.closeSidebar();
      panel.classList.add('visible');
      renderHistoryPanel();
    }
  }

  function closeHistoryPanel(): void {
    const panel = ctx.root.querySelector('#historyPanel') as HTMLElement | null;
    if (panel) panel.classList.remove('visible');
  }

  function setHistoryMode(mode: string): void {
    ctx.historyViewMode = mode as any;
    ctx.baseCommitHash = null;
    renderHistoryPanel();
  }

  function renderHistoryPanel(): void {
    const body = ctx.root.querySelector('#historyPanelBody') as HTMLElement | null;
    if (!body) return;
    const panel = ctx.root.querySelector('#historyPanel') as HTMLElement | null;
    const savedScroll = panel ? panel.scrollTop : 0;
    let html = '';

    html += '<div class="history-mode-toggle">';
    html += '<button class="history-mode-btn ' + (ctx.historyViewMode === 'view' ? 'active' : '') + '" data-action="setHistoryMode" data-arg="view">View</button>';
    html += '<button class="history-mode-btn ' + (ctx.historyViewMode === 'compare' ? 'active' : '') + '" data-action="setHistoryMode" data-arg="compare">Compare</button>';
    html += '</div>';

    html += '<div id="compareHintContainer">';
    if (ctx.historyViewMode === 'compare') {
      if (!ctx.baseCommitHash) {
        html += '<div class="compare-hint">Click a commit to set it as the <strong>base</strong> for comparison.</div>';
      } else {
        const baseLabel = ctx.baseCommitHash === 'CURRENT' ? 'CURRENT' : ctx.baseCommitHash.substring(0, 7);
        html += '<div class="compare-hint">Base: <strong>' + baseLabel + '</strong>. Click another commit to compare. Right-click any commit to change the base.</div>';
      }
    }
    html += '</div>';

    const currentClass = ctx.selectedCommitHash === 'CURRENT' ? ' selected' : '';
    const currentBaseClass = ctx.baseCommitHash === 'CURRENT' ? ' base-commit' : '';
    html += '<div class="commit-card' + currentClass + currentBaseClass + '" data-action="commitClick" data-hash="CURRENT">';
    html += '<span class="commit-hash">CURRENT</span><span class="commit-badge current-badge">Working Directory</span>';
    html += '<span class="commit-badge base-badge" style="display:' + (ctx.baseCommitHash === 'CURRENT' ? 'inline-block' : 'none') + '">BASE</span>';
    html += '<div class="commit-msg">Local working directory</div>';
    html += '</div>';

    for (let ci = 0; ci < ctx.historyCommits.length; ci++) {
      const c = ctx.historyCommits[ci];
      const isSelected = ctx.selectedCommitHash === c.hash;
      const isBase = ctx.baseCommitHash === c.hash;
      let cls = 'commit-card';
      if (isSelected) cls += ' selected';
      if (isBase) cls += ' base-commit';
      html += '<div class="' + cls + '" data-action="commitClick" data-hash="' + c.hash + '">';
      html += '<span class="commit-hash">' + c.shortHash + '</span>';
      html += '<span class="commit-badge base-badge" style="display:' + (isBase ? 'inline-block' : 'none') + '">BASE</span>';
      html += '<div class="commit-msg" title="' + c.message.replace(/"/g, '&quot;') + '">' + truncateStr(c.message, 60) + '</div>';
      html += '<div class="commit-meta">' + c.author + ' &middot; ' + formatCommitDate(c.date) + '</div>';
      if (c.filesChanged && c.filesChanged.length > 0) {
        html += '<div class="commit-files">' + c.filesChanged.join(', ') + '</div>';
      }
      html += '</div>';
    }

    body.innerHTML = html;
    if (panel) panel.scrollTop = savedScroll;
  }

  function updateCommitCardStates(): void {
    const body = ctx.root.querySelector('#historyPanelBody') as HTMLElement | null;
    if (!body) return;
    const cards = body.querySelectorAll('.commit-card');
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i] as HTMLElement;
      const h = card.getAttribute('data-hash');
      card.classList.toggle('selected', h === ctx.selectedCommitHash);
      card.classList.toggle('base-commit', h === ctx.baseCommitHash);
      const baseBadge = card.querySelector('.base-badge') as HTMLElement | null;
      if (baseBadge) baseBadge.style.display = (h === ctx.baseCommitHash) ? 'inline-block' : 'none';
    }
    const hintContainer = ctx.root.querySelector('#compareHintContainer') as HTMLElement | null;
    if (hintContainer) {
      if (ctx.historyViewMode !== 'compare') {
        hintContainer.innerHTML = '';
      } else if (!ctx.baseCommitHash) {
        hintContainer.innerHTML = '<div class="compare-hint">Click a commit to set it as the <strong>base</strong> for comparison.</div>';
      } else {
        const bl = ctx.baseCommitHash === 'CURRENT' ? 'CURRENT' : ctx.baseCommitHash.substring(0, 7);
        hintContainer.innerHTML = '<div class="compare-hint">Base: <strong>' + bl + '</strong>. Click another commit to compare. Right-click any commit to change the base.</div>';
      }
    }
  }

  function showErdLoading(show: boolean): void {
    const overlay = ctx.root.querySelector('#erdLoadingOverlay') as HTMLElement | null;
    if (overlay) {
      if (show) overlay.classList.add('visible');
      else overlay.classList.remove('visible');
    }
  }

  function onCommitClick(hash: string): void {
    if (ctx.historyLoading) return;
    if (ctx.historyViewMode === 'view') {
      ctx.selectedCommitHash = hash;
      ctx.historyLoading = true;
      updateCommitCardStates();
      showErdLoading(true);
      ctx.vscode.postMessage({ command: 'loadCommit', commitHash: hash });
    } else {
      if (!ctx.baseCommitHash) {
        ctx.baseCommitHash = hash;
        updateCommitCardStates();
      } else if (hash !== ctx.baseCommitHash) {
        ctx.selectedCommitHash = hash;
        ctx.historyLoading = true;
        updateCommitCardStates();
        showErdLoading(true);
        ctx.vscode.postMessage({
          command: 'compareCommits',
          baseCommitHash: ctx.baseCommitHash,
          selectedCommitHash: hash,
        });
      }
    }
  }

  function onCommitRightClick(e: Event, hash: string): void {
    if (ctx.historyViewMode !== 'compare') return;
    e.preventDefault();
    ctx.baseCommitHash = hash;
    updateCommitCardStates();
  }

  function buildNodesFromModelUI(data: any): any[] {
    const result: any[] = [];
    (data.dataObjects || []).forEach(function (obj: any) {
      const dims = (obj.semanticDimensions || []).map(function (d: any) {
        return { apiName: d.apiName, label: d.label, dataType: d.dataType || 'Text', dataObjectFieldName: d.dataObjectFieldName || d.apiName, unmapped: !!d.unmapped };
      });
      const meas = (obj.semanticMeasurements || []).map(function (m: any) {
        return { apiName: m.apiName, label: m.label, dataType: m.dataType || 'Number', aggregationType: m.aggregationType || 'Sum', unmapped: !!m.unmapped };
      });
      const relCalcDims = (obj.relatedCalculatedDimensions || []).map(function (c: any) {
        return { apiName: c.apiName, label: c.label, expression: c.expression, placement: c.placement, isSystemDefinition: c.isSystemDefinition || false, referencedObjects: c.referencedObjects || [], diffStatus: c.diffStatus || null };
      });
      const relCalcMeas = (obj.relatedCalculatedMeasurements || []).map(function (c: any) {
        return { apiName: c.apiName, label: c.label, expression: c.expression, placement: c.placement, isSystemDefinition: c.isSystemDefinition || false, referencedObjects: c.referencedObjects || [], diffStatus: c.diffStatus || null };
      });
      const relHier = (obj.relatedDimensionHierarchies || []).map(function (h: any) {
        return { apiName: h.apiName, label: h.label, levels: h.levels, placement: h.placement, diffStatus: h.diffStatus || null };
      });
      const relMetrics = (obj.relatedMetrics || []).map(function (m: any) {
        return { apiName: m.apiName, label: m.label, diffStatus: m.diffStatus || null };
      });
      const relGroupings = (obj.relatedGroupings || []).map(function (g: any) {
        return { apiName: g.apiName, label: g.label, type: g.type, diffStatus: g.diffStatus || null };
      });
      result.push({
        id: obj.apiName, label: obj.label, type: 'dataObject',
        dataObjectType: obj.dataObjectType || 'Dmo', dataObjectName: obj.dataObjectName || obj.apiName,
        diffStatus: obj.diffStatus || null, dimCount: dims.length, measCount: meas.length,
        dimensions: dims, measurements: meas,
        relatedCalcDims: relCalcDims, relatedCalcMeas: relCalcMeas,
        relatedHierarchies: relHier, relatedMetrics: relMetrics, relatedGroupings: relGroupings,
      });
    });
    (data.logicalViews || []).forEach(function (lv: any) {
      result.push({
        id: lv.apiName, label: lv.label, type: 'logicalView',
        diffStatus: lv.diffStatus || null, dimCount: 0, measCount: 0,
        dimensions: [], measurements: [],
        relatedCalcDims: (lv.relatedCalculatedDimensions || []).map(function (c: any) {
          return { apiName: c.apiName, label: c.label, expression: c.expression, placement: c.placement, isSystemDefinition: c.isSystemDefinition || false, referencedObjects: c.referencedObjects || [], diffStatus: c.diffStatus || null };
        }),
        relatedCalcMeas: (lv.relatedCalculatedMeasurements || []).map(function (c: any) {
          return { apiName: c.apiName, label: c.label, expression: c.expression, placement: c.placement, isSystemDefinition: c.isSystemDefinition || false, referencedObjects: c.referencedObjects || [], diffStatus: c.diffStatus || null };
        }),
        relatedHierarchies: [], relatedMetrics: [], relatedGroupings: [],
      });
    });
    return result;
  }

  function buildEdgesFromModelUI(data: any): any[] {
    return (data.relationships || []).map(function (r: any) {
      const criteria = r.criteria || [];
      const firstCrit = criteria[0] || {};
      return {
        id: r.apiName, label: r.label,
        from: r.leftSemanticDefinitionApiName, to: r.rightSemanticDefinitionApiName,
        cardinality: r.cardinality, joinType: r.joinType, isEnabled: r.isEnabled,
        fromField: firstCrit.leftSemanticFieldApiName || '',
        toField: firstCrit.rightSemanticFieldApiName || '',
        joinOperator: firstCrit.joinOperator || 'Equals',
        diffStatus: r.diffStatus || null, suggestions: [],
      };
    });
  }

  function setDiffLegendLabels(isGitCompare: boolean): void {
    const title = ctx.root.querySelector('#diffLegendTitle') as HTMLElement | null;
    const labelAdded = ctx.root.querySelector('#diffLabelAdded') as HTMLElement | null;
    const labelModified = ctx.root.querySelector('#diffLabelModified') as HTMLElement | null;
    const labelRemoved = ctx.root.querySelector('#diffLabelRemoved') as HTMLElement | null;
    const ringAdded = ctx.root.querySelector('#diffRingAdded') as HTMLElement | null;
    const ringModified = ctx.root.querySelector('#diffRingModified') as HTMLElement | null;
    const ringRemoved = ctx.root.querySelector('#diffRingRemoved') as HTMLElement | null;
    if (isGitCompare) {
      ctx.diffLabels = { added: 'Added', modified: 'Modified', removed: 'Removed' };
      if (title) title.textContent = 'Changes (Between Commits)';
      if (labelAdded) labelAdded.textContent = 'Added';
      if (labelModified) labelModified.textContent = 'Modified';
      if (labelRemoved) labelRemoved.textContent = 'Removed';
      if (ringAdded) ringAdded.title = 'Added';
      if (ringModified) ringModified.title = 'Modified';
      if (ringRemoved) ringRemoved.title = 'Removed';
    } else {
      ctx.diffLabels = { added: 'New', modified: 'Modified', removed: 'Remote Only' };
      if (title) title.textContent = 'Changes (Local vs Remote)';
      if (labelAdded) labelAdded.textContent = 'New';
      if (labelModified) labelModified.textContent = 'Modified';
      if (labelRemoved) labelRemoved.textContent = 'Remote Only';
      if (ringAdded) ringAdded.title = 'New';
      if (ringModified) ringModified.title = 'Modified';
      if (ringRemoved) ringRemoved.title = 'Remote Only';
    }
  }

  function applyNewModelData(modelData: any, compareMode: boolean): void {
    ctx.nodes.length = 0;
    ctx.edges.length = 0;
    ctx.crossObjectEntities.length = 0;

    const newNodes = buildNodesFromModelUI(modelData);
    const newEdges = buildEdgesFromModelUI(modelData);
    const newCross = modelData.crossObjectEntities || [];

    newNodes.forEach((n: any) => ctx.nodes.push(n));
    newEdges.forEach((e: any) => ctx.edges.push(e));
    newCross.forEach((x: any) => ctx.crossObjectEntities.push(x));

    ctx.isCompareMode = compareMode;
    ctx.highlightChangesActive = false;

    const changesGrp = ctx.root.querySelector('#changesGroup') as HTMLElement | null;
    if (compareMode) {
      const diffSection = ctx.root.querySelector('#diffLegendSection') as HTMLElement | null;
      if (diffSection) diffSection.style.display = 'block';
      if (changesGrp) changesGrp.classList.add('visible');
      let addedCount = 0, modifiedCount = 0, removedCount = 0;
      const allItems = (ctx.nodes as any[]).concat(ctx.edges as any[]);
      allItems.forEach(function (item: any) {
        if (item.diffStatus === 'added') addedCount++;
        else if (item.diffStatus === 'modified') modifiedCount++;
        else if (item.diffStatus === 'removed') removedCount++;
        // 'modified-children' is intentionally excluded — only the children count
      });
      const summaryEl = ctx.root.querySelector('#diffSummary') as HTMLElement | null;
      if (summaryEl) summaryEl.textContent = addedCount + ' added, ' + modifiedCount + ' modified, ' + removedCount + ' removed';
    } else {
      const diffSection = ctx.root.querySelector('#diffLegendSection') as HTMLElement | null;
      if (diffSection) diffSection.style.display = 'none';
      if (changesGrp) changesGrp.classList.remove('visible');
    }

    ctx.updateLegendCounts();
    ctx.closeSidebar();

    if (ctx.currentView === 'drilldown') {
      ctx.exitDrillDown();
    }

    ctx.cachedPositionsForModel = {};
    ctx.nodePositions = {};
    ctx.nodeElements = {};
    ctx.renderTopLevel();
  }

  function initHistory(): void {
    if (!ctx.isHistoryMode) return;
    const countEl = ctx.root.querySelector('#historyCommitCount') as HTMLElement | null;
    if (countEl) countEl.textContent = String(ctx.historyCommits.length);
    // Auto-open history panel
    const autoPanel = ctx.root.querySelector('#historyPanel') as HTMLElement | null;
    if (autoPanel) {
      ctx.closeSidebar();
      autoPanel.classList.add('visible');
      renderHistoryPanel();
    }
  }

  return {
    toggleHistoryPanel, closeHistoryPanel, setHistoryMode, renderHistoryPanel,
    updateCommitCardStates, showErdLoading, onCommitClick, onCommitRightClick,
    applyNewModelData, buildNodesFromModelUI, buildEdgesFromModelUI, setDiffLegendLabels, initHistory,
  };
}