/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext, ErdNode, Position } from './types';
import { getDiffClassFromStatus, getNodeClass, getNodeIcon, escapeHtmlStr } from './utils';
import { generateClassicPath, generateRoutedPath } from './pathGenerators';

export interface DrilldownModule {
  enterDrillDown(nodeData: ErdNode): void;
  exitDrillDown(): void;
  drawDrillEdges(): void;
}

export function createDrilldownModule(ctx: ErdContext): DrilldownModule {

  function isClassicMode(): boolean { return ctx.routingMode === 'classic'; }
  function edgeStroke(): string { return isClassicMode() ? '3' : '1.5'; }
  function edgeGlowWidth(): string { return isClassicMode() ? '8' : '5'; }
  function edgeGlowOpacity(): string { return isClassicMode() ? '0.2' : '0.15'; }

  function createArrowMarkers(svgEl: SVGSVGElement, colors: Record<string, string>, prefix: string): void {
    const sz = isClassicMode() ? 12 : 8;
    const half = sz / 2;
    const refX = isClassicMode() ? 10 : 7;
    const arrowD = isClassicMode() ? 'M 0 0 L 12 6 L 0 12 L 3 6 Z' : 'M 0 0 L 8 4 L 0 8 L 2 4 Z';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    Object.entries(colors).forEach(([name, color]) => {
      const mk = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      mk.setAttribute('id', prefix + name);
      mk.setAttribute('markerWidth', String(sz)); mk.setAttribute('markerHeight', String(sz));
      mk.setAttribute('refX', String(refX)); mk.setAttribute('refY', String(half));
      mk.setAttribute('orient', 'auto'); mk.setAttribute('markerUnits', 'userSpaceOnUse');
      const ap = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      ap.setAttribute('d', arrowD);
      ap.setAttribute('fill', color);
      mk.appendChild(ap);
      defs.appendChild(mk);
    });
    svgEl.appendChild(defs);
  }

  function drawDrillArrow(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, color: string, markerName: string, dashed: boolean, idx: number, dimmed: boolean, fromKey: string, toKey: string): void {
    const useColor = dimmed ? '#c9c7c5' : color;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const fex = x1 + Math.cos(angle) * (r1 + 5);
    const fey = y1 + Math.sin(angle) * (r1 + 5);
    const tex = x2 - Math.cos(angle) * (r2 + (isClassicMode() ? 15 : 10));
    const tey = y2 - Math.sin(angle) * (r2 + (isClassicMode() ? 15 : 10));

    let d: string;
    if (isClassicMode()) {
      const co = Math.min(25, Math.max(1, Math.sqrt((tex - fex) ** 2 + (tey - fey) ** 2)) * 0.12) * (idx % 2 === 0 ? 1 : -1);
      d = generateClassicPath(fex, fey, tex, tey, co).d;
    } else {
      const curveOffset = Math.min(25, Math.max(1, Math.sqrt((tex - fex) ** 2 + (tey - fey) ** 2)) * 0.12) * (idx % 2 === 0 ? 1 : -1);
      d = generateRoutedPath(ctx, fex, fey, tex, tey, curveOffset, ctx.ddPositions, ctx.ENTITY_SIZE);
    }

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (fromKey) g.setAttribute('data-from', fromKey);
    if (toKey) g.setAttribute('data-to', toKey);

    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', d);
    glow.setAttribute('stroke', useColor); glow.setAttribute('stroke-width', edgeGlowWidth());
    glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', dimmed ? '0.05' : edgeGlowOpacity());
    glow.setAttribute('stroke-linecap', 'round');
    if (dashed) glow.setAttribute('stroke-dasharray', '10,6');
    g.appendChild(glow);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', useColor); path.setAttribute('stroke-width', edgeStroke());
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#dd-arrow-' + markerName + ')');
    path.setAttribute('stroke-linecap', 'round');
    if (dimmed) path.setAttribute('opacity', '0.35');
    if (dashed) path.setAttribute('stroke-dasharray', '10,6');
    g.appendChild(path);

    ctx.svg.appendChild(g);
  }

  function drawDrillEdges(): void {
    ctx.svg.innerHTML = '';
    if (!ctx.ddCenterPos) return;
    if (ctx.hideRelationships) return;

    const colors = { exclusive: '#706e6b', cross: '#b45309', chain: '#0070d2' };
    createArrowMarkers(ctx.svg, colors, 'dd-arrow-');

    const cp = ctx.ddCenterPos;
    const entApiNames = new Set(ctx.ddEntities.map(e => (e as any).apiName));
    let arrowIdx = 0;

    ctx.ddEntities.forEach(ent => {
      const entKey = 'ent_' + (ent as any).apiName;
      const pos = ctx.ddPositions[entKey];
      if (!pos) return;
      const entDimmed = ctx.highlightChangesActive && (!(ent as any).diffStatus || (ent as any).diffStatus === 'unchanged');

      const lookup = ctx.calcFieldsLookup[(ent as any).apiName];
      const directRefs: any[] = lookup ? (lookup as any).directReferences || [] : [];
      const isCross = (ent as any).placement === 'crossObject';

      let refsCenter = false;
      const calcTargetSet = new Set<string>();

      directRefs.forEach(ref => {
        if (ref.objectApiName === ctx.ddCenterId) {
          refsCenter = true;
        } else if (!ref.objectApiName && ref.fieldApiName && entApiNames.has(ref.fieldApiName)) {
          calcTargetSet.add(ref.fieldApiName);
        }
      });
      const calcTargets = Array.from(calcTargetSet);

      const referencesCenter = ((ent as any).referencedObjects || []).indexOf(ctx.ddCenterId) >= 0;
      if (directRefs.length === 0 && referencesCenter) {
        const color = isCross ? '#b45309' : '#706e6b';
        const markerName = isCross ? 'cross' : 'exclusive';
        drawDrillArrow(pos.x, pos.y, cp.x, cp.y, ctx.ENTITY_SIZE / 2, 60, color, markerName, isCross, arrowIdx++, entDimmed, entKey, '__center__');
      } else {
        if (refsCenter) {
          const color = isCross ? '#b45309' : '#706e6b';
          const markerName = isCross ? 'cross' : 'exclusive';
          drawDrillArrow(pos.x, pos.y, cp.x, cp.y, ctx.ENTITY_SIZE / 2, 60, color, markerName, isCross, arrowIdx++, entDimmed, entKey, '__center__');
        }
        calcTargets.forEach(targetApiName => {
          const targetPos = ctx.ddPositions['ent_' + targetApiName];
          const targetEnt = ctx.ddEntities.find(e => (e as any).apiName === targetApiName);
          const targetDimmed = ctx.highlightChangesActive && (!targetEnt || !(targetEnt as any).diffStatus || (targetEnt as any).diffStatus === 'unchanged');
          if (targetPos) {
            drawDrillArrow(pos.x, pos.y, targetPos.x, targetPos.y, ctx.ENTITY_SIZE / 2, ctx.ENTITY_SIZE / 2, '#0070d2', 'chain', false, arrowIdx++, entDimmed && targetDimmed, entKey, 'ent_' + targetApiName);
          }
        });
        if (!refsCenter && calcTargets.length === 0 && referencesCenter) {
          const color = isCross ? '#b45309' : '#706e6b';
          const markerName = isCross ? 'cross' : 'exclusive';
          drawDrillArrow(pos.x, pos.y, cp.x, cp.y, ctx.ENTITY_SIZE / 2, 60, color, markerName, isCross, arrowIdx++, entDimmed, entKey, '__center__');
        }
      }
    });

    ctx.ddEntities.forEach(ent => {
      const entKey = 'ent_' + (ent as any).apiName;
      const ep = ctx.ddPositions[entKey];
      if (!ep) return;
      const entDimmed = ctx.highlightChangesActive && (!(ent as any).diffStatus || (ent as any).diffStatus === 'unchanged');
      const directObjSet = new Set<string>();
      const cl = ctx.calcFieldsLookup[(ent as any).apiName];
      if (cl && (cl as any).directReferences) {
        (cl as any).directReferences.forEach((r: any) => { if (r.objectApiName) directObjSet.add(r.objectApiName); });
      } else {
        ((ent as any).referencedObjects || []).forEach((o: string) => { directObjSet.add(o); });
      }
      directObjSet.forEach(o => {
        if (o !== ctx.ddCenterId && ctx.ddEdgeObjectIds.has(o)) {
          const op = ctx.ddPositions['eobj_' + o];
          if (op) {
            drawDrillArrow(ep.x, ep.y, op.x, op.y, ctx.ENTITY_SIZE / 2, ctx.EDGE_OBJ_SIZE / 2, '#b45309', 'cross', true, arrowIdx++, entDimmed, entKey, 'eobj_' + o);
          }
        }
      });
    });
  }

  function getDrillChainRelated(startApiName: string): Set<string> {
    const relatedKeys = new Set<string>();
    const visited = new Set<string>();
    const entNames = new Set(ctx.ddEntities.map(e => (e as any).apiName));

    function walk(apiName: string): void {
      if (visited.has(apiName)) return;
      visited.add(apiName);
      relatedKeys.add('ent_' + apiName);

      const ent = ctx.ddEntities.find(e => (e as any).apiName === apiName);
      const lookup = ctx.calcFieldsLookup[apiName];
      const directRefs: any[] = lookup ? (lookup as any).directReferences || [] : [];
      const referencesCenter = ent && ((ent as any).referencedObjects || []).indexOf(ctx.ddCenterId) >= 0;

      if (directRefs.length === 0) {
        if (referencesCenter) relatedKeys.add('__center__');
      } else {
        directRefs.forEach(ref => {
          if (ref.objectApiName) {
            if (ref.objectApiName === ctx.ddCenterId) {
              relatedKeys.add('__center__');
            } else if (ctx.ddEdgeObjectIds.has(ref.objectApiName)) {
              relatedKeys.add('eobj_' + ref.objectApiName);
            }
          } else if (ref.fieldApiName && entNames.has(ref.fieldApiName)) {
            walk(ref.fieldApiName);
          }
        });
      }

      if (!lookup) {
        ((ent && (ent as any).referencedObjects) || []).forEach((o: string) => {
          if (o === ctx.ddCenterId) {
            relatedKeys.add('__center__');
          } else if (ctx.ddEdgeObjectIds.has(o)) {
            relatedKeys.add('eobj_' + o);
          }
        });
      }
    }

    walk(startApiName);
    return relatedKeys;
  }

  function onDrillEntityHover(apiName: string): void {
    if (ctx.isTransitioning) return;
    if (ctx.ddHoverTimer) { clearTimeout(ctx.ddHoverTimer); ctx.ddHoverTimer = null; }
    ctx.ddHoverTimer = setTimeout(() => {
      ctx.ddHoverTimer = null;
      if (ctx.isTransitioning || ctx.ddHoverActive) return;
      ctx.ddHoverActive = true;
      const relatedKeys = getDrillChainRelated(apiName);

      Object.keys(ctx.ddElements).forEach(key => {
        const el = ctx.ddElements[key];
        if (relatedKeys.has(key)) {
          el.classList.add('dd-hover-related');
        } else {
          el.classList.add('dd-hover-dimmed');
        }
      });

      ctx.svg.querySelectorAll('g[data-from]').forEach(g => {
        const from = g.getAttribute('data-from');
        const to = g.getAttribute('data-to');
        if (from && to && relatedKeys.has(from) && relatedKeys.has(to)) {
          g.classList.add('dd-hover-related');
        } else {
          g.classList.add('dd-hover-dimmed');
        }
      });
    }, 1000);
  }

  function onDrillEntityLeave(): void {
    if (ctx.ddHoverTimer) { clearTimeout(ctx.ddHoverTimer); ctx.ddHoverTimer = null; }
    if (!ctx.ddHoverActive) return;
    ctx.ddHoverActive = false;
    Object.keys(ctx.ddElements).forEach(key => {
      ctx.ddElements[key].classList.remove('dd-hover-related', 'dd-hover-dimmed');
    });
    ctx.svg.querySelectorAll('g[data-from]').forEach(g => {
      g.classList.remove('dd-hover-related', 'dd-hover-dimmed');
    });
  }

  function enterDrillDown(nodeData: ErdNode): void {
    if (ctx.isTransitioning) return;
    ctx.isTransitioning = true;
    ctx.closeSidebar();
    if (ctx.highlightChangesActive) {
      ctx.highlightChangesActive = false;
      const btn = ctx.root.querySelector('#changesToggleBtn') as HTMLElement | null;
      if (btn) {
        btn.classList.remove('route-active');
        const lbl = btn.querySelector('.lp-btn-label');
        if (lbl) lbl.textContent = 'Highlight Changes';
      }
    }

    ctx.savedTopViewState = { panX: ctx.panX, panY: ctx.panY, scale: ctx.scale };
    ctx.savedDrillNodeId = nodeData.id;
    ctx.savedHideRelationships = ctx.hideRelationships;
    ctx.hideRelationships = false;
    ctx.updateLayoutControls();
    ctx.drilldownTarget = nodeData;

    const allEntities: any[] = [];
    (nodeData.relatedCalcDims || []).forEach((e: any) => { if (!e.isSystemDefinition) allEntities.push({ ...e, cssClass: 'calc-dim', typeLabel: 'Calc Dimension' }); });
    (nodeData.relatedCalcMeas || []).forEach((e: any) => { if (!e.isSystemDefinition) allEntities.push({ ...e, cssClass: 'calc-meas', typeLabel: 'Calc Measurement' }); });
    (nodeData.relatedHierarchies || []).forEach((e: any) => allEntities.push({ ...e, cssClass: 'dim-hier', typeLabel: 'Dim Hierarchy' }));
    (nodeData.relatedMetrics || []).forEach((e: any) => allEntities.push({ ...e, cssClass: 'metric', typeLabel: 'Metric' }));
    (nodeData.relatedGroupings || []).forEach((e: any) => allEntities.push({ ...e, cssClass: 'grouping', typeLabel: 'Grouping' }));

    const knownApiNames = new Set(allEntities.map(e => e.apiName));
    const originalCount = allEntities.length;
    for (let oi = 0; oi < originalCount; oi++) {
      const ent = allEntities[oi];
      const info = ctx.calcFieldsLookup[ent.apiName];
      if (!info || !(info as any).directReferences) continue;
      (info as any).directReferences.forEach((ref: any) => {
        if (!ref.objectApiName && ref.fieldApiName && !knownApiNames.has(ref.fieldApiName)) {
          const missingCalc = ctx.calcFieldsLookup[ref.fieldApiName];
          if (missingCalc) {
            const cssClass = (missingCalc as any).entityType === 'calculatedDimension' ? 'calc-dim' : 'calc-meas';
            const typeLabel = (missingCalc as any).entityType === 'calculatedDimension' ? 'Calc Dimension' : 'Calc Measurement';
            allEntities.push({
              apiName: (missingCalc as any).apiName,
              label: (missingCalc as any).label,
              expression: (missingCalc as any).expression,
              placement: (missingCalc as any).placement,
              referencedObjects: (missingCalc as any).referencedObjects || [],
              directReferences: (missingCalc as any).directReferences,
              cssClass, typeLabel, type: cssClass,
              baseModelApiName: (missingCalc as any).baseModelApiName || null,
              diffStatus: (missingCalc as any).diffStatus || null,
            });
            knownApiNames.add(ref.fieldApiName);
          }
        }
      });
    }

    ctx.ddEntities = allEntities as any;
    ctx.ddCenterId = nodeData.id;
    ctx.ddPositions = {};
    ctx.ddElements = {};
    ctx.ddEdgeObjectIds = new Set();

    allEntities.forEach(ent => {
      const cl0 = ctx.calcFieldsLookup[ent.apiName];
      if (cl0 && (cl0 as any).directReferences) {
        (cl0 as any).directReferences.forEach((r: any) => {
          if (r.objectApiName && r.objectApiName !== nodeData.id) ctx.ddEdgeObjectIds.add(r.objectApiName);
        });
      } else {
        (ent.referencedObjects || []).forEach((o: string) => {
          if (o !== nodeData.id) ctx.ddEdgeObjectIds.add(o);
        });
      }
    });
    const edgeObjArr = Array.from(ctx.ddEdgeObjectIds);

    const drillNodes: Array<{ id: string; type: string }> = [{ id: '__center__', type: 'center' }];
    const drillEdges: Array<{ from: string; to: string }> = [];
    const entApiNames = new Set(allEntities.map(e => e.apiName));

    allEntities.forEach(ent => {
      drillNodes.push({ id: 'ent_' + ent.apiName, type: 'entity' });
      const lookup = ctx.calcFieldsLookup[ent.apiName];
      const directRefs: any[] = lookup ? (lookup as any).directReferences || [] : [];
      let refsOtherCalcs = false;
      const addedCalcEdges = new Set<string>();

      directRefs.forEach(ref => {
        if (!ref.objectApiName && ref.fieldApiName && entApiNames.has(ref.fieldApiName)) {
          const edgeKey = 'ent_' + ent.apiName + '>' + 'ent_' + ref.fieldApiName;
          if (addedCalcEdges.has(edgeKey)) return;
          addedCalcEdges.add(edgeKey);
          drillEdges.push({ from: 'ent_' + ent.apiName, to: 'ent_' + ref.fieldApiName });
          refsOtherCalcs = true;
        }
      });

      let refsCenter = false;
      directRefs.forEach(ref => { if (ref.objectApiName === nodeData.id) refsCenter = true; });
      const referencesCenter = (ent.referencedObjects || []).indexOf(nodeData.id) >= 0;
      if (refsCenter || (!refsOtherCalcs && referencesCenter)) {
        drillEdges.push({ from: '__center__', to: 'ent_' + ent.apiName });
      }
    });

    edgeObjArr.forEach(objId => { drillNodes.push({ id: 'eobj_' + objId, type: 'edgeObj' }); });
    allEntities.forEach(ent => {
      const directObjSet = new Set<string>();
      const cl = ctx.calcFieldsLookup[ent.apiName];
      if (cl && (cl as any).directReferences) {
        (cl as any).directReferences.forEach((r: any) => { if (r.objectApiName) directObjSet.add(r.objectApiName); });
      } else {
        (ent.referencedObjects || []).forEach((o: string) => { directObjSet.add(o); });
      }
      directObjSet.forEach(o => {
        if (o !== nodeData.id && ctx.ddEdgeObjectIds.has(o)) {
          drillEdges.push({ from: 'ent_' + ent.apiName, to: 'eobj_' + o });
        }
      });
    });

    const algorithmPositions = ctx.getGridCellSize
      ? ((): Record<string, Position> => {
          // Layout via layout module (already on ctx)
          const tmpDdPositions: Record<string, Position> = {};
          const cs = ctx.getGridCellSize('drilldown');
          const iterations = 300; const repulsion = 8000; const springLength = 120;
          const springStiffness = 0.08; const baseGravity = 0.02;
          const gravity = baseGravity * Math.max(1, drillNodes.length / 10);
          const maxDisplacement = 50; const padding = 80;
          const canvasW = Math.max(800, Math.min(drillNodes.length * 100, 2000));
          const canvasH = Math.max(600, Math.min(drillNodes.length * 70, 1500));
          const centerX = canvasW / 2, centerY = canvasH / 2;
          const degree: Record<string, number> = {};
          drillNodes.forEach(n => { degree[n.id] = 0; });
          drillEdges.forEach(e => { if (degree[e.from] !== undefined) degree[e.from]++; if (degree[e.to] !== undefined) degree[e.to]++; });
          const positions: Record<string, Position> = {};
          const velocities: Record<string, Position> = {};
          drillNodes.forEach(n => {
            if (n.id === '__center__') { positions[n.id] = { x: centerX, y: centerY }; }
            else { const angle = Math.random() * 2 * Math.PI; const r = 150 + Math.random() * 200; positions[n.id] = { x: centerX + Math.cos(angle) * r, y: centerY + Math.sin(angle) * r }; }
            velocities[n.id] = { x: 0, y: 0 };
          });
          for (let iter = 0; iter < iterations; iter++) {
            const forces: Record<string, Position> = {};
            drillNodes.forEach(n => { forces[n.id] = { x: 0, y: 0 }; });
            for (let i = 0; i < drillNodes.length; i++) {
              for (let j = i + 1; j < drillNodes.length; j++) {
                const a = drillNodes[i].id, b = drillNodes[j].id;
                const dx = positions[a].x - positions[b].x, dy = positions[a].y - positions[b].y;
                const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const force = (repulsion * (1 + degree[a]) * (1 + degree[b])) / (dist * dist);
                const fx = force * dx / dist, fy = force * dy / dist;
                forces[a].x += fx; forces[a].y += fy; forces[b].x -= fx; forces[b].y -= fy;
              }
            }
            drillEdges.forEach(e => {
              const pa = positions[e.from], pb = positions[e.to];
              if (!pa || !pb) return;
              const dx = pb.x - pa.x, dy = pb.y - pa.y;
              const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
              const force = springStiffness * (dist - springLength);
              const fx = force * dx / dist, fy = force * dy / dist;
              forces[e.from].x += fx; forces[e.from].y += fy; forces[e.to].x -= fx; forces[e.to].y -= fy;
            });
            drillNodes.forEach(n => {
              forces[n.id].x += (centerX - positions[n.id].x) * gravity;
              forces[n.id].y += (centerY - positions[n.id].y) * gravity;
            });
            drillNodes.forEach(n => {
              if (n.id === '__center__') return;
              velocities[n.id].x = (velocities[n.id].x + forces[n.id].x) * 0.85;
              velocities[n.id].y = (velocities[n.id].y + forces[n.id].y) * 0.85;
              const speed = Math.sqrt(velocities[n.id].x ** 2 + velocities[n.id].y ** 2);
              if (speed > maxDisplacement) { velocities[n.id].x *= maxDisplacement / speed; velocities[n.id].y *= maxDisplacement / speed; }
              positions[n.id].x += velocities[n.id].x;
              positions[n.id].y += velocities[n.id].y;
            });
          }
          const xs = Object.values(positions).map(p => p.x);
          const ys = Object.values(positions).map(p => p.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
          const result: Record<string, Position> = {};
          drillNodes.forEach(n => {
            result[n.id] = {
              x: padding + ((positions[n.id].x - minX) / rangeX) * (canvasW - 2 * padding),
              y: padding + ((positions[n.id].y - minY) / rangeY) * (canvasH - 2 * padding)
            };
          });
          const snapAll = (posMap: Record<string, Position>, gridCs: { w: number; h: number }): void => {
            if (!ctx.isGridMode) return;
            const items: Array<{ id: string; col: number; row: number; dist: number }> = [];
            Object.keys(posMap).forEach(id => {
              const p = posMap[id]; if (!p) return;
              const col = Math.round(p.x / gridCs.w), row = Math.round(p.y / gridCs.h);
              const ideal = { x: col * gridCs.w, y: row * gridCs.h };
              const dist = Math.sqrt((p.x - ideal.x) ** 2 + (p.y - ideal.y) ** 2);
              items.push({ id, col, row, dist });
            });
            items.sort((a, b) => a.dist - b.dist);
            const occ: Record<string, boolean> = {};
            const gridKey = (c: number, r: number): string => c + ',' + r;
            const findFree = (tc: number, tr: number): { col: number; row: number } => {
              if (!occ[gridKey(tc, tr)]) return { col: tc, row: tr };
              for (let rad = 1; rad <= 50; rad++) {
                for (let dc = -rad; dc <= rad; dc++) {
                  for (let dr = -rad; dr <= rad; dr++) {
                    if (Math.abs(dc) !== rad && Math.abs(dr) !== rad) continue;
                    const c = tc + dc, rr = tr + dr;
                    if (!occ[gridKey(c, rr)]) return { col: c, row: rr };
                  }
                }
              }
              return { col: tc, row: tr };
            };
            items.forEach(item => {
              const key = gridKey(item.col, item.row);
              if (!occ[key]) { occ[key] = true; posMap[item.id] = { x: item.col * gridCs.w, y: item.row * gridCs.h }; }
              else { const free = findFree(item.col, item.row); occ[gridKey(free.col, free.row)] = true; posMap[item.id] = { x: free.col * gridCs.w, y: free.row * gridCs.h }; }
            });
          };
          snapAll(result, cs);
          return result;
        })()
      : {} as Record<string, Position>;

    ctx.pendingDrilldownPositions = null;

    const { saveCachedPosition, saveAllCachedPositions, requestPositionsForContext } = (ctx as any)._positionCacheModule || {};
    if (requestPositionsForContext) requestPositionsForContext('drilldown:' + nodeData.id);

    // Phase 1: Animate top-level out
    ctx.svg.classList.add('morph-hide');
    ctx.root.querySelectorAll('.edge-label').forEach(el => el.classList.add('morph-hide'));

    const viewCx = (ctx.erdContainer.clientWidth / 2 - ctx.panX) / ctx.scale;
    const viewCy = (ctx.erdContainer.clientHeight / 2 - ctx.panY) / ctx.scale;

    ctx.nodes.forEach(n => {
      const el = ctx.nodeElements[n.id];
      if (!el) return;
      el.classList.add('morph-animate');
      if (n.id === nodeData.id) {
        el.style.left = (viewCx - ctx.NODE_SIZE / 2) + 'px';
        el.style.top = (viewCy - ctx.NODE_SIZE / 2) + 'px';
      } else {
        el.classList.add('morph-fade-out');
      }
    });

    // Phase 2: After fade, render drill-down
    setTimeout(() => {
      ctx.currentView = 'drilldown';
      const ddLegend = ctx.root.querySelector('#drilldownLegendSection') as HTMLElement | null;
      if (ddLegend) ddLegend.style.display = '';

      const useCached = ctx.pendingDrilldownPositions && Object.keys(ctx.pendingDrilldownPositions).length > 0;
      const drillPositions = useCached ? ctx.pendingDrilldownPositions! : algorithmPositions;
      Object.keys(drillPositions).forEach(k => { ctx.ddPositions[k] = drillPositions[k]; });
      if (useCached) {
        let hadMissing = false;
        Object.keys(algorithmPositions).forEach(k => {
          if (!ctx.ddPositions[k]) { ctx.ddPositions[k] = algorithmPositions[k]; hadMissing = true; }
        });
        if (hadMissing && saveAllCachedPositions) saveAllCachedPositions(ctx.ddPositions);
      }

      const cs = ctx.getGridCellSize('drilldown');
      // Use snapAllToGrid via context or inline
      if (!useCached && saveAllCachedPositions) saveAllCachedPositions(ctx.ddPositions);
      ctx.pendingDrilldownPositions = null;
      ctx.ddCenterPos = ctx.ddPositions['__center__'] || algorithmPositions['__center__'];

      ctx.nodesLayer.innerHTML = '';
      ctx.svg.innerHTML = '';
      ctx.svg.classList.remove('morph-hide');

      const backBtn = ctx.root.querySelector('#backBtn') as HTMLElement | null;
      if (backBtn) backBtn.style.display = 'flex';
      const headerTitle = ctx.root.querySelector('#headerTitle') as HTMLElement | null;
      if (headerTitle) headerTitle.textContent = 'Drill-Down: ' + nodeData.label;
      if (ctx.embeddedMode) {
        const floatingBtn = ctx.root.querySelector('#floatingBackBtn') as HTMLElement | null;
        if (floatingBtn) { floatingBtn.style.display = 'block'; ctx.updateEmbeddedBackBtnPosition(); }
      }
      const topStats = ctx.root.querySelector('#topStats') as HTMLElement | null;
      if (topStats) topStats.style.display = 'none';

      const shGrp = ctx.root.querySelector('#showHideGroup') as HTMLElement | null;
      if (shGrp) shGrp.classList.remove('visible');
      const gridBtn = ctx.root.querySelector('#layoutGridBtn') as HTMLElement | null;
      const forceBtn = ctx.root.querySelector('#layoutForceBtn') as HTMLElement | null;
      const autoBtn = ctx.root.querySelector('#autoLayoutBtn') as HTMLElement | null;
      if (gridBtn) gridBtn.style.display = 'none';
      if (forceBtn) forceBtn.style.display = 'none';
      if (autoBtn) autoBtn.style.display = '';

      // Fit drill-down viewport
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
      } else {
        ctx.panX = 0; ctx.panY = 0; ctx.scale = 1;
      }
      ctx.updateView();

      const cp = ctx.ddCenterPos!;
      const CENTER_RADIUS = 60;
      const dims = ctx.showUnmapped ? (nodeData.dimensions || []) : (nodeData.dimensions || []).filter((d: any) => !d.unmapped);
      const meas = ctx.showUnmapped ? (nodeData.measurements || []) : (nodeData.measurements || []).filter((m: any) => !m.unmapped);
      const isLV = nodeData.type === 'logicalView';
      const isDLO = (nodeData as any).dataObjectType === 'Dlo';
      const centerIcon = getNodeIcon(ctx, nodeData);

      const centerDiv = document.createElement('div');
      centerDiv.className = 'center-node' + (isLV ? ' lv' : '') + (isDLO ? ' dlo' : '') + getDiffClassFromStatus(nodeData.diffStatus === 'modified-children' ? undefined : nodeData.diffStatus) + (nodeData.baseModelApiName ? ' pattern-base' : '');
      centerDiv.setAttribute('data-dd-key', '__center__');
      centerDiv.style.left = (cp.x - CENTER_RADIUS) + 'px';
      centerDiv.style.top = (cp.y - CENTER_RADIUS) + 'px';

      const isCenterShared = (nodeData as any).tableType === 'Shared';
      const isCenterBase = !!nodeData.baseModelApiName;
      const centerNeedsWrap = isCenterShared || isCenterBase;
      const centerSharedBadge = isCenterShared ? '<div class="shared-badge">' + ctx.sharedSvg + '</div>' : '';
      const centerBaseBadge = isCenterBase ? '<div class="base-model-badge">BASE</div>' : '';
      const centerCircle = '<div class="node-circle"><div class="node-icon">' + centerIcon + '</div></div>';
      let centerHtml = centerNeedsWrap ? '<div class="node-circle-wrap">' + centerCircle + centerSharedBadge + centerBaseBadge + '</div>' : centerCircle;
      centerHtml += '<div class="node-label"><div class="node-title">' + escapeHtmlStr(nodeData.label) + '</div>';
      centerHtml += '<div class="center-badges">';
      if (dims.length > 0) centerHtml += '<span class="center-badge dim">' + dims.length + ' dims</span>';
      if (meas.length > 0) centerHtml += '<span class="center-badge meas">' + meas.length + ' meas</span>';
      centerHtml += '</div></div>';
      centerDiv.innerHTML = centerHtml;

      let centerClickStart = 0, centerClickPos = { x: 0, y: 0 };
      centerDiv.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        centerClickStart = Date.now();
        centerClickPos = { x: e.clientX, y: e.clientY };
        ctx.draggingNode = '__center__';
        const rect = centerDiv.getBoundingClientRect();
        ctx.dragOffsetX = e.clientX - rect.left;
        ctx.dragOffsetY = e.clientY - rect.top;
      });
      centerDiv.addEventListener('mouseup', (e) => {
        const dur = Date.now() - centerClickStart;
        const dist = Math.sqrt((e.clientX - centerClickPos.x) ** 2 + (e.clientY - centerClickPos.y) ** 2);
        if (dur < 300 && dist < 10) { ctx.openSidebar(nodeData); }
      });
      ctx.nodesLayer.appendChild(centerDiv);
      ctx.ddElements['__center__'] = centerDiv;

      const ddDivs: Array<{ div: HTMLElement; pos: Position; key: string }> = [];

      allEntities.forEach(ent => {
        const key = 'ent_' + ent.apiName;
        const pos = ctx.ddPositions[key];
        if (!pos) return;

        const div = document.createElement('div');
        div.className = 'entity-node ' + ent.cssClass + (ent.placement === 'crossObject' ? ' cross-object' : '') + getDiffClassFromStatus(ent.diffStatus) + (ent.baseModelApiName ? ' pattern-base' : '') + ' morph-animate morph-fade-in-start';
        div.setAttribute('data-dd-key', key);
        div.style.left = (cp.x - ctx.ENTITY_SIZE / 2) + 'px';
        div.style.top = (cp.y - ctx.ENTITY_SIZE / 2) + 'px';

        const svgIcon = ctx.entitySvgIcons[ent.cssClass];
        const fallback = ctx.entityFallbackIcons[ent.cssClass] || '?';
        const iconContent = svgIcon ? '<div class="entity-circle-icon">' + svgIcon + '</div>' : '<span class="entity-circle-icon-text">' + fallback + '</span>';
        const entBaseBadge = ent.baseModelApiName ? '<div class="base-model-badge">BASE</div>' : '';
        let html = '<div class="entity-circle" style="' + (ent.baseModelApiName ? 'position:relative;overflow:visible;' : '') + '">' + iconContent + entBaseBadge + '</div>';
        html += '<div class="entity-label-wrap"><div class="entity-title">' + escapeHtmlStr(ent.label) + '</div>';
        html += '<div class="entity-type-label">' + ent.typeLabel + '</div>';
        if (ent.placement === 'crossObject') {
          const others = (ent.referencedObjects || []).filter((o: string) => o !== nodeData.id);
          if (others.length > 0) {
            const otherLabels = others.map((o: string) => { const nd = ctx.nodes.find(nn => nn.id === o); return nd ? escapeHtmlStr(nd.label) : escapeHtmlStr(o); });
            html += '<div class="entity-refs">' + otherLabels.join(', ') + '</div>';
          }
        }
        html += '</div>';
        div.innerHTML = html;

        let entClickStart = 0, entClickPos = { x: 0, y: 0 };
        div.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          onDrillEntityLeave();
          entClickStart = Date.now();
          entClickPos = { x: e.clientX, y: e.clientY };
          ctx.draggingNode = key;
          const rect = div.getBoundingClientRect();
          ctx.dragOffsetX = e.clientX - rect.left;
          ctx.dragOffsetY = e.clientY - rect.top;
        });
        div.addEventListener('mouseup', (e) => {
          const dur = Date.now() - entClickStart;
          const dist = Math.sqrt((e.clientX - entClickPos.x) ** 2 + (e.clientY - entClickPos.y) ** 2);
          if (dur < 300 && dist < 10) { ctx.openSidebar(Object.assign({}, ent, { origType: ent.type, type: ent.cssClass }) as ErdNode); }
        });
        div.addEventListener('mouseenter', () => { onDrillEntityHover(ent.apiName); });
        div.addEventListener('mouseleave', () => { onDrillEntityLeave(); });

        ctx.nodesLayer.appendChild(div);
        ctx.ddElements[key] = div;
        ddDivs.push({ div, pos, key });
      });

      edgeObjArr.forEach(objId => {
        const key = 'eobj_' + objId;
        const pos = ctx.ddPositions[key];
        if (!pos) return;

        const objNode = ctx.nodes.find(n => n.id === objId);
        const objLabel = objNode ? objNode.label : objId.replace(/_/g, ' ');
        const icon = objNode ? getNodeIcon(ctx, objNode) : ctx.tableSvg;

        const div = document.createElement('div');
        const edgeObjTypeClass = objNode ? getNodeClass(objNode) : 'data-object';
        div.className = 'edge-object ' + edgeObjTypeClass + ' morph-animate morph-fade-in-start';
        div.setAttribute('data-dd-key', key);
        div.style.left = (cp.x - ctx.EDGE_OBJ_SIZE / 2) + 'px';
        div.style.top = (cp.y - ctx.EDGE_OBJ_SIZE / 2) + 'px';
        div.innerHTML = '<div class="edge-object-circle"><div class="edge-object-icon">' + icon + '</div></div>' +
          '<div class="edge-object-label">' + escapeHtmlStr(objLabel) + '</div>';
        div.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          ctx.draggingNode = key;
          const rect = div.getBoundingClientRect();
          ctx.dragOffsetX = e.clientX - rect.left;
          ctx.dragOffsetY = e.clientY - rect.top;
        });
        div.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (objNode) enterDrillDown(objNode);
        });
        ctx.nodesLayer.appendChild(div);
        ctx.ddElements[key] = div;
        ddDivs.push({ div, pos, key });
      });

      requestAnimationFrame(() => {
        ddDivs.forEach((item, i) => {
          setTimeout(() => {
            item.div.classList.add('morph-fade-in');
            const halfSize = item.key.startsWith('eobj_') ? ctx.EDGE_OBJ_SIZE / 2 : ctx.ENTITY_SIZE / 2;
            item.div.style.left = (item.pos.x - halfSize) + 'px';
            item.div.style.top = (item.pos.y - halfSize) + 'px';
          }, 30 + i * 40);
        });
      });

      setTimeout(() => {
        drawDrillEdges();
        ctx.isTransitioning = false;
        ddDivs.forEach(item => {
          item.div.classList.remove('morph-animate', 'morph-fade-in-start', 'morph-fade-in');
        });
      }, 100 + ddDivs.length * 40 + 500);
    }, 500);
  }

  function exitDrillDown(): void {
    if (ctx.isTransitioning) return;
    ctx.isTransitioning = true;
    ctx.closeSidebar();
    onDrillEntityLeave();
    if (ctx.highlightChangesActive) {
      ctx.highlightChangesActive = false;
      const btn = ctx.root.querySelector('#changesToggleBtn') as HTMLElement | null;
      if (btn) {
        btn.classList.remove('route-active');
        const lbl = btn.querySelector('.lp-btn-label');
        if (lbl) lbl.textContent = 'Highlight Changes';
      }
    }

    ctx.svg.classList.add('morph-hide');

    const cp = ctx.ddCenterPos || { x: 500, y: 400 };
    const ddKeys = Object.keys(ctx.ddElements).filter(k => k !== '__center__');

    ddKeys.forEach((key, i) => {
      const el = ctx.ddElements[key];
      if (!el) return;
      el.classList.add('morph-animate');
      setTimeout(() => {
        const halfSize = key.startsWith('eobj_') ? ctx.EDGE_OBJ_SIZE / 2 : ctx.ENTITY_SIZE / 2;
        el.style.left = (cp.x - halfSize) + 'px';
        el.style.top = (cp.y - halfSize) + 'px';
        el.classList.add('morph-fade-out');
      }, i * 20);
    });

    setTimeout(() => {
      ctx.drilldownTarget = null;
      ctx.nodesLayer.innerHTML = '';
      ctx.groupContainersLayer.innerHTML = '';
      ctx.svg.innerHTML = '';
      ctx.svg.classList.remove('morph-hide');

      if ((ctx as any).savedGroupState) {
        ctx.expandedGroups = (ctx as any).savedGroupState.expanded;
        ctx.panX = (ctx as any).savedGroupState.panX;
        ctx.panY = (ctx as any).savedGroupState.panY;
        ctx.scale = (ctx as any).savedGroupState.scale;
        (ctx as any).savedGroupState = null;
        // ctx.renderGroupedView(); // will be delegated to groups module
        ctx.updateView();
        ctx.isTransitioning = false;
        return;
      }

      ctx.currentView = 'top';
      const backBtn = ctx.root.querySelector('#backBtn') as HTMLElement | null;
      if (backBtn) backBtn.style.display = 'none';
      const ddLegendExit = ctx.root.querySelector('#drilldownLegendSection') as HTMLElement | null;
      if (ddLegendExit) ddLegendExit.style.display = 'none';
      const exitViewSuffix = ctx.isCompareMode ? ' - Compare (Local vs Remote)' : (ctx.layoutMode === 'grid' ? ' - Grid View' : ' - ERD V2');
      const headerTitle = ctx.root.querySelector('#headerTitle') as HTMLElement | null;
      if (headerTitle) headerTitle.textContent = ctx.modelLabel + exitViewSuffix;

      if (ctx.embeddedMode) {
        const floatingBtn = ctx.root.querySelector('#floatingBackBtn') as HTMLElement | null;
        if (floatingBtn) floatingBtn.style.display = 'none';
      }
      const topStats = ctx.root.querySelector('#topStats') as HTMLElement | null;
      if (topStats) topStats.style.display = 'flex';

      if (ctx.hasUnmappedNodes || ctx.hasBaseModelNodes) {
        const shGrp2 = ctx.root.querySelector('#showHideGroup') as HTMLElement | null;
        if (shGrp2) shGrp2.classList.add('visible');
      }
      const relEye2 = ctx.root.querySelector('#relToggleBtn') as HTMLElement | null;
      if (relEye2) relEye2.style.display = '';
      const gridBtn2 = ctx.root.querySelector('#layoutGridBtn') as HTMLElement | null;
      const forceBtn2 = ctx.root.querySelector('#layoutForceBtn') as HTMLElement | null;
      if (gridBtn2) gridBtn2.style.display = '';
      if (forceBtn2) forceBtn2.style.display = '';
      ctx.hideRelationships = ctx.savedHideRelationships;
      ctx.updateLayoutControls();

      if (ctx.layoutMode === 'grid') {
        ctx.renderTopLevel();
        ctx.isTransitioning = false;
        return;
      }

      ctx.panX = ctx.savedTopViewState.panX;
      ctx.panY = ctx.savedTopViewState.panY;
      ctx.scale = ctx.savedTopViewState.scale;

      // Re-layout and animate back
      const layoutModule = (ctx as any)._layoutModule;
      if (layoutModule) layoutModule.layoutForceAtlas2(ctx.nodes, ctx.edges);

      const viewCx = (ctx.erdContainer.clientWidth / 2 - ctx.panX) / ctx.scale;
      const viewCy = (ctx.erdContainer.clientHeight / 2 - ctx.panY) / ctx.scale;

      ctx.nodes.forEach(n => {
        const div = document.createElement('div');
        div.className = 'node ' + getNodeClass(n) + getDiffClassFromStatus(n.diffStatus) + (n.baseModelApiName ? ' pattern-base' : '') + ' morph-animate';
        div.id = 'node-' + n.id;
        const iconSvg = getNodeIcon(ctx, n);
        const isMorphShared = (n as any).tableType === 'Shared';
        const isMorphBase = !!n.baseModelApiName;
        const morphNeedsWrap = isMorphShared || isMorphBase;
        const morphSharedBadge = isMorphShared ? '<div class="shared-badge">' + ctx.sharedSvg + '</div>' : '';
        const morphBaseBadge = isMorphBase ? '<div class="base-model-badge">BASE</div>' : '';
        const morphCircle = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
        div.innerHTML = (morphNeedsWrap ? '<div class="node-circle-wrap">' + morphCircle + morphSharedBadge + morphBaseBadge + '</div>' : morphCircle) +
          '<div class="node-label"><div class="node-title">' + escapeHtmlStr(n.label) + '</div></div>';

        const finalPos = ctx.nodePositions[n.id];
        if (n.id === ctx.savedDrillNodeId) {
          div.style.left = (viewCx - ctx.NODE_SIZE / 2) + 'px';
          div.style.top = (viewCy - ctx.NODE_SIZE / 2) + 'px';
        } else {
          div.style.left = (finalPos ? finalPos.x : 0) + 'px';
          div.style.top = (finalPos ? finalPos.y : 0) + 'px';
          div.classList.add('morph-fade-in-start');
        }

        let clickStartTime = 0, clickStartPos2 = { x: 0, y: 0 };
        div.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          clickStartTime = Date.now(); clickStartPos2 = { x: e.clientX, y: e.clientY };
          ctx.draggingNode = n.id;
          const rect = div.getBoundingClientRect();
          ctx.dragOffsetX = e.clientX - rect.left;
          ctx.dragOffsetY = e.clientY - rect.top;
        });
        div.addEventListener('mouseup', (e) => {
          const dur = Date.now() - clickStartTime;
          const dist = Math.sqrt((e.clientX - clickStartPos2.x) ** 2 + (e.clientY - clickStartPos2.y) ** 2);
          if (dur < 300 && dist < 10) { ctx.openSidebar(n); }
        });
        div.addEventListener('dblclick', (e) => { e.stopPropagation(); e.preventDefault(); enterDrillDown(n); });
        div.addEventListener('mouseenter', () => {
          const renderModule = (ctx as any)._renderModule;
          if (renderModule) renderModule.topLevelHoverIn(n.id);
        });
        div.addEventListener('mouseleave', () => {
          const renderModule = (ctx as any)._renderModule;
          if (renderModule) renderModule.topLevelHoverOut();
        });

        ctx.nodesLayer.appendChild(div);
        ctx.nodeElements[n.id] = div;
      });

      requestAnimationFrame(() => {
        ctx.nodes.forEach(n => {
          const el = ctx.nodeElements[n.id];
          const pos = ctx.nodePositions[n.id];
          if (n.id === ctx.savedDrillNodeId) {
            if (el && pos) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
          } else {
            if (el) el.classList.add('morph-fade-in');
          }
        });
      });

      setTimeout(() => {
        ctx.drawEdges();
        ctx.isTransitioning = false;
        ctx.nodes.forEach(n => {
          const el = ctx.nodeElements[n.id];
          if (el) el.classList.remove('morph-animate', 'morph-fade-in-start', 'morph-fade-in', 'morph-fade-out');
        });
      }, 600);

      ctx.updateView();
    }, 400 + ddKeys.length * 20);
  }

  // Expose drawDrillEdges on ctx
  ctx.drawDrillEdges = drawDrillEdges;
  ctx.enterDrillDown = enterDrillDown;
  ctx.exitDrillDown = exitDrillDown;

  return { enterDrillDown, exitDrillDown, drawDrillEdges };
}