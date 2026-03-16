import type { ErdContext, ErdNode, ErdEdge, Position } from './types';
import {
  generateClassicPath, generateRoutedPath, getSide, buildPortMap,
  getPortOffset, getPortPoint, getEdgeMidpoint,
} from './pathGenerators';
import { getNodeClass, getNodeIcon, getDiffClassFromStatus, isClassicMode } from './utils';

export interface RenderModule {
  renderTopLevel(forceRelayout?: boolean): void;
  drawEdges(): void;
  drawHoverEdges(relEdges: ErdEdge[]): void;
  topLevelHoverIn(nodeId: string): void;
  topLevelHoverOut(): void;
  fitToViewport(): void;
  updateView(): void;
  updateLayoutControls(): void;
  setLayoutMode(mode: string): void;
  setRoutingMode(mode: string): void;
  toggleRelationships(): void;
  toggleUnmapped(): void;
  setUnmappedVisibility(visible: boolean): void;
  createArrowMarkers(svgEl: SVGSVGElement, colors: Record<string, string>, prefix: string): SVGDefsElement;
  edgeStroke(): string;
  edgeDiffStroke(): string;
  edgeGlowWidth(): string;
  edgeGlowOpacity(): string;
  getLeftPanelWidth(): number;
  getAvailableWidth(): number;
}

