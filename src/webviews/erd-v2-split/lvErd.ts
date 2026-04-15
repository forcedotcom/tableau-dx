/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext, ErdNode, LvInnerObject, LvInnerRelationship, LvUnion, Position } from './types';
import { escapeHtmlStr } from './utils';
import { generateClassicPath } from './pathGenerators';

export interface LvErdModule {
  enterLvErd(nodeData: ErdNode): void;
  exitLvErd(): void;
  drawLvErdEdges(): void;
}

export function createLvErdModule(ctx: ErdContext): LvErdModule {

  function isClassic(): boolean { return ctx.routingMode === 'classic'; }
  function edgeStroke(): string { return isClassic() ? '3' : '1.5'; }
  function edgeGlowWidth(): string { return isClassic() ? '8' : '5'; }
  function edgeGlowOpacity(): string { return isClassic() ? '0.2' : '0.15'; }

  function createArrowMarkers(svgEl: SVGSVGElement, colors: Record<string, string>, prefix: string): void {
    const sz = isClassic() ? 12 : 8;
    const half = sz / 2;
    const refX = isClassic() ? 10 : 7;
    const arrowD = isClassic() ? 'M 0 0 L 12 6 L 0 12 L 3 6 Z' : 'M 0 0 L 8 4 L 0 8 L 2 4 Z';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    Object.entries(colors).forEach(([name, color]) => {
      const mk = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      mk.setAttribute('id', prefix + name);
      mk.setAttribute('markerWidth', String(sz)); mk.setAttribute('markerHeight', String(sz));
      mk.setAttribute('refX', String(refX)); mk.setAttribute('refY', String(half));
      mk.setAttribute('orient', 'auto'); mk.setAttribute('markerUnits', 'userSpaceOnUse');
      const ap = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      ap.setAttribute('d', arrowD); ap.setAttribute('fill', color);
      mk.appendChild(ap); defs.appendChild(mk);
    });
    svgEl.appendChild(defs);
  }

  // ── HardJoin layout: ForceAtlas2 for inner objects ──

  function layoutHardJoin(innerObjects: LvInnerObject[], innerRels: LvInnerRelationship[]): Record<string, Position> {
    const nodes = innerObjects.map(o => ({ id: o.apiName }));
    const edges = innerRels.map(r => ({ from: r.from, to: r.to }));
    if (nodes.length === 0) return {};

    const iterations = 300, repulsion = 8000, springLength = 150;
    const springStiffness = 0.08, baseGravity = 0.02;
    const gravity = baseGravity * Math.max(1, nodes.length / 10);
    const maxDisplacement = 50, padding = 100;
    const canvasW = Math.max(800, Math.min(nodes.length * 200, 2000));
    const canvasH = Math.max(600, Math.min(nodes.length * 150, 1500));
    const centerX = canvasW / 2, centerY = canvasH / 2;

    const degree: Record<string, number> = {};
    nodes.forEach(n => { degree[n.id] = 0; });
    edges.forEach(e => { if (degree[e.from] !== undefined) degree[e.from]++; if (degree[e.to] !== undefined) degree[e.to]++; });

    const positions: Record<string, Position> = {};
    const velocities: Record<string, Position> = {};
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const r = 150 + Math.random() * 100;
      positions[n.id] = { x: centerX + Math.cos(angle) * r, y: centerY + Math.sin(angle) * r };
      velocities[n.id] = { x: 0, y: 0 };
    });

    for (let iter = 0; iter < iterations; iter++) {
      const forces: Record<string, Position> = {};
      nodes.forEach(n => { forces[n.id] = { x: 0, y: 0 }; });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i].id, b = nodes[j].id;
          const dx = positions[a].x - positions[b].x, dy = positions[a].y - positions[b].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = (repulsion * (1 + degree[a]) * (1 + degree[b])) / (dist * dist);
          const fx = force * dx / dist, fy = force * dy / dist;
          forces[a].x += fx; forces[a].y += fy; forces[b].x -= fx; forces[b].y -= fy;
        }
      }

      edges.forEach(e => {
        const pa = positions[e.from], pb = positions[e.to];
        if (!pa || !pb) return;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = springStiffness * (dist - springLength);
        const fx = force * dx / dist, fy = force * dy / dist;
        forces[e.from].x += fx; forces[e.from].y += fy; forces[e.to].x -= fx; forces[e.to].y -= fy;
      });

      nodes.forEach(n => {
        forces[n.id].x += (centerX - positions[n.id].x) * gravity;
        forces[n.id].y += (centerY - positions[n.id].y) * gravity;
      });

      nodes.forEach(n => {
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
    nodes.forEach(n => {
      result[n.id] = {
        x: padding + ((positions[n.id].x - minX) / rangeX) * (canvasW - 2 * padding),
        y: padding + ((positions[n.id].y - minY) / rangeY) * (canvasH - 2 * padding),
      };
    });
    return result;
  }

  // ── Union (menorah) layout: deterministic tier positioning ──

  function layoutMenorah(lvNode: ErdNode, unions: LvUnion[]): Record<string, Position> {
    const positions: Record<string, Position> = {};
    const TIER_GAP = 200;
    const NODE_SPACING = 180;

    const allDmos: Array<{ apiName: string; unionIdx: number }> = [];
    unions.forEach((u, ui) => {
      u.objects.forEach(obj => { allDmos.push({ apiName: obj.apiName, unionIdx: ui }); });
    });

    const totalDmos = allDmos.length;
    const totalWidth = Math.max(totalDmos * NODE_SPACING, unions.length * NODE_SPACING, 400);
    const centerX = totalWidth / 2;

    // Tier 0: LV at top-center
    positions['__lv__'] = { x: centerX, y: 80 };

    if (unions.length === 1) {
      // Single union: hub centered below LV, DMOs fan below hub
      positions['__union_0__'] = { x: centerX, y: 80 + TIER_GAP };

      const dmos = unions[0].objects;
      const dmoTotalWidth = (dmos.length - 1) * NODE_SPACING;
      const dmoStartX = centerX - dmoTotalWidth / 2;
      dmos.forEach((obj, i) => {
        positions[obj.apiName] = { x: dmoStartX + i * NODE_SPACING, y: 80 + TIER_GAP * 2 };
      });
    } else {
      // Multiple unions: each gets its own hub, with its DMOs below
      const unionSpacing = totalWidth / (unions.length + 1);
      unions.forEach((u, ui) => {
        const hubX = unionSpacing * (ui + 1);
        positions['__union_' + ui + '__'] = { x: hubX, y: 80 + TIER_GAP };

        const dmos = u.objects;
        const dmoTotalWidth = (dmos.length - 1) * NODE_SPACING;
        const dmoStartX = hubX - dmoTotalWidth / 2;
        dmos.forEach((obj, i) => {
          positions[obj.apiName] = { x: dmoStartX + i * NODE_SPACING, y: 80 + TIER_GAP * 2 };
        });
      });
    }

    return positions;
  }

  // ── Draw edges for the LV ERD view ──

  function drawLvErdEdges(): void {
    ctx.svg.innerHTML = '';
    ctx.root.querySelectorAll('.lv-erd-edge-label').forEach(el => el.remove());
    if (!ctx.lvErdTarget) return;

    const node = ctx.lvErdTarget;
    const isUnion = !!node.lvIsUnion;

    if (isUnion) {
      const colors = { default: '#706e6b' };
      createArrowMarkers(ctx.svg, colors, 'lv-erd-');

      const unions = node.lvUnions || [];
      const lvPos = ctx.lvErdPositions['__lv__'];
      if (!lvPos) return;

      unions.forEach((u, ui) => {
        const hubKey = '__union_' + ui + '__';
        const hubPos = ctx.lvErdPositions[hubKey];
        if (!hubPos) return;

        drawSimpleLine(lvPos.x, lvPos.y, hubPos.x, hubPos.y, '#706e6b');

        u.objects.forEach(obj => {
          const objPos = ctx.lvErdPositions[obj.apiName];
          if (!objPos) return;
          drawSimpleLine(hubPos.x, hubPos.y, objPos.x, objPos.y, '#706e6b');
        });
      });
    } else {
      const rels = node.lvInnerRelationships || [];
      if (rels.length === 0) return;

      const colors = { default: '#939393' };
      createArrowMarkers(ctx.svg, colors, 'lv-erd-');

      const cardMap: Record<string, string> = {
        'Many_to_Many': 'M:N', 'ManyToMany': 'M:N',
        'One_to_Many': '1:N', 'OneToMany': '1:N',
        'Many_to_One': 'N:1', 'ManyToOne': 'N:1',
        'One_to_One': '1:1', 'OneToOne': '1:1',
      };

      rels.forEach((rel, idx) => {
        const fromPos = ctx.lvErdPositions[rel.from];
        const toPos = ctx.lvErdPositions[rel.to];
        if (!fromPos || !toPos) return;

        const radius = ctx.NODE_SIZE / 2;
        const fcx = fromPos.x, fcy = fromPos.y;
        const tcx = toPos.x, tcy = toPos.y;
        const angle = Math.atan2(tcy - fcy, tcx - fcx);
        const fex = fcx + Math.cos(angle) * (radius + 5);
        const fey = fcy + Math.sin(angle) * (radius + 5);
        const tex = tcx - Math.cos(angle) * (radius + 15);
        const tey = tcy - Math.sin(angle) * (radius + 15);
        const co = 30 * (idx % 2 === 0 ? 1 : -1);
        const cp = generateClassicPath(fex, fey, tex, tey, co);

        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        glow.setAttribute('d', cp.d); glow.setAttribute('stroke', '#939393');
        glow.setAttribute('stroke-width', edgeGlowWidth());
        glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', edgeGlowOpacity());
        glow.setAttribute('stroke-linecap', 'round');
        ctx.svg.appendChild(glow);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', cp.d); path.setAttribute('stroke', '#939393');
        path.setAttribute('stroke-width', edgeStroke());
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#lv-erd-default)');
        path.setAttribute('stroke-linecap', 'round');
        ctx.svg.appendChild(path);

        const label = document.createElement('div');
        label.className = 'edge-label lv-erd-edge-label';
        const cardText = cardMap[rel.cardinality] || rel.cardinality || '—';
        label.innerHTML = '<span class="cardinality">' + cardText + '</span>';
        label.title = rel.label + '\n' + (rel.fromField || '') + ' → ' + (rel.toField || '') + '\nJoin: ' + rel.joinType;
        label.style.left = (cp.mx - 18) + 'px';
        label.style.top = (cp.my - 10) + 'px';
        ctx.nodesLayer.appendChild(label);
      });
    }
  }

  function drawSimpleLine(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', color); line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    ctx.svg.appendChild(line);

    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    glow.setAttribute('x1', String(x1)); glow.setAttribute('y1', String(y1));
    glow.setAttribute('x2', String(x2)); glow.setAttribute('y2', String(y2));
    glow.setAttribute('stroke', color); glow.setAttribute('stroke-width', '6');
    glow.setAttribute('stroke-linecap', 'round'); glow.setAttribute('opacity', '0.12');
    ctx.svg.insertBefore(glow, ctx.svg.firstChild);
  }

  // ── Render a DMO node circle (reused for both layouts) ──

  function renderDmoNode(obj: LvInnerObject, pos: Position, centerPos: Position, animate: boolean, lvParentApiName: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'node data-object' + (animate ? ' morph-animate morph-fade-in-start' : '');
    div.setAttribute('data-lv-erd-key', obj.apiName);

    const iconSvg = ctx.dataModelSvg;
    const circleHtml = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
    div.innerHTML = circleHtml +
      '<div class="node-label"><div class="node-title">' + escapeHtmlStr(obj.label) + '</div>' +
      '<div class="lv-erd-counts">' + obj.dimCount + ' dims, ' + obj.measCount + ' meas</div></div>';

    const halfSize = ctx.NODE_SIZE / 2;
    if (animate) {
      div.style.left = (centerPos.x - halfSize) + 'px';
      div.style.top = (centerPos.y - halfSize) + 'px';
    } else {
      div.style.left = (pos.x - halfSize) + 'px';
      div.style.top = (pos.y - halfSize) + 'px';
    }

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      const tempNode: ErdNode = {
        id: obj.apiName, label: obj.label, type: 'dataObject',
        dataObjectType: obj.dataObjectType || 'Dmo',
        dimCount: obj.dimCount, measCount: obj.measCount,
        dimensions: obj.dimensions || [], measurements: obj.measurements || [],
        relatedCalcDims: [], relatedCalcMeas: [],
        relatedHierarchies: [], relatedMetrics: [], relatedGroupings: [],
        lvParentApiName,
      };
      ctx.openSidebar(tempNode);
    });

    return div;
  }

  // ── Enter LV ERD view ──

  function enterLvErd(nodeData: ErdNode): void {
    if (ctx.isTransitioning) return;
    ctx.isTransitioning = true;
    ctx.closeSidebar();

    ctx.savedTopViewState = { panX: ctx.panX, panY: ctx.panY, scale: ctx.scale };
    ctx.savedDrillNodeId = nodeData.id;
    ctx.savedHideRelationships = ctx.hideRelationships;
    ctx.hideRelationships = false;

    ctx.lvErdTarget = nodeData;
    ctx.lvErdPositions = {};
    ctx.lvErdElements = {};

    const isUnion = !!nodeData.lvIsUnion;
    let allPositions: Record<string, Position>;

    if (isUnion) {
      allPositions = layoutMenorah(nodeData, nodeData.lvUnions || []);
    } else {
      allPositions = layoutHardJoin(nodeData.lvInnerObjects || [], nodeData.lvInnerRelationships || []);
    }

    Object.keys(allPositions).forEach(k => { ctx.lvErdPositions[k] = allPositions[k]; });

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

    // Phase 2: After fade, render LV ERD
    setTimeout(() => {
      ctx.currentView = 'lvErd';
      ctx.nodesLayer.innerHTML = '';
      ctx.svg.innerHTML = '';
      ctx.svg.classList.remove('morph-hide');

      const backBtn = ctx.root.querySelector('#backBtn') as HTMLElement | null;
      if (backBtn) backBtn.style.display = 'flex';
      const headerTitle = ctx.root.querySelector('#headerTitle') as HTMLElement | null;
      if (headerTitle) headerTitle.textContent = 'Logical View: ' + nodeData.label;
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
      if (gridBtn) gridBtn.style.display = 'none';
      if (forceBtn) forceBtn.style.display = 'none';

      // Fit viewport to positions
      const allX: number[] = [], allY: number[] = [];
      Object.values(ctx.lvErdPositions).forEach(p => { allX.push(p.x); allY.push(p.y); });
      if (allX.length > 0) {
        const mnX = Math.min(...allX) - 150, mxX = Math.max(...allX) + 200;
        const mnY = Math.min(...allY) - 100, mxY = Math.max(...allY) + 200;
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

      const animCenter = { x: viewCx, y: viewCy };
      const ddDivs: Array<{ div: HTMLElement; pos: Position; key: string }> = [];

      if (isUnion) {
        // Render LV node at top
        const lvPos = ctx.lvErdPositions['__lv__'];
        if (lvPos) {
          const lvDiv = document.createElement('div');
          lvDiv.className = 'node logical-view morph-animate morph-fade-in-start';
          lvDiv.setAttribute('data-lv-erd-key', '__lv__');
          const lvIcon = ctx.tableSvg;
          lvDiv.innerHTML = '<div class="node-circle"><div class="node-icon">' + lvIcon + '</div></div>' +
            '<div class="node-label"><div class="node-title">' + escapeHtmlStr(nodeData.label) + '</div></div>';
          lvDiv.style.left = (animCenter.x - ctx.NODE_SIZE / 2) + 'px';
          lvDiv.style.top = (animCenter.y - ctx.NODE_SIZE / 2) + 'px';
          lvDiv.addEventListener('click', (e) => { e.stopPropagation(); ctx.openSidebar(nodeData); });
          ctx.nodesLayer.appendChild(lvDiv);
          ctx.lvErdElements['__lv__'] = lvDiv;
          ddDivs.push({ div: lvDiv, pos: lvPos, key: '__lv__' });
        }

        // Render union hub nodes
        const unions = nodeData.lvUnions || [];
        unions.forEach((u, ui) => {
          const hubKey = '__union_' + ui + '__';
          const hubPos = ctx.lvErdPositions[hubKey];
          if (!hubPos) return;

          const hubDiv = document.createElement('div');
          hubDiv.className = 'lv-union-hub morph-animate morph-fade-in-start';
          hubDiv.setAttribute('data-lv-erd-key', hubKey);
          hubDiv.innerHTML = '<div class="union-hub-circle"><span class="union-hub-label">Union</span></div>' +
            '<div class="node-label"><div class="node-title">' + escapeHtmlStr(u.label) + '</div></div>';
          hubDiv.style.left = (animCenter.x - 40) + 'px';
          hubDiv.style.top = (animCenter.y - 40) + 'px';
          ctx.nodesLayer.appendChild(hubDiv);
          ctx.lvErdElements[hubKey] = hubDiv;
          ddDivs.push({ div: hubDiv, pos: hubPos, key: hubKey });

          // Render DMOs for this union
          u.objects.forEach(obj => {
            const objPos = ctx.lvErdPositions[obj.apiName];
            if (!objPos) return;
            const div = renderDmoNode(obj, objPos, animCenter, true, nodeData.id);
            ctx.nodesLayer.appendChild(div);
            ctx.lvErdElements[obj.apiName] = div;
            ddDivs.push({ div, pos: objPos, key: obj.apiName });
          });
        });
      } else {
        // HardJoin: render inner objects
        const innerObjects = nodeData.lvInnerObjects || [];
        innerObjects.forEach(obj => {
          const objPos = ctx.lvErdPositions[obj.apiName];
          if (!objPos) return;
          const div = renderDmoNode(obj, objPos, animCenter, true, nodeData.id);
          ctx.nodesLayer.appendChild(div);
          ctx.lvErdElements[obj.apiName] = div;
          ddDivs.push({ div, pos: objPos, key: obj.apiName });
        });
      }

      // Animate nodes to their positions
      requestAnimationFrame(() => {
        ddDivs.forEach((item, i) => {
          setTimeout(() => {
            item.div.classList.add('morph-fade-in');
            const isHub = item.key.startsWith('__union_');
            const halfSize = isHub ? 40 : ctx.NODE_SIZE / 2;
            item.div.style.left = (item.pos.x - halfSize) + 'px';
            item.div.style.top = (item.pos.y - halfSize) + 'px';
          }, 30 + i * 40);
        });
      });

      // After animation, draw edges
      setTimeout(() => {
        drawLvErdEdges();
        ctx.isTransitioning = false;
        ddDivs.forEach(item => {
          item.div.classList.remove('morph-animate', 'morph-fade-in-start', 'morph-fade-in');
        });
      }, 100 + ddDivs.length * 40 + 500);

    }, 500);
  }

  // ── Exit LV ERD view ──

  function exitLvErd(): void {
    if (ctx.isTransitioning) return;
    ctx.isTransitioning = true;
    ctx.closeSidebar();

    ctx.svg.classList.add('morph-hide');
    ctx.root.querySelectorAll('.lv-erd-edge-label').forEach(el => el.remove());

    const animCenter = ctx.lvErdPositions['__lv__'] || { x: 500, y: 400 };
    const keys = Object.keys(ctx.lvErdElements).filter(k => k !== '__lv__');

    keys.forEach((key, i) => {
      const el = ctx.lvErdElements[key];
      if (!el) return;
      el.classList.add('morph-animate');
      setTimeout(() => {
        const isHub = key.startsWith('__union_');
        const halfSize = isHub ? 40 : ctx.NODE_SIZE / 2;
        el.style.left = (animCenter.x - halfSize) + 'px';
        el.style.top = (animCenter.y - halfSize) + 'px';
        el.classList.add('morph-fade-out');
      }, i * 20);
    });

    setTimeout(() => {
      ctx.lvErdTarget = null;
      ctx.nodesLayer.innerHTML = '';
      ctx.groupContainersLayer.innerHTML = '';
      ctx.svg.innerHTML = '';
      ctx.svg.classList.remove('morph-hide');

      ctx.currentView = 'top';
      const backBtn = ctx.root.querySelector('#backBtn') as HTMLElement | null;
      if (backBtn) backBtn.style.display = 'none';
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
      const gridBtn2 = ctx.root.querySelector('#layoutGridBtn') as HTMLElement | null;
      const forceBtn2 = ctx.root.querySelector('#layoutForceBtn') as HTMLElement | null;
      if (gridBtn2) gridBtn2.style.display = '';
      if (forceBtn2) forceBtn2.style.display = '';
      ctx.hideRelationships = ctx.savedHideRelationships;
      ctx.updateLayoutControls();

      ctx.panX = ctx.savedTopViewState.panX;
      ctx.panY = ctx.savedTopViewState.panY;
      ctx.scale = ctx.savedTopViewState.scale;

      if (ctx.layoutMode === 'grid') {
        ctx.renderTopLevel();
        ctx.isTransitioning = false;
        return;
      }

      ctx.renderTopLevel();
      ctx.updateView();
      ctx.isTransitioning = false;
    }, 400 + keys.length * 20);
  }

  ctx.enterLvErd = enterLvErd;
  ctx.exitLvErd = exitLvErd;
  ctx.drawLvErdEdges = drawLvErdEdges;

  return { enterLvErd, exitLvErd, drawLvErdEdges };
}
