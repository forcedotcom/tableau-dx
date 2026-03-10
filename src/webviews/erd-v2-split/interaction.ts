/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext } from './types';

export interface InteractionModule {
  updateView(): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  toggleGridMode(): void;
  runAutoLayout(): void;
  toggleLeftPanel(): void;
  setupEmbeddedMode(): void;
  showEmbeddedBackBtn(): void;
  hideEmbeddedBackBtn(): void;
  updateEmbeddedBackBtnPosition(): void;
  setupEventListeners(): void;
}

export function createInteractionModule(ctx: ErdContext): InteractionModule {
  const WHEEL_THRESHOLD = 40;
  const WHEEL_IDLE_MS = 200;
  const ZOOM_SPEED = 0.002;

  function updateView(): void {
    ctx.viewport.style.transform = 'translate(' + ctx.panX + 'px, ' + ctx.panY + 'px) scale(' + ctx.scale + ')';
  }

  function zoomIn(): void { ctx.scale = Math.min(3, ctx.scale * 1.2); updateView(); }
  function zoomOut(): void { ctx.scale = Math.max(0.2, ctx.scale / 1.2); updateView(); }

  function resetView(): void {
    if (ctx.currentView === 'grouped') {
      ctx.redrawGroupEdges();
      // fitGroupedViewport via groups module
      const groupsMod = (ctx as any)._groupsModule;
      if (groupsMod) groupsMod.fitGroupedViewport();
    } else if (ctx.currentView === 'listGrouped') {
      const groupsMod = (ctx as any)._groupsModule;
      if (groupsMod) groupsMod.fitListGroupedViewport((ctx as any).listGroupTotalH || 0);
    } else {
      ctx.fitToViewport();
    }
  }

  function toggleGridMode(): void {
    ctx.isGridMode = !ctx.isGridMode;
    const btn = ctx.root.querySelector('#gridToggleBtn') as HTMLElement | null;
    if (ctx.isGridMode) {
      if (btn) { btn.classList.add('route-active'); btn.title = 'Grid Snap: ON'; }
      if (ctx.currentView === 'top') {
        const layoutMod = (ctx as any)._layoutModule;
        if (layoutMod) layoutMod.snapAllToGrid(ctx.nodePositions, layoutMod.getGridCellSize('top'));
        Object.keys(ctx.nodePositions).forEach(id => {
          const el = ctx.nodeElements[id];
          if (el) { el.style.left = ctx.nodePositions[id].x + 'px'; el.style.top = ctx.nodePositions[id].y + 'px'; }
        });
        ctx.drawEdges();
        const posMod = (ctx as any)._positionCacheModule;
        if (posMod) posMod.saveAllCachedPositions(ctx.nodePositions);
      } else if (ctx.currentView === 'grouped') {
        const layoutMod = (ctx as any)._layoutModule;
        if (layoutMod) layoutMod.snapAllToGrid(ctx.groupNodePositions, layoutMod.getGridCellSize('groupCircle'));
        Object.keys(ctx.groupNodePositions).forEach(gn => {
          const gEl = ctx.groupNodeElements[gn];
          if (gEl) { gEl.style.left = ctx.groupNodePositions[gn].x + 'px'; gEl.style.top = ctx.groupNodePositions[gn].y + 'px'; }
          const groupsMod = (ctx as any)._groupsModule;
          if (groupsMod && ctx.expandedGroups.has(gn)) groupsMod.positionGroupRect(gn);
        });
        ctx.redrawGroupEdges();
      } else if (ctx.currentView === 'drilldown') {
        const layoutMod = (ctx as any)._layoutModule;
        if (layoutMod) layoutMod.snapAllToGrid(ctx.ddPositions, layoutMod.getGridCellSize('drilldown'));
        Object.keys(ctx.ddPositions).forEach(id => {
          const el = ctx.ddElements[id];
          if (!el) return;
          let hs = ctx.ENTITY_SIZE / 2;
          if (id === '__center__') hs = 60;
          else if (id.startsWith('eobj_')) hs = ctx.EDGE_OBJ_SIZE / 2;
          el.style.left = (ctx.ddPositions[id].x - hs) + 'px';
          el.style.top = (ctx.ddPositions[id].y - hs) + 'px';
        });
        ctx.drawDrillEdges();
        const posMod = (ctx as any)._positionCacheModule;
        if (posMod) posMod.saveAllCachedPositions(ctx.ddPositions);
      }
    } else {
      if (btn) { btn.classList.remove('route-active'); btn.title = 'Grid Snap: OFF'; }
    }
  }

  function runAutoLayout(): void {
    const layoutMod = (ctx as any)._layoutModule;
    const posMod = (ctx as any)._positionCacheModule;
    if (!layoutMod) return;

    if (ctx.currentView === 'top') {
      ctx.cachedPositions = {};
      if (posMod) posMod.clearCachedPositions('topLevel');
      const visibleNodes = ctx.showUnmapped ? ctx.nodes : ctx.nodes.filter(n => !(n as any).unmapped);
      const visibleEdges = ctx.edges.filter(e => {
        const fromV = visibleNodes.some(n => n.id === e.from);
        const toV = visibleNodes.some(n => n.id === e.to);
        return fromV && toV;
      });
      ctx.nodePositions = {};
      if (ctx.layoutMode === 'grid') {
        layoutMod.layoutGrid(visibleNodes);
      } else {
        layoutMod.layoutForceAtlas2(visibleNodes, visibleEdges, true);
      }
      Object.keys(ctx.nodePositions).forEach(id => {
        const el = ctx.nodeElements[id];
        if (el) {
          el.style.transition = 'left 0.3s ease, top 0.3s ease';
          el.style.left = ctx.nodePositions[id].x + 'px';
          el.style.top = ctx.nodePositions[id].y + 'px';
        }
      });
      setTimeout(() => {
        Object.keys(ctx.nodeElements).forEach(id => { ctx.nodeElements[id].style.transition = ''; });
      }, 320);
      if (!ctx.hideRelationships) ctx.drawEdges();
      ctx.fitToViewport();
      if (ctx.layoutMode !== 'grid' && posMod) posMod.saveAllCachedPositions(ctx.nodePositions);

    } else if (ctx.currentView === 'grouped') {
      if (posMod) posMod.clearCachedPositions('topLevel');
      ctx.groupNodePositions = {};
      const groupsMod = (ctx as any)._groupsModule;
      if (groupsMod) groupsMod.layoutGroupForce();
      Object.keys(ctx.groupNodePositions).forEach(gn => {
        const gEl = ctx.groupNodeElements[gn];
        if (gEl) {
          gEl.style.transition = 'left 0.3s ease, top 0.3s ease';
          gEl.style.left = ctx.groupNodePositions[gn].x + 'px';
          gEl.style.top = ctx.groupNodePositions[gn].y + 'px';
        }
        if (ctx.expandedGroups.has(gn) && groupsMod) {
          groupsMod.layoutEntitiesForceDirected(gn);
          groupsMod.positionGroupRect(gn);
          const gg = ctx.groupNodesList.find(g => g.name === gn);
          if (gg) {
            (gg as any).objects.forEach((objId: string) => {
              const ePos = ctx.groupEntityPositions[objId];
              const eEl = ctx.groupEntityElements[objId];
              if (ePos && eEl) {
                eEl.style.transition = 'left 0.3s ease, top 0.3s ease';
                eEl.style.left = ePos.x + 'px';
                eEl.style.top = ePos.y + 'px';
              }
            });
          }
        }
      });
      setTimeout(() => {
        Object.keys(ctx.groupNodeElements).forEach(gn => { ctx.groupNodeElements[gn].style.transition = ''; });
        Object.keys(ctx.groupEntityElements).forEach(id => { ctx.groupEntityElements[id].style.transition = ''; });
      }, 320);
      ctx.redrawGroupEdges();
      if (groupsMod) groupsMod.fitGroupedViewport();
      if (posMod) {
        const allPos: Record<string, any> = {};
        Object.keys(ctx.groupNodePositions).forEach(gn => { allPos['grp_' + gn] = ctx.groupNodePositions[gn]; });
        Object.keys(ctx.groupEntityPositions).forEach(id => { allPos[id] = ctx.groupEntityPositions[id]; });
        posMod.saveAllCachedPositions(allPos);
      }

    } else if (ctx.currentView === 'drilldown') {
      if (posMod) posMod.clearCachedPositions('drilldown:' + ctx.ddCenterId);
      const drillNodes2: Array<{ id: string; type: string }> = [{ id: '__center__', type: 'center' }];
      const drillEdges2: Array<{ from: string; to: string }> = [];
      const entApiNames2: Record<string, boolean> = {};
      ctx.ddEntities.forEach(e => { entApiNames2[(e as any).apiName] = true; });

      ctx.ddEntities.forEach(ent => {
        drillNodes2.push({ id: 'ent_' + (ent as any).apiName, type: 'entity' });
        const lookup = ctx.calcFieldsLookup[(ent as any).apiName];
        const directRefs: any[] = lookup ? (lookup as any).directReferences || [] : [];
        let refsOtherCalcs = false;
        const addedCalcEdges2: Record<string, boolean> = {};

        directRefs.forEach(ref => {
          if (!ref.objectApiName && ref.fieldApiName && entApiNames2[ref.fieldApiName]) {
            const edgeKey = 'ent_' + (ent as any).apiName + '>' + 'ent_' + ref.fieldApiName;
            if (addedCalcEdges2[edgeKey]) return;
            addedCalcEdges2[edgeKey] = true;
            drillEdges2.push({ from: 'ent_' + (ent as any).apiName, to: 'ent_' + ref.fieldApiName });
            refsOtherCalcs = true;
          }
        });

        let refsCenter2 = false;
        directRefs.forEach(ref => { if (ref.objectApiName === ctx.ddCenterId) refsCenter2 = true; });
        const referencesCenter2 = ((ent as any).referencedObjects || []).indexOf(ctx.ddCenterId) >= 0;
        if (refsCenter2 || (!refsOtherCalcs && referencesCenter2)) {
          drillEdges2.push({ from: '__center__', to: 'ent_' + (ent as any).apiName });
        }
      });

      Array.from(ctx.ddEdgeObjectIds).forEach(objId => { drillNodes2.push({ id: 'eobj_' + objId, type: 'edgeObj' }); });
      ctx.ddEntities.forEach(ent => {
        const directObjSet3 = new Set<string>();
        const cl3 = ctx.calcFieldsLookup[(ent as any).apiName];
        if (cl3 && (cl3 as any).directReferences) {
          (cl3 as any).directReferences.forEach((r: any) => { if (r.objectApiName) directObjSet3.add(r.objectApiName); });
        } else {
          ((ent as any).referencedObjects || []).forEach((o: string) => { directObjSet3.add(o); });
        }
        directObjSet3.forEach(o => {
          if (o !== ctx.ddCenterId && ctx.ddEdgeObjectIds.has(o)) {
            drillEdges2.push({ from: 'ent_' + (ent as any).apiName, to: 'eobj_' + o });
          }
        });
      });

      layoutMod.layoutDrillDown(drillNodes2, drillEdges2);
      layoutMod.snapAllToGrid(ctx.ddPositions, layoutMod.getGridCellSize('drilldown'));
      ctx.ddCenterPos = ctx.ddPositions['__center__'];

      Object.keys(ctx.ddElements).forEach(key => {
        const el = ctx.ddElements[key];
        const pos = ctx.ddPositions[key];
        if (!el || !pos) return;
        let hs = ctx.ENTITY_SIZE / 2;
        if (key === '__center__') hs = 60;
        else if (key.startsWith('eobj_')) hs = ctx.EDGE_OBJ_SIZE / 2;
        el.style.transition = 'left 0.3s ease, top 0.3s ease';
        el.style.left = (pos.x - hs) + 'px';
        el.style.top = (pos.y - hs) + 'px';
      });
      setTimeout(() => {
        Object.keys(ctx.ddElements).forEach(key => { if (ctx.ddElements[key]) ctx.ddElements[key].style.transition = ''; });
      }, 320);
      ctx.drawDrillEdges();

      const allX: number[] = [], allY: number[] = [];
      Object.values(ctx.ddPositions).forEach(p => { allX.push(p.x); allY.push(p.y); });
      if (allX.length > 0) {
        const mnX = Math.min(...allX) - 150, mxX = Math.max(...allX) + 200;
        const mnY = Math.min(...allY) - 100, mxY = Math.max(...allY) + 100;
        const w = mxX - mnX, h = mxY - mnY;
        const lpEl = ctx.root.querySelector('#leftPanel') as HTMLElement | null;
        const lpw = lpEl ? lpEl.offsetWidth : 48;
        const availW = ctx.erdContainer.clientWidth - lpw;
        const sw = availW / (w + 50), sh = ctx.erdContainer.clientHeight / (h + 50);
        ctx.scale = Math.min(sw, sh, 1);
        ctx.panX = lpw + (availW - w * ctx.scale) / 2 - mnX * ctx.scale;
        ctx.panY = (ctx.erdContainer.clientHeight - h * ctx.scale) / 2 - mnY * ctx.scale;
        updateView();
      }

      if (posMod) posMod.saveAllCachedPositions(ctx.ddPositions);
    }
  }

  function toggleLeftPanel(): void {
    const panel = ctx.root.querySelector('#leftPanel') as HTMLElement | null;
    if (panel) panel.classList.toggle('expanded');
    if (ctx.embeddedMode) {
      let rafActive = true;
      const animEnd = Date.now() + 250;
      const step = (): void => {
        updateEmbeddedBackBtnPosition();
        if (Date.now() < animEnd && rafActive) requestAnimationFrame(step);
        else rafActive = false;
      };
      requestAnimationFrame(step);
    }
  }

  function setupEmbeddedMode(): void {
    if (!ctx.embeddedMode) return;
    const floatingBackBtn = document.createElement('button');
    floatingBackBtn.id = 'floatingBackBtn';
    floatingBackBtn.textContent = '← Back to ERD';
    floatingBackBtn.style.cssText = [
      'position:absolute', 'top:12px', 'left:12px', 'z-index:200', 'display:none',
      'padding:6px 14px', 'background:#fff', 'border:1px solid #dddbda', 'border-radius:4px',
      'font-size:13px', 'font-weight:500', 'color:#0070d2', 'cursor:pointer',
      'box-shadow:0 2px 4px rgba(0,0,0,0.12)', 'transition:left 0.2s ease'
    ].join(';');
    floatingBackBtn.addEventListener('click', () => { ctx.exitDrillDown(); });
    ctx.erdContainer.appendChild(floatingBackBtn);

    // Hide the header and remove top offset
    const headerEl = ctx.root.querySelector('#header') as HTMLElement | null;
    if (headerEl) headerEl.style.display = 'none';
    ctx.erdContainer.style.top = '0';
    ctx.erdContainer.style.bottom = '0';
    (ctx.sidebar as HTMLElement).style.top = '0';
    (ctx.sidebar as HTMLElement).style.height = '100%';
    const historyPanelEl = ctx.root.querySelector('#historyPanel') as HTMLElement | null;
    if (historyPanelEl) { historyPanelEl.style.top = '0'; historyPanelEl.style.height = '100%'; }
  }

  function showEmbeddedBackBtn(): void {
    if (!ctx.embeddedMode) return;
    const btn = ctx.root.querySelector('#floatingBackBtn') as HTMLElement | null;
    if (btn) btn.style.display = 'block';
    updateEmbeddedBackBtnPosition();
  }

  function hideEmbeddedBackBtn(): void {
    if (!ctx.embeddedMode) return;
    const btn = ctx.root.querySelector('#floatingBackBtn') as HTMLElement | null;
    if (btn) btn.style.display = 'none';
  }

  function updateEmbeddedBackBtnPosition(): void {
    if (!ctx.embeddedMode) return;
    const btn = ctx.root.querySelector('#floatingBackBtn') as HTMLElement | null;
    if (!btn) return;
    const leftPanelEl = ctx.root.querySelector('#leftPanel') as HTMLElement | null;
    const lpWidth = leftPanelEl ? leftPanelEl.offsetWidth : 48;
    btn.style.left = (lpWidth + 12) + 'px';
  }

  function setupEventListeners(): void {
    // Mousedown for panning
    ctx.erdContainer.addEventListener('mousedown', (e) => {
      if (e.target === ctx.erdContainer || e.target === ctx.viewport || e.target === ctx.svg) {
        ctx.isPanning = true;
        ctx.panStartX = e.clientX - ctx.panX;
        ctx.panStartY = e.clientY - ctx.panY;
        ctx.erdContainer.style.cursor = 'grabbing';
      }
    });

    // Mousemove for drag/pan
    document.addEventListener('mousemove', (e) => {
      const cRect = ctx.erdContainer.getBoundingClientRect();

      if (ctx.draggingNode && ctx.currentView === 'grouped') {
        const newX = (e.clientX - cRect.left - ctx.panX) / ctx.scale - ctx.dragOffsetX;
        const newY = (e.clientY - cRect.top - ctx.panY) / ctx.scale - ctx.dragOffsetY;
        const groupsMod = (ctx as any)._groupsModule;

        if (ctx.draggingNode.startsWith('grp_')) {
          const gName = ctx.draggingNode.substring(4);
          const oldCenter = groupsMod ? groupsMod.getGroupCenter(gName) : null;
          ctx.groupNodePositions[gName] = { x: newX, y: newY };
          const gEl = ctx.groupNodeElements[gName];
          if (gEl) { gEl.style.left = newX + 'px'; gEl.style.top = newY + 'px'; }
          if (ctx.expandedGroups.has(gName) && groupsMod) {
            const newCenter = groupsMod.getGroupCenter(gName);
            if (oldCenter && newCenter) {
              const deltaX = newCenter.x - oldCenter.x, deltaY = newCenter.y - oldCenter.y;
              const gg = ctx.groupNodesList.find(g => g.name === gName);
              if (gg) {
                (gg as any).objects.forEach((objId: string) => {
                  const ep = ctx.groupEntityPositions[objId];
                  if (ep) {
                    ep.x += deltaX; ep.y += deltaY;
                    const eEl = ctx.groupEntityElements[objId];
                    if (eEl) { eEl.style.left = ep.x + 'px'; eEl.style.top = ep.y + 'px'; }
                  }
                });
              }
              groupsMod.positionGroupRect(gName);
            }
          }
          ctx.redrawGroupEdges();
        } else if (ctx.draggingNode.startsWith('gent_')) {
          const entId = ctx.draggingNode.substring(5);
          ctx.groupEntityPositions[entId] = { x: newX, y: newY };
          const entEl = ctx.groupEntityElements[entId];
          if (entEl) { entEl.style.left = newX + 'px'; entEl.style.top = newY + 'px'; }
          ctx.redrawGroupEdges();
        }

      } else if (ctx.draggingNode && ctx.currentView === 'top') {
        const pos = ctx.nodePositions[ctx.draggingNode];
        const el = ctx.nodeElements[ctx.draggingNode];
        if (pos && el) {
          pos.x = (e.clientX - cRect.left - ctx.panX) / ctx.scale - ctx.dragOffsetX;
          pos.y = (e.clientY - cRect.top - ctx.panY) / ctx.scale - ctx.dragOffsetY;
          el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
          ctx.drawEdges();
        }

      } else if (ctx.draggingNode && ctx.currentView === 'drilldown') {
        const pos = ctx.ddPositions[ctx.draggingNode];
        const el = ctx.ddElements[ctx.draggingNode];
        if (pos && el) {
          const newX = (e.clientX - cRect.left - ctx.panX) / ctx.scale - ctx.dragOffsetX;
          const newY = (e.clientY - cRect.top - ctx.panY) / ctx.scale - ctx.dragOffsetY;
          let halfSize = ctx.ENTITY_SIZE / 2;
          if (ctx.draggingNode === '__center__') halfSize = 60;
          else if (ctx.draggingNode.startsWith('eobj_')) halfSize = ctx.EDGE_OBJ_SIZE / 2;
          pos.x = newX + halfSize;
          pos.y = newY + halfSize;
          el.style.left = (pos.x - halfSize) + 'px';
          el.style.top = (pos.y - halfSize) + 'px';
          if (ctx.draggingNode === '__center__') ctx.ddCenterPos = pos;
          ctx.drawDrillEdges();
        }

      } else if (ctx.isPanning) {
        ctx.panX = e.clientX - ctx.panStartX;
        ctx.panY = e.clientY - ctx.panStartY;
        updateView();
      }
    });

    // Mouseup for drop/snap
    document.addEventListener('mouseup', () => {
      const layoutMod = (ctx as any)._layoutModule;
      const posMod = (ctx as any)._positionCacheModule;
      const groupsMod = (ctx as any)._groupsModule;

      if (ctx.draggingNode && ctx.currentView === 'grouped') {
        if (ctx.draggingNode.startsWith('grp_')) {
          const gName = ctx.draggingNode.substring(4);
          if (ctx.isGridMode && ctx.groupNodePositions[gName] && layoutMod) {
            layoutMod.snapDraggedNode(ctx.groupNodePositions, gName, layoutMod.getGridCellSize('groupCircle'), ctx.groupNodeElements);
            if (ctx.expandedGroups.has(gName) && groupsMod) groupsMod.positionGroupRect(gName);
            ctx.redrawGroupEdges();
          }
          const gp = ctx.groupNodePositions[gName];
          if (gp && posMod) posMod.saveCachedPosition('grp_' + gName, gp.x, gp.y);
        } else if (ctx.draggingNode.startsWith('gent_')) {
          const entId = ctx.draggingNode.substring(5);
          if (ctx.isGridMode && ctx.groupEntityPositions[entId] && layoutMod) {
            layoutMod.snapDraggedNode(ctx.groupEntityPositions, entId, layoutMod.getGridCellSize('groupEntity'), ctx.groupEntityElements);
            ctx.redrawGroupEdges();
          }
          const ep = ctx.groupEntityPositions[entId];
          if (ep && posMod) posMod.saveCachedPosition(entId, ep.x, ep.y);
        }

      } else if (ctx.draggingNode && ctx.currentView === 'top' && ctx.nodePositions[ctx.draggingNode]) {
        if (ctx.isGridMode && layoutMod) {
          layoutMod.snapDraggedNode(ctx.nodePositions, ctx.draggingNode, layoutMod.getGridCellSize('top'), ctx.nodeElements);
          ctx.drawEdges();
        }
        const pos = ctx.nodePositions[ctx.draggingNode];
        if (posMod) posMod.saveCachedPosition(ctx.draggingNode, pos.x, pos.y);

      } else if (ctx.draggingNode && ctx.currentView === 'drilldown' && ctx.ddPositions[ctx.draggingNode]) {
        if (ctx.isGridMode && layoutMod) {
          const ddCs = layoutMod.getGridCellSize('drilldown');
          const ddOcc = layoutMod.buildOccupancyMap(ctx.ddPositions, ddCs, ctx.draggingNode);
          const ddTarget = layoutMod.posToCell(ctx.ddPositions[ctx.draggingNode].x, ctx.ddPositions[ctx.draggingNode].y, ddCs);
          const ddFree = layoutMod.findNearestFreeCell(ddTarget.col, ddTarget.row, ddOcc);
          const ddSnap = layoutMod.cellToPos(ddFree.col, ddFree.row, ddCs);
          ctx.ddPositions[ctx.draggingNode].x = ddSnap.x;
          ctx.ddPositions[ctx.draggingNode].y = ddSnap.y;
          const ddEl = ctx.ddElements[ctx.draggingNode];
          if (ddEl) {
            let hs = ctx.ENTITY_SIZE / 2;
            if (ctx.draggingNode === '__center__') hs = 60;
            else if (ctx.draggingNode.startsWith('eobj_')) hs = ctx.EDGE_OBJ_SIZE / 2;
            ddEl.style.transition = 'left 0.15s ease, top 0.15s ease';
            ddEl.style.left = (ddSnap.x - hs) + 'px';
            ddEl.style.top = (ddSnap.y - hs) + 'px';
            setTimeout(() => { ddEl.style.transition = ''; }, 160);
          }
          if (ctx.draggingNode === '__center__') ctx.ddCenterPos = ctx.ddPositions[ctx.draggingNode];
          ctx.drawDrillEdges();
        }
        const pos = ctx.ddPositions[ctx.draggingNode];
        if (posMod) posMod.saveCachedPosition(ctx.draggingNode, pos.x, pos.y);
      }

      ctx.draggingNode = null;
      ctx.isPanning = false;
      ctx.erdContainer.style.cursor = 'grab';
    });

    // Wheel zoom
    ctx.erdContainer.addEventListener('wheel', (e) => {
      const lp = ctx.root.querySelector('#leftPanel') as HTMLElement | null;
      if (lp && lp.contains(e.target as Node)) return;
      e.preventDefault();

      if (ctx.wheelTimer) clearTimeout(ctx.wheelTimer);
      ctx.wheelTimer = setTimeout(() => { ctx.wheelActive = false; ctx.wheelAccum = 0; }, WHEEL_IDLE_MS);

      if (!ctx.wheelActive) {
        ctx.wheelAccum += e.deltaY;
        if (Math.abs(ctx.wheelAccum) < WHEEL_THRESHOLD) return;
        ctx.wheelActive = true;
      }

      const delta = 1 - e.deltaY * ZOOM_SPEED;
      const newScale = Math.max(0.2, Math.min(3, ctx.scale * delta));
      const rect = ctx.erdContainer.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      ctx.panX = mx - (mx - ctx.panX) * (newScale / ctx.scale);
      ctx.panY = my - (my - ctx.panY) * (newScale / ctx.scale);
      ctx.scale = newScale;
      updateView();
    }, { passive: false } as EventListenerOptions);

    // Window resize
    window.addEventListener('resize', () => {
      if (ctx.currentView === 'grouped') { ctx.redrawGroupEdges(); updateView(); }
      else if (ctx.currentView === 'top') { ctx.drawEdges(); updateView(); }
    });
  }

  // Expose on ctx
  ctx.updateView = updateView;
  ctx.updateEmbeddedBackBtnPosition = updateEmbeddedBackBtnPosition;

  return {
    updateView, zoomIn, zoomOut, resetView, toggleGridMode, runAutoLayout,
    toggleLeftPanel, setupEmbeddedMode, showEmbeddedBackBtn, hideEmbeddedBackBtn,
    updateEmbeddedBackBtnPosition, setupEventListeners
  };
}