export function createRenderModule(ctx: ErdContext): RenderModule {
  function getLeftPanelWidth(): number {
    const lp = ctx.root.querySelector('#leftPanel') as HTMLElement | null;
    return lp ? lp.offsetWidth : 48;
  }

  function getAvailableWidth(): number {
    let w = ctx.erdContainer.clientWidth;
    w -= getLeftPanelWidth();
    const sb = ctx.root.querySelector('#sidebar') as HTMLElement | null;
    if (sb && sb.classList.contains('open')) w -= 350;
    const hp = ctx.root.querySelector('#historyPanel') as HTMLElement | null;
    if (hp && hp.classList.contains('visible')) w -= 350;
    return Math.max(w, 200);
  }

  function fitToViewport(): void {
    const isDrill = ctx.currentView === 'drilldown';
    const posMap = isDrill ? ctx.ddPositions : ctx.nodePositions;
    if (Object.keys(posMap).length === 0) return;
    const positions = Object.values(posMap);
    const xs = positions.map(p => p.x), ys = positions.map(p => p.y);
    const itemSize = isDrill ? ctx.ENTITY_SIZE : ctx.NODE_SIZE;
    const minX = Math.min(...xs), maxX = Math.max(...xs) + itemSize + 40;
    const minY = Math.min(...ys), maxY = Math.max(...ys) + itemSize + 40;
    const w = maxX - minX, h = maxY - minY;
    const lpw = getLeftPanelWidth(), availW = getAvailableWidth(), availH = ctx.erdContainer.clientHeight;
    const sw = availW / (w + 100), sh = availH / (h + 100);
    ctx.scale = Math.min(sw, sh, 1);
    ctx.panX = lpw + (availW - w * ctx.scale) / 2 - minX * ctx.scale;
    ctx.panY = (availH - h * ctx.scale) / 2 - minY * ctx.scale;
    updateView();
  }

  function updateView(): void {
    ctx.viewport.style.transform = 'translate(' + ctx.panX + 'px,' + ctx.panY + 'px) scale(' + ctx.scale + ')';
    ctx.viewport.style.transformOrigin = '0 0';
  }

  function createArrowMarkers(svgEl: SVGSVGElement, colors: Record<string, string>, prefix: string): SVGDefsElement {
    const isClassic = isClassicMode(ctx);
    const sz = isClassic ? 12 : 8, half = sz / 2, refX = isClassic ? 10 : 7;
    const arrowD = isClassic ? 'M 0 0 L 12 6 L 0 12 L 3 6 Z' : 'M 0 0 L 8 4 L 0 8 L 2 4 Z';
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
    return defs;
  }

  function edgeStroke(): string { return isClassicMode(ctx) ? '3' : '1.5'; }
  function edgeDiffStroke(): string { return isClassicMode(ctx) ? '4' : '2.5'; }
  function edgeGlowWidth(): string { return isClassicMode(ctx) ? '8' : '5'; }
  function edgeGlowOpacity(): string { return isClassicMode(ctx) ? '0.2' : '0.15'; }

  function drawEdges(): void {
    if (ctx.hideRelationships && ctx.currentView === 'top') {
      ctx.svg.innerHTML = '';
      ctx.root.querySelectorAll('.edge-label').forEach(el => el.remove());
      return;
    }
    ctx.svg.innerHTML = '';
    const arrowColors = { default: '#939393', added: '#2ecc71', modified: '#f1c40f', removed: '#e74c3c', dimmed: '#e5e5e5' };
    createArrowMarkers(ctx.svg, arrowColors, 'arrowhead-');
    ctx.root.querySelectorAll('.edge-label').forEach(el => el.remove());

    const portMap = isClassicMode(ctx) ? null : buildPortMap(ctx.edges, ctx.nodePositions, ctx.NODE_SIZE);
    const pairCounts: Record<string, { count: number; idx: number }> = {};
    ctx.edges.forEach(e => {
      const pk = e.from < e.to ? e.from + '||' + e.to : e.to + '||' + e.from;
      if (!pairCounts[pk]) pairCounts[pk] = { count: 0, idx: 0 };
      pairCounts[pk].count++;
    });

    ctx.edges.forEach((edge, idx) => {
      const fromPos = ctx.nodePositions[edge.from], toPos = ctx.nodePositions[edge.to];
      if (!fromPos || !toPos) return;
      const radius = ctx.NODE_SIZE / 2;
      const fcx = fromPos.x + radius, fcy = fromPos.y + radius;
      const tcx = toPos.x + radius, tcy = toPos.y + radius;
      let d: string, mpX: number, mpY: number;

      if (isClassicMode(ctx)) {
        const angle = Math.atan2(tcy - fcy, tcx - fcx);
        const fex = fcx + Math.cos(angle) * (radius + 5), fey = fcy + Math.sin(angle) * (radius + 5);
        const tex = tcx - Math.cos(angle) * (radius + 15), tey = tcy - Math.sin(angle) * (radius + 15);
        const co = 30 * (idx % 2 === 0 ? 1 : -1);
        const cp = generateClassicPath(fex, fey, tex, tey, co);
        d = cp.d; mpX = cp.mx; mpY = cp.my;
      } else {
        const fromSide = getSide(fcx, fcy, tcx, tcy), toSide = getSide(tcx, tcy, fcx, fcy);
        const fromOff = getPortOffset(edge.id, edge.from, fromSide, portMap!, ctx.NODE_SIZE);
        const toOff = getPortOffset(edge.id, edge.to, toSide, portMap!, ctx.NODE_SIZE);
        const sp = getPortPoint(fcx, fcy, fromSide, fromOff, radius);
        const tp = getPortPoint(tcx, tcy, toSide, toOff, radius);
        const pk = edge.from < edge.to ? edge.from + '||' + edge.to : edge.to + '||' + edge.from;
        const pc = pairCounts[pk];
        let curveOffset = 0;
        if (ctx.routingMode === 'straight') { curveOffset = 20 * (pc.idx - (pc.count - 1) / 2); }
        pc.idx++;
        d = generateRoutedPath(ctx, sp.x, sp.y, tp.x, tp.y, curveOffset, ctx.nodePositions, ctx.NODE_SIZE);
        const mp = getEdgeMidpoint(ctx, sp.x, sp.y, tp.x, tp.y, curveOffset);
        mpX = mp.x; mpY = mp.y;
      }

      const edgeDiff = (edge.diffStatus && edge.diffStatus !== 'unchanged') ? edge.diffStatus : null;
      const isDimmed = ctx.highlightChangesActive && !edgeDiff;
      const edgeColor = isDimmed ? '#e5e5e5'
        : edgeDiff === 'added' ? '#2ecc71' : edgeDiff === 'modified' ? '#f1c40f' : edgeDiff === 'removed' ? '#e74c3c' : '#939393';

      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d); glow.setAttribute('stroke', edgeColor); glow.setAttribute('stroke-width', edgeGlowWidth());
      glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', isDimmed ? '0.05' : edgeGlowOpacity());
      glow.setAttribute('stroke-linecap', 'round');
      ctx.svg.insertBefore(glow, ctx.svg.firstChild ? ctx.svg.firstChild.nextSibling : null);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const arrowName = isDimmed ? 'dimmed' : edgeDiff ? edgeDiff : 'default';
      path.setAttribute('d', d); path.setAttribute('stroke', edgeColor);
      path.setAttribute('stroke-width', edgeDiff ? edgeDiffStroke() : edgeStroke());
      path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#arrowhead-' + arrowName + ')');
      path.setAttribute('stroke-linecap', 'round');
      if (isDimmed) path.setAttribute('opacity', '0.35');
      ctx.svg.appendChild(path);

      const cardMap: Record<string, string> = { 'Many_to_Many': 'M:N', 'ManyToMany': 'M:N', 'One_to_Many': '1:N', 'OneToMany': '1:N', 'Many_to_One': 'N:1', 'ManyToOne': 'N:1', 'One_to_One': '1:1', 'OneToOne': '1:1' };
      const label = document.createElement('div');
      label.className = 'edge-label';
      if (isClassicMode(ctx)) label.classList.add('edge-label-classic');
      label.innerHTML = '<span class="cardinality">' + (cardMap[edge.cardinality] || edge.cardinality || '—') + '</span>';
      label.title = edge.label + '\n' + (edge.fromField || '') + ' → ' + (edge.toField || '');
      label.style.left = (mpX! - (isClassicMode(ctx) ? 20 : 18)) + 'px';
      label.style.top = (mpY! - (isClassicMode(ctx) ? 12 : 10)) + 'px';
      if (isDimmed) { label.style.opacity = '0.2'; label.style.borderColor = '#e5e5e5'; }
      ctx.nodesLayer.appendChild(label);
    });
  }

  function drawHoverEdges(relEdges: ErdEdge[]): void {
    if (relEdges.length === 0) return;
    createArrowMarkers(ctx.svg, { default: '#0070d2' }, 'tophover-');
    const portMap = isClassicMode(ctx) ? null : buildPortMap(ctx.edges, ctx.nodePositions, ctx.NODE_SIZE);
    const relSet: Record<string, boolean> = {};
    relEdges.forEach(e => { relSet[e.id] = true; });
    const pairCounts: Record<string, { count: number; idx: number }> = {};
    ctx.edges.forEach(e => {
      const pk = e.from < e.to ? e.from + '||' + e.to : e.to + '||' + e.from;
      if (!pairCounts[pk]) pairCounts[pk] = { count: 0, idx: 0 };
      pairCounts[pk].count++;
    });
    ctx.edges.forEach((edge, idx) => {
      const fromPos = ctx.nodePositions[edge.from], toPos = ctx.nodePositions[edge.to];
      if (!fromPos || !toPos) return;
      const radius = ctx.NODE_SIZE / 2;
      const fcx = fromPos.x + radius, fcy = fromPos.y + radius;
      const tcx = toPos.x + radius, tcy = toPos.y + radius;
      let d: string;
      if (isClassicMode(ctx)) {
        const angle = Math.atan2(tcy - fcy, tcx - fcx);
        const fex = fcx + Math.cos(angle) * (radius + 5), fey = fcy + Math.sin(angle) * (radius + 5);
        const tex = tcx - Math.cos(angle) * (radius + 15), tey = tcy - Math.sin(angle) * (radius + 15);
        const co = 30 * (idx % 2 === 0 ? 1 : -1);
        d = generateClassicPath(fex, fey, tex, tey, co).d;
      } else {
        const fromSide = getSide(fcx, fcy, tcx, tcy), toSide = getSide(tcx, tcy, fcx, fcy);
        const fromOff = getPortOffset(edge.id, edge.from, fromSide, portMap!, ctx.NODE_SIZE);
        const toOff = getPortOffset(edge.id, edge.to, toSide, portMap!, ctx.NODE_SIZE);
        const sp = getPortPoint(fcx, fcy, fromSide, fromOff, radius);
        const tp = getPortPoint(tcx, tcy, toSide, toOff, radius);
        const pk = edge.from < edge.to ? edge.from + '||' + edge.to : edge.to + '||' + edge.from;
        const pc = pairCounts[pk];
        let curveOffset = 0;
        if (ctx.routingMode === 'straight') { curveOffset = 20 * (pc.idx - (pc.count - 1) / 2); }
        pc.idx++;
        d = generateRoutedPath(ctx, sp.x, sp.y, tp.x, tp.y, curveOffset, ctx.nodePositions, ctx.NODE_SIZE);
      }
      if (!relSet[edge.id]) return;
      const hoverStroke = isClassicMode(ctx) ? '5' : '3', hoverGlow = isClassicMode(ctx) ? '12' : '8';
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d); glow.setAttribute('stroke', '#0070d2'); glow.setAttribute('stroke-width', hoverGlow);
      glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', '0.25'); glow.setAttribute('stroke-linecap', 'round');
      ctx.svg.appendChild(glow);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d); path.setAttribute('stroke', '#0070d2'); path.setAttribute('stroke-width', hoverStroke);
      path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#tophover-default)'); path.setAttribute('stroke-linecap', 'round');
      ctx.svg.appendChild(path);
    });
  }

  function topLevelHoverIn(nodeId: string): void {
    if (ctx.topHoverActive) topLevelHoverOut();
    ctx.topHoverActive = true;
    const connectedIds = new Set([nodeId]);
    const relEdges: ErdEdge[] = [];
    ctx.edges.forEach(e => {
      if (e.from === nodeId || e.to === nodeId) { connectedIds.add(e.from); connectedIds.add(e.to); relEdges.push(e); }
    });
    if (ctx.hideRelationships) {
      Object.keys(ctx.nodeElements).forEach(id => {
        const el = ctx.nodeElements[id];
        if (connectedIds.has(id)) { el.classList.add('list-hover-related'); el.classList.remove('list-hover-dimmed'); }
        else { el.classList.add('list-hover-dimmed'); el.classList.remove('list-hover-related'); }
      });
      ctx.svg.innerHTML = '';
      drawHoverEdges(relEdges);
    } else {
      ctx.svg.querySelectorAll('path').forEach(p => p.setAttribute('opacity', '0.12'));
      ctx.root.querySelectorAll('.edge-label').forEach((el: Element) => (el as HTMLElement).style.opacity = '0.12');
      drawHoverEdges(relEdges);
    }
  }

  function topLevelHoverOut(): void {
    if (!ctx.topHoverActive) return;
    ctx.topHoverActive = false;
    Object.keys(ctx.nodeElements).forEach(id => { ctx.nodeElements[id].classList.remove('list-hover-dimmed', 'list-hover-related'); });
    if (ctx.hideRelationships) {
      ctx.svg.innerHTML = '';
    } else {
      ctx.root.querySelectorAll('.edge-label').forEach((el: Element) => { (el as HTMLElement).style.opacity = ''; });
      drawEdges();
    }
  }

  function updateLayoutControls(): void {
    const gridBtn = ctx.root.querySelector('#layoutGridBtn') as HTMLElement | null;
    const forceBtn = ctx.root.querySelector('#layoutForceBtn') as HTMLElement | null;
    const autoBtn = ctx.root.querySelector('#autoLayoutBtn') as HTMLElement | null;
    const relBtn = ctx.root.querySelector('#relToggleBtn') as HTMLElement | null;
    if (gridBtn) gridBtn.classList.toggle('route-active', ctx.layoutMode === 'grid');
    if (forceBtn) forceBtn.classList.toggle('route-active', ctx.layoutMode === 'force');
    if (autoBtn) autoBtn.style.display = (ctx.layoutMode === 'grid' && ctx.currentView !== 'drilldown') ? 'none' : '';
    if (relBtn) {
      relBtn.classList.toggle('route-active', !ctx.hideRelationships);
      relBtn.title = ctx.hideRelationships ? 'Show Connectors' : 'Hide Connectors';
      const relLabel = relBtn.querySelector('.lp-btn-label') as HTMLElement | null;
      if (relLabel) relLabel.textContent = ctx.hideRelationships ? 'Show Connectors' : 'Hide Connectors';
    }
  }

  function renderTopLevel(forceRelayout?: boolean): void {
    ctx.currentView = 'top';
    ctx.drilldownTarget = null;
    ctx.nodesLayer.innerHTML = '';
    ctx.svg.innerHTML = '';
    ctx.nodePositions = {};
    ctx.nodeElements = {};
    ctx.topHoverActive = false;

    const backBtn = ctx.root.querySelector('#backBtn') as HTMLElement | null;
    if (backBtn) backBtn.style.display = 'none';
    const ddLegend = ctx.root.querySelector('#drilldownLegendSection') as HTMLElement | null;
    if (ddLegend) ddLegend.style.display = 'none';
    const viewSuffix = ctx.isCompareMode ? ' - Compare (Local vs Remote)' : (ctx.layoutMode === 'grid' ? ' - Grid View' : ' - ERD V2');
    const titleEl = ctx.root.querySelector('#headerTitle') as HTMLElement | null;
    if (titleEl) titleEl.textContent = ctx.modelLabel + viewSuffix;
    const topStats = ctx.root.querySelector('#topStats') as HTMLElement | null;
    if (topStats) topStats.style.display = 'flex';

    if (ctx.hasUnmappedNodes) {
      const unmGrpR = ctx.root.querySelector('#unmappedGroup') as HTMLElement | null;
      if (unmGrpR) unmGrpR.classList.add('visible');
    }
    const relEyeR = ctx.root.querySelector('#relToggleBtn') as HTMLElement | null;
    if (relEyeR) relEyeR.style.display = '';
    const gridBtnR = ctx.root.querySelector('#layoutGridBtn') as HTMLElement | null;
    const forceBtnR = ctx.root.querySelector('#layoutForceBtn') as HTMLElement | null;
    if (gridBtnR) gridBtnR.style.display = '';
    if (forceBtnR) forceBtnR.style.display = '';
    updateLayoutControls();

    const visibleNodes = ctx.showUnmapped ? ctx.nodes : ctx.nodes.filter(n => !n.unmapped);
    const visibleEdges = ctx.edges.filter(e => {
      const fromVisible = visibleNodes.some(n => n.id === e.from);
      const toVisible = visibleNodes.some(n => n.id === e.to);
      return fromVisible && toVisible;
    });

    if (ctx.layoutMode === 'grid') {
      ctx.getGridCellSize(); // ensure grid cell size is current
      // layoutGrid is called on the layout module via ctx
      const count = visibleNodes.length;
      if (count > 0) {
        const cols = Math.ceil(Math.sqrt(count * 4 / 3));
        const CELL_W = 180, CELL_H = 190, PAD = 60;
        visibleNodes.forEach((n, idx) => {
          const col = idx % cols, row = Math.floor(idx / cols);
          ctx.nodePositions[n.id] = { x: PAD + col * CELL_W, y: PAD + row * CELL_H };
        });
      }
    } else {
      // ForceAtlas2 layout is handled by calling through the layout module ref on ctx
      // The layout module sets ctx.nodePositions directly
      _layoutForceAtlas2External(visibleNodes, visibleEdges, !!forceRelayout);
    }

    visibleNodes.forEach(n => {
      const div = document.createElement('div');
      div.className = 'node ' + getNodeClass(n) + getDiffClassFromStatus(n.diffStatus) + (n.baseModelApiName ? ' pattern-base' : '') + (n.unmapped ? ' node-unmapped' : '');
      div.id = 'node-' + n.id;
      const iconSvg = getNodeIcon(ctx, n);
      const isShared = n.tableType === 'Shared', isBase = !!n.baseModelApiName;
      const needsWrap = isShared || isBase;
      const sharedBadge = isShared ? '<div class="shared-badge">' + ctx.sharedSvg + '</div>' : '';
      const baseBadge = isBase ? '<div class="base-model-badge">BASE</div>' : '';
      const circleHtml = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
      div.innerHTML = (needsWrap ? '<div class="node-circle-wrap">' + circleHtml + sharedBadge + baseBadge + '</div>' : circleHtml) + '<div class="node-label"><div class="node-title">' + n.label + '</div></div>';

      const pos = ctx.nodePositions[n.id];
      div.style.left = pos.x + 'px'; div.style.top = pos.y + 'px';

      if (ctx.layoutMode === 'grid') {
        div.style.cursor = 'pointer';
        div.addEventListener('click', e => { e.stopPropagation(); ctx.openSidebar(n); });
        div.addEventListener('dblclick', e => { e.stopPropagation(); e.preventDefault(); ctx.enterDrillDown(n); });
        div.addEventListener('mouseenter', () => { topLevelHoverIn(n.id); });
        div.addEventListener('mouseleave', () => { topLevelHoverOut(); });
      } else {
        let clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
        div.addEventListener('mousedown', e => {
          e.stopPropagation();
          clickStartTime = Date.now(); clickStartPos = { x: e.clientX, y: e.clientY };
          ctx.draggingNode = n.id;
          const rect = div.getBoundingClientRect();
          ctx.dragOffsetX = e.clientX - rect.left; ctx.dragOffsetY = e.clientY - rect.top;
        });
        div.addEventListener('mouseup', e => {
          const dur = Date.now() - clickStartTime;
          const dist = Math.sqrt(Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2));
          if (dur < 300 && dist < 10) ctx.openSidebar(n);
        });
        div.addEventListener('dblclick', e => { e.stopPropagation(); e.preventDefault(); ctx.enterDrillDown(n); });
        div.addEventListener('mouseenter', () => { topLevelHoverIn(n.id); });
        div.addEventListener('mouseleave', () => { topLevelHoverOut(); });
      }

      ctx.nodesLayer.appendChild(div);
      ctx.nodeElements[n.id] = div;
    });

    if (!ctx.hideRelationships) drawEdges();
    fitToViewport();
    updateLayoutControls();
  }

  function setLayoutMode(mode: string): void {
    if (ctx.currentView === 'drilldown') return;
    if (ctx.layoutMode === (mode as any)) return;
    ctx.layoutMode = mode as any;
    if (ctx.layoutMode === 'grid') ctx.hideRelationships = true;
    updateLayoutControls();
    renderTopLevel(true);
  }

  function setRoutingMode(mode: string): void {
    ctx.routingMode = mode as any;
    ctx.root.querySelectorAll('#routingControls button').forEach(b => b.classList.remove('route-active'));
    const btnId = mode === 'orthogonal' ? 'routeOrthBtn' : mode === 'curved' ? 'routeCurvedBtn' : mode === 'classic' ? 'routeClassicBtn' : 'routeStraightBtn';
    const btn = ctx.root.querySelector('#' + btnId) as HTMLElement | null;
    if (btn) btn.classList.add('route-active');
    ctx.root.querySelectorAll('.edge-label').forEach(el => {
      if (mode === 'classic') (el as HTMLElement).classList.add('edge-label-classic');
      else (el as HTMLElement).classList.remove('edge-label-classic');
    });
    if (ctx.currentView === 'drilldown') ctx.drawDrillEdges();
    else if (ctx.currentView === 'grouped') ctx.redrawGroupEdges();
    else drawEdges();
  }

  function toggleRelationships(): void {
    ctx.hideRelationships = !ctx.hideRelationships;
    updateLayoutControls();
    if (ctx.currentView === 'drilldown') {
      if (ctx.hideRelationships) ctx.svg.innerHTML = '';
      else ctx.drawDrillEdges();
    } else if (ctx.currentView === 'top') {
      if (ctx.hideRelationships) {
        ctx.svg.innerHTML = '';
        ctx.root.querySelectorAll('.edge-label').forEach(el => el.remove());
      } else drawEdges();
    }
  }

  function setUnmappedVisibility(visible: boolean): void {
    if (ctx.showUnmapped === visible) return;
    ctx.showUnmapped = visible;
    const btn = ctx.root.querySelector('#unmappedToggleBtn') as HTMLElement | null;
    if (btn) {
      btn.classList.toggle('route-active', ctx.showUnmapped);
      btn.title = ctx.showUnmapped ? 'Unmapped: Visible' : 'Unmapped: Hidden';
      const lbl = btn.querySelector('.lp-btn-label') as HTMLElement | null;
      if (lbl) lbl.textContent = ctx.showUnmapped ? 'Unmapped: Visible' : 'Unmapped: Hidden';
      const slash = btn.querySelector('.lp-slash') as HTMLElement | null;
      if (slash) slash.style.display = ctx.showUnmapped ? 'none' : '';
    }
    if (ctx.currentView === 'top') renderTopLevel(true);
    else if (ctx.currentView === 'grouped') ctx.renderTopLevel(); // fallback
  }

  function toggleUnmapped(): void { setUnmappedVisibility(!ctx.showUnmapped); }

  // Internal ForceAtlas2 — delegates to layout module via ctx
  function _layoutForceAtlas2External(nodeList: ErdNode[], edgeList: ErdEdge[], skipCache: boolean): void {
    // This is handled by layout.ts which writes directly to ctx.nodePositions
    // The layout module is initialized in index.ts and sets ctx.nodePositions
    // We rely on the fact that the layout module's layoutForceAtlas2 is called from renderTopLevel
    // via the ctx.renderTopLevel cross-module wiring — but since renderTopLevel IS in this module,
    // we need a direct reference. This is set up in index.ts via ctx.
    // For now, we call through a hook that index.ts will set:
    if (typeof (ctx as any)._layoutForceAtlas2 === 'function') {
      (ctx as any)._layoutForceAtlas2(nodeList, edgeList, skipCache);
    }
  }

  return {
    renderTopLevel, drawEdges, drawHoverEdges, topLevelHoverIn, topLevelHoverOut,
    fitToViewport, updateView, updateLayoutControls, setLayoutMode, setRoutingMode,
    toggleRelationships, toggleUnmapped, setUnmappedVisibility,
    createArrowMarkers, edgeStroke, edgeDiffStroke, edgeGlowWidth, edgeGlowOpacity,
    getLeftPanelWidth, getAvailableWidth,
  };
}
