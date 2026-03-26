/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext } from './types';

export interface LegendModule {
  updateLegendCounts(): void;
  updateChangesButtons(): void;
  setHighlightChanges(active: boolean): void;
  toggleHighlightChanges(): void;
  applyHighlightDimming(): void;
  initCompareMode(): void;
}

export function createLegendModule(ctx: ErdContext): LegendModule {
  function updateLegendCounts(): void {
    let dmoCount = 0, dloCount = 0, ciCount = 0, lvCount = 0, baseCount = 0, unmappedCount = 0;
    ctx.nodes.forEach(function (n) {
      if (n.type === 'logicalView') lvCount++;
      else if (n.dataObjectType === 'Cio') ciCount++;
      else if (n.dataObjectType === 'Dlo') dloCount++;
      else dmoCount++;
      if (n.baseModelApiName) baseCount++;
      if (n.unmapped) unmappedCount++;
    });
    function set(id: string, val: string | number) {
      const el = ctx.root.querySelector('#' + id) as HTMLElement | null;
      if (el) el.textContent = String(val);
    }
    function show(id: string, visible: boolean) {
      const el = ctx.root.querySelector('#' + id) as HTMLElement | null;
      if (el) el.style.display = visible ? '' : 'none';
    }
    set('legendDmoCount', dmoCount); show('legendDmoItem', dmoCount > 0);
    set('legendDloCount', dloCount); show('legendDloItem', dloCount > 0);
    set('legendCiCount', ciCount);  show('legendCiItem', ciCount > 0);
    set('legendLvCount', lvCount);  show('legendLvItem', lvCount > 0);
    set('legendRelCount', ctx.edges.length);
    set('legendBaseCount', baseCount); show('baseModelLegendItem', baseCount > 0);
    set('legendUnmappedCount', unmappedCount); show('unmappedLegendItem', unmappedCount > 0);
    const indSec = ctx.root.querySelector('#indicatorsLegendSection') as HTMLElement | null;
    if (indSec) indSec.style.display = (baseCount > 0 || unmappedCount > 0) ? 'block' : 'none';
  }

  function updateChangesButtons(): void {
    const btn = ctx.root.querySelector('#changesToggleBtn') as HTMLElement | null;
    if (btn) {
      btn.classList.toggle('route-active', ctx.highlightChangesActive);
      btn.title = ctx.highlightChangesActive ? 'Show All' : 'Highlight Changes';
      const lbl = btn.querySelector('.lp-btn-label') as HTMLElement | null;
      if (lbl) lbl.textContent = ctx.highlightChangesActive ? 'Changes: On' : 'Highlight Changes';
    }
  }

  function applyHighlightDimming(): void {
    if (!ctx.isCompareMode) return;
    if (ctx.currentView === 'top') {
      ctx.nodes.forEach(n => {
        const el = ctx.nodeElements[n.id];
        if (!el) return;
        const hasChange = n.diffStatus && n.diffStatus !== 'unchanged';
        if (ctx.highlightChangesActive && !hasChange) {
          el.classList.add('diff-dimmed');
        } else {
          el.classList.remove('diff-dimmed');
        }
      });
      ctx.drawEdges();
    } else if (ctx.currentView === 'drilldown') {
      Object.keys(ctx.ddElements).forEach(key => {
        const el = ctx.ddElements[key];
        if (!el) return;
        let hasChange = false;
        if (key === '__center__') {
          const cn = ctx.nodes.find(n => n.id === ctx.ddCenterId);
          hasChange = !!(cn && cn.diffStatus && cn.diffStatus !== 'unchanged' && cn.diffStatus !== 'modified-children');
        } else if (key.startsWith('ent_')) {
          const entApi = key.substring(4);
          const ent = ctx.ddEntities.find((e: any) => e.apiName === entApi);
          hasChange = !!(ent && (ent as any).diffStatus && (ent as any).diffStatus !== 'unchanged');
        } else if (key.startsWith('eobj_')) {
          const objApi = key.substring(5);
          const n = ctx.nodes.find(nn => nn.id === objApi);
          hasChange = !!(n && n.diffStatus && n.diffStatus !== 'unchanged');
        }
        if (ctx.highlightChangesActive && !hasChange) {
          el.classList.add('diff-dimmed');
        } else {
          el.classList.remove('diff-dimmed');
        }
      });
      ctx.drawDrillEdges();
    }
  }

  function setHighlightChanges(active: boolean): void {
    if (!ctx.isCompareMode) return;
    if (ctx.highlightChangesActive === active) return;
    ctx.highlightChangesActive = active;
    updateChangesButtons();
    applyHighlightDimming();
  }

  function toggleHighlightChanges(): void {
    setHighlightChanges(!ctx.highlightChangesActive);
  }

  function initCompareMode(): void {
    if (!ctx.isCompareMode) return;
    const diffSection = ctx.root.querySelector('#diffLegendSection') as HTMLElement | null;
    if (diffSection) diffSection.style.display = 'block';

    let addedCount = 0, modifiedCount = 0, removedCount = 0;
    const allItems: Array<{ diffStatus?: string | null }> = [...ctx.nodes, ...ctx.edges];
    ctx.nodes.forEach(n => {
      [n.relatedCalcDims, n.relatedCalcMeas, n.relatedHierarchies, n.relatedMetrics, n.relatedGroupings].forEach(list => {
        if (list) allItems.push(...list);
      });
    });
    allItems.forEach(item => {
      if (item.diffStatus === 'added') addedCount++;
      else if (item.diffStatus === 'modified') modifiedCount++;
      else if (item.diffStatus === 'removed') removedCount++;
      // 'modified-children' is intentionally excluded — only the children count
    });
    const total = addedCount + modifiedCount + removedCount;
    const parts: string[] = [];
    if (addedCount) parts.push(addedCount + ' added');
    if (modifiedCount) parts.push(modifiedCount + ' modified');
    if (removedCount) parts.push(removedCount + ' ' + ctx.diffLabels.removed.toLowerCase());
    const summaryEl = ctx.root.querySelector('#diffSummary') as HTMLElement | null;
    if (summaryEl) summaryEl.textContent = total === 0 ? 'No differences found' : parts.join(', ') + ' (' + total + ' total)';
  }

  return { updateLegendCounts, updateChangesButtons, setHighlightChanges, toggleHighlightChanges, applyHighlightDimming, initCompareMode };
}