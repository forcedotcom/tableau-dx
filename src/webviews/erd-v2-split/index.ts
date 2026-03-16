import type { ErdContext, ErdData } from './types';
import { createPositionCacheModule } from './positionCache';
import { createLegendModule } from './legend';
import { createLayoutModule } from './layout';
import { createGroupsModule } from './groups';
import { createRenderModule } from './render';
import { createDrilldownModule } from './drilldown';
import { createSidebarModule } from './sidebar';
import { createHistoryModule } from './history';
import { createInteractionModule } from './interaction';

export function initErd(root: HTMLElement, data: ErdData, embeddedMode: boolean = false): void {
  // ── Acquire VSCode API (or no-op adapter for browser) ─────────────────────
  const vscodeAdapter = typeof (globalThis as any).acquireVsCodeApi !== 'undefined'
    ? (globalThis as any).acquireVsCodeApi()
    : { postMessage: (_msg: unknown) => undefined, getState: () => undefined, setState: (_s: unknown) => undefined };

  // ── Grab DOM elements ─────────────────────────────────────────────────────
  const erdContainer = root.querySelector('#erdContainer') as HTMLElement;
  const viewport = root.querySelector('#viewport') as HTMLElement;
  const svg = root.querySelector('#linesSvg') as unknown as SVGSVGElement;
  const nodesLayer = root.querySelector('#nodesLayer') as HTMLElement;
  const sidebar = root.querySelector('#sidebar') as HTMLElement;
  const groupContainersLayer = root.querySelector('#groupContainersLayer') as HTMLElement;

  // ── Build shared context ──────────────────────────────────────────────────
  const ctx: ErdContext = {
    root,
    erdContainer,
    viewport,
    svg,
    nodesLayer,
    sidebar,
    groupContainersLayer,

    nodes: data.nodes || [],
    edges: data.edges || [],
    crossObjectEntities: data.crossObjectEntities || [],
    calcFieldsLookup: data.calcFieldsLookup || {},
    baseModelLabels: data.baseModelLabels || {},
    isCompareMode: !!data.isCompareMode,
    isHistoryMode: !!data.isHistoryMode,
    commits: data.commits || [],
    groupsData: data.groupsData || null,
    hasGroups: !!data.hasGroups,
    hasUnmappedNodes: !!data.hasUnmappedNodes,
    initialViewMode: data.initialViewMode || 'top',
    modelApiName: data.modelApiName || '',
    modelLabel: data.modelLabel || '',
    embeddedMode,

    tableSvg: data.tableSvg || '',
    dataModelSvg: data.dataModelSvg || '',
    dataLakeSvg: data.dataLakeSvg || '',
    calcDimSvg: data.calcDimSvg || '',
    calcMesSvg: data.calcMesSvg || '',
    hierarchySvg: data.hierarchySvg || '',
    metricSvg: data.metricSvg || '',
    groupingSvg: data.groupingSvg || '',
    sharedSvg: data.sharedSvg || '',
    calcInsightSvg: data.calcInsightSvg || '',
    entitySvgIcons: {
      'calc-dim': data.calcDimSvg || '',
      'calc-meas': data.calcMesSvg || '',
      'dim-hier': data.hierarchySvg || '',
      'metric': data.metricSvg || '',
      'grouping': data.groupingSvg || '',
    },
    entityFallbackIcons: { 'calc-dim': 'Cd', 'calc-meas': 'Cm', 'dim-hier': 'Dh', 'metric': 'M', 'grouping': 'G' },

    vscode: vscodeAdapter,

    cachedPositionsForModel: {},
    currentPositionContext: '',
    cachedPositions: {},
    pendingDrilldownPositions: null,

    panX: 0, panY: 0, scale: 1,
    isPanning: false, panStartX: 0, panStartY: 0,
    draggingNode: null, dragOffsetX: 0, dragOffsetY: 0,

    nodePositions: {},
    nodeElements: {},

    currentView: 'top',
    routingMode: 'classic',
    showUnmapped: true,
    isGridMode: true,
    layoutMode: 'force',
    hideRelationships: false,
    highlightChangesActive: false,
    topHoverActive: false,

    NODE_SIZE: 120,
    ENTITY_SIZE: 80,
    EDGE_OBJ_SIZE: 100,
    GRID_CELL: { w: 170, h: 200 },

    drilldownTarget: null,
    currentQueryNode: null,
    ddPositions: {},
    ddElements: {},
    ddCenterPos: null,
    ddCenterId: null,
    ddEntities: [],
    ddEdgeObjectIds: new Set(),
    savedTopViewState: { panX: 0, panY: 0, scale: 1 },
    savedDrillNodeId: null,
    savedHideRelationships: false,
    isTransitioning: false,
    ddHoverActive: false,
    ddHoverTimer: null,

    GROUP_CLOUD_W: 180,
    GROUP_CLOUD_H: 180,
    GROUP_RECT_PAD: 60,
    REPOSITION_ANIM_MS: 400,
    expandedGroups: new Set(),
    groupNodePositions: {},
    groupNodeElements: {},
    groupCenterMarkerElements: {},
    groupRectBorderElements: {},
    groupEntityPositions: {},
    groupEntityElements: {},
    entityToGroup: {},
    groupNodesList: [],
    groupEdgesList: [],
    isGroupedMode: false,
    savedGroupState: null,

    historyCommits: data.commits || [],
    selectedCommitHash: 'CURRENT',
    baseCommitHash: null,
    historyViewMode: 'view',
    historyLoading: false,

    diffLabels: { added: 'NEW', modified: 'MODIFIED', removed: 'REMOTE ONLY' },

    wheelAccum: 0,
    wheelActive: false,
    wheelTimer: null,

    // Cross-module stubs — filled in below by each module
    drawEdges: () => {},
    drawDrillEdges: () => {},
    openSidebar: (_n) => {},
    closeSidebar: () => {},
    enterDrillDown: (_n) => {},
    exitDrillDown: () => {},
    renderTopLevel: (_force) => {},
    fitToViewport: () => {},
    updateView: () => {},
    applyHighlightDimming: () => {},
    updateLegendCounts: () => {},
    redrawGroupEdges: () => {},
    getGridCellSize: (_mode?) => ({ w: 170, h: 200 }),
    updateLayoutControls: () => {},
    updateEmbeddedBackBtnPosition: () => {},
    toggleHistoryPanel: () => {},
  };

  // ── Create modules ────────────────────────────────────────────────────────
  const positionCacheModule = createPositionCacheModule(ctx);
  (ctx as any)._positionCacheModule = positionCacheModule;

  const legendModule = createLegendModule(ctx);
  ctx.updateLegendCounts = () => legendModule.updateLegendCounts();
  ctx.applyHighlightDimming = () => legendModule.applyHighlightDimming();

  const layoutModule = createLayoutModule(ctx);
  (ctx as any)._layoutModule = layoutModule;
  ctx.getGridCellSize = (mode?) => layoutModule.getGridCellSize(mode);
  // Wire the ForceAtlas2 hook that render.ts calls via _layoutForceAtlas2External
  (ctx as any)._layoutForceAtlas2 = (nodeList: any, edgeList: any, skipCache: boolean) =>
    layoutModule.layoutForceAtlas2(nodeList, edgeList, skipCache);

  const interactionModule = createInteractionModule(ctx);
  // updateView and updateEmbeddedBackBtnPosition are set by the module on ctx

  const renderModule = createRenderModule(ctx);
  (ctx as any)._renderModule = renderModule;
  ctx.drawEdges = () => renderModule.drawEdges();
  ctx.renderTopLevel = (forceRelayout?) => renderModule.renderTopLevel(forceRelayout);
  ctx.fitToViewport = () => renderModule.fitToViewport();
  ctx.updateLayoutControls = () => renderModule.updateLayoutControls();

  const groupsModule = createGroupsModule(ctx);
  (ctx as any)._groupsModule = groupsModule;
  ctx.redrawGroupEdges = () => groupsModule.redrawGroupEdges();

  const drilldownModule = createDrilldownModule(ctx);
  // drawDrillEdges, enterDrillDown, exitDrillDown set on ctx by module

  const sidebarModule = createSidebarModule(ctx);
  ctx.openSidebar = (node) => sidebarModule.openSidebar(node);
  ctx.closeSidebar = () => sidebarModule.closeSidebar();

  const historyModule = createHistoryModule(ctx);
  ctx.toggleHistoryPanel = () => historyModule.toggleHistoryPanel();

  // ── Setup embedded mode floating button ───────────────────────────────────
  interactionModule.setupEmbeddedMode();

  // ── Setup event listeners (pan/zoom/drag/wheel/resize) ───────────────────
  interactionModule.setupEventListeners();

  // ── Static DOM initialization ─────────────────────────────────────────────
  const viewSuffixInit = ctx.isCompareMode ? ' - Compare (Local vs Remote)' : ' - ERD V2';
  const headerTitleEl = root.querySelector('#headerTitle') as HTMLElement | null;
  if (headerTitleEl) headerTitleEl.textContent = ctx.modelLabel + viewSuffixInit;

  const historyBtnEl = root.querySelector('#historyBtn') as HTMLElement | null;
  if (historyBtnEl && ctx.isHistoryMode) historyBtnEl.style.display = '';

  const groupCtrl = root.querySelector('#groupControls') as HTMLElement | null;
  if (groupCtrl && ctx.hasGroups) groupCtrl.classList.add('visible');

  const changesGrpInit = root.querySelector('#changesGroup') as HTMLElement | null;
  if (changesGrpInit && ctx.isCompareMode) changesGrpInit.classList.add('visible');

  const drillHintEl = root.querySelector('#drillHint') as HTMLElement | null;
  if (drillHintEl) drillHintEl.textContent = ctx.hasGroups ? 'Double-click a group to expand it' : 'Double-click an object to drill down';

  ctx.updateLegendCounts();

  if (ctx.isCompareMode) {
    const diffLegendSection = root.querySelector('#diffLegendSection') as HTMLElement | null;
    if (diffLegendSection) diffLegendSection.style.display = 'block';
    let addedCount = 0, modifiedCount = 0, removedCount = 0;
    const allItems: any[] = [...ctx.nodes, ...ctx.edges];
    ctx.nodes.forEach(n => {
      [(n as any).relatedCalcDims, (n as any).relatedCalcMeas, (n as any).relatedHierarchies, (n as any).relatedMetrics, (n as any).relatedGroupings].forEach(list => {
        if (list) allItems.push(...list);
      });
    });
    allItems.forEach(item => {
      if (item.diffStatus === 'added') addedCount++;
      else if (item.diffStatus === 'modified') modifiedCount++;
      else if (item.diffStatus === 'removed') removedCount++;
    });
    const total = addedCount + modifiedCount + removedCount;
    const parts: string[] = [];
    if (addedCount) parts.push(addedCount + ' added');
    if (modifiedCount) parts.push(modifiedCount + ' modified');
    if (removedCount) parts.push(removedCount + ' ' + ctx.diffLabels.removed.toLowerCase());
    const diffSummaryEl = root.querySelector('#diffSummary') as HTMLElement | null;
    if (diffSummaryEl) diffSummaryEl.textContent = total === 0 ? 'No differences found' : parts.join(', ') + ' (' + total + ' total)';
  }

  // Brief drill hint display
  setTimeout(() => {
    const hint = root.querySelector('#drillHint') as HTMLElement | null;
    if (hint) hint.classList.add('visible');
  }, 500);
  setTimeout(() => {
    const hint = root.querySelector('#drillHint') as HTMLElement | null;
    if (hint) hint.classList.remove('visible');
  }, 4000);

  // History auto-open
  if (ctx.isHistoryMode) {
    const countEl = root.querySelector('#historyCommitCount') as HTMLElement | null;
    if (countEl) countEl.textContent = String(ctx.historyCommits.length);
    setTimeout(() => {
      const autoPanel = root.querySelector('#historyPanel') as HTMLElement | null;
      if (autoPanel) {
        ctx.closeSidebar();
        autoPanel.classList.add('visible');
        historyModule.renderHistoryPanel();
      }
    }, 0);
  }

  // ── Initial render (wait for cached positions, fallback 500ms) ────────────
  let initialRenderDone = false;
  const triggerInitialRender = (): void => {
    if (initialRenderDone) return;
    initialRenderDone = true;
    if (ctx.initialViewMode === 'listGrouped' && ctx.hasGroups) {
      groupsModule.renderListGroupedView();
    } else if (ctx.initialViewMode === 'grouped' && ctx.hasGroups) {
      groupsModule.renderGroupedView();
    } else {
      ctx.renderTopLevel();
      positionCacheModule.saveAllCachedPositions(ctx.nodePositions);
    }
    if (ctx.hasUnmappedNodes) {
      const unmLegend = root.querySelector('#unmappedLegendItem') as HTMLElement | null;
      if (unmLegend) unmLegend.style.display = '';
      const indSec2 = root.querySelector('#indicatorsLegendSection') as HTMLElement | null;
      if (indSec2) indSec2.style.display = 'block';
    }
  };
  (ctx as any)._triggerInitialRender = triggerInitialRender;
  setTimeout(triggerInitialRender, 500);

  // ── Window message listener (VSCode messages) ────────────────────────────
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.command === 'cachedPositions') {
      positionCacheModule.loadCachedPositions(msg);
      if (!initialRenderDone) { triggerInitialRender(); }
    } else if (msg.command === 'commitLoaded') {
      ctx.historyLoading = false;
      historyModule.showErdLoading(false);
      historyModule.applyNewModelData(msg.modelUI, false);
      historyModule.updateCommitCardStates();
      const headerEl2 = root.querySelector('#headerTitle') as HTMLElement | null;
      if (headerEl2) headerEl2.textContent = ctx.modelLabel + (msg.commitHash === 'CURRENT' ? ' - ERD V2' : ' @ ' + msg.commitHash.substring(0, 7));
    } else if (msg.command === 'compareLoaded') {
      ctx.historyLoading = false;
      historyModule.showErdLoading(false);
      historyModule.applyNewModelData(msg.modelUI, true);
      historyModule.setDiffLegendLabels(true);
      historyModule.updateCommitCardStates();
      const baseLabel = msg.baseCommitHash === 'CURRENT' ? 'CURRENT' : msg.baseCommitHash.substring(0, 7);
      const selLabel = msg.selectedCommitHash === 'CURRENT' ? 'CURRENT' : msg.selectedCommitHash.substring(0, 7);
      const headerEl3 = root.querySelector('#headerTitle') as HTMLElement | null;
      if (headerEl3) headerEl3.textContent = ctx.modelLabel + ' - Compare (' + baseLabel + ' vs ' + selLabel + ')';
    } else if (msg.command === 'queryResult') {
      sidebarModule.handleQueryResult(msg);
    }
  });

  // ── Delegated click handler (data-action) ─────────────────────────────────
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute('data-action');
    const arg = target.getAttribute('data-arg');
    switch (action) {
      case 'exitDrillDown':          ctx.exitDrillDown(); break;
      case 'toggleHistoryPanel':     ctx.toggleHistoryPanel(); break;
      case 'zoomIn':                 interactionModule.zoomIn(); break;
      case 'zoomOut':                interactionModule.zoomOut(); break;
      case 'resetView':              interactionModule.resetView(); break;
      case 'toggleGridMode':         interactionModule.toggleGridMode(); break;
      case 'runAutoLayout':          interactionModule.runAutoLayout(); break;
      case 'setLayoutMode':          if (arg) renderModule.setLayoutMode(arg as any); break;
      case 'setRoutingMode':         if (arg) renderModule.setRoutingMode(arg as any); break;
      case 'toggleRelationships':    renderModule.toggleRelationships(); break;
      case 'toggleUnmapped':         renderModule.toggleUnmapped(); break;
      case 'toggleHighlightChanges': legendModule.toggleHighlightChanges(); break;
      case 'toggleLeftPanel':        interactionModule.toggleLeftPanel(); break;
      case 'closeSidebar':           ctx.closeSidebar(); break;
      case 'runQuery':               sidebarModule.runQuery(); break;
      case 'closeResults':           sidebarModule.closeResults(); break;
      case 'closeHistoryPanel':      historyModule.closeHistoryPanel(); break;
      case 'setHistoryMode':         if (arg) historyModule.setHistoryMode(arg as any); break;
      case 'commitClick': {
        const hash = target.getAttribute('data-hash');
        if (hash) historyModule.onCommitClick(hash);
        break;
      }
      case 'showCrossObjectEntities': sidebarModule.showCrossObjectEntities(); break;
      case 'expandGroup': {
        const gName = target.getAttribute('data-group');
        if (gName) groupsModule.expandGroup(gName);
        break;
      }
      case 'collapseGroup': {
        const gName2 = target.getAttribute('data-group');
        if (gName2) groupsModule.collapseGroup(gName2);
        break;
      }
      case 'expandAllGroups':   groupsModule.expandAllGroups(); break;
      case 'collapseAllGroups': groupsModule.collapseAllGroups(); break;
    }
  });

  // Contextmenu for commit cards
  root.addEventListener('contextmenu', (e) => {
    const card = (e.target as HTMLElement).closest('[data-action="commitClick"]') as HTMLElement | null;
    if (card) {
      e.preventDefault();
      historyModule.onCommitRightClick(e as MouseEvent, card.getAttribute('data-hash') || '');
    }
  });
}

// Expose globally for VSIX webview injection (IIFE target strips export keyword)
if (typeof window !== 'undefined') {
  (window as any).initErd = initErd;
}
