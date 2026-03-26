/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

// ─── Field types ─────────────────────────────────────────────────────────────

export type DiffStatus = 'added' | 'modified' | 'removed' | 'unchanged' | 'modified-children';
export type NodeType = 'dataObject' | 'logicalView';
export type DataObjectType = 'Dmo' | 'Dlo' | 'Cio';
export type ViewMode = 'top' | 'grouped' | 'listGrouped' | 'drilldown';
export type RoutingMode = 'classic' | 'orthogonal' | 'curved' | 'straight';
export type LayoutMode = 'force' | 'grid';
export type HistoryViewMode = 'view' | 'compare';

export interface DimField {
  apiName: string;
  label: string;
  dataType: string;
  dataObjectFieldName: string;
  diffStatus?: DiffStatus | null;
  sourceObject?: string;
}

export interface MeasField {
  apiName: string;
  label: string;
  dataType: string;
  aggregationType: string;
  diffStatus?: DiffStatus | null;
  sourceObject?: string;
}

export interface CalcField {
  apiName: string;
  label: string;
  expression?: string;
  dataType?: string;
  aggregationType?: string;
  placement?: string;
  isSystemDefinition?: boolean;
  referencedObjects?: string[];
  directReferences?: Array<{ objectApiName: string | null; fieldApiName: string; raw: string }>;
  diffStatus?: DiffStatus | null;
}

export interface HierarchyField {
  apiName: string;
  label: string;
  levels?: Array<{ definitionApiName: string; definitionFieldName: string; position: number }>;
  placement?: string;
  referencedObjects?: string[];
  diffStatus?: DiffStatus | null;
}

export interface MetricField {
  apiName: string;
  label: string;
  aggregationType?: string;
  placement?: string;
  referencedObjects?: string[];
  diffStatus?: DiffStatus | null;
}

export interface GroupingField {
  apiName: string;
  label: string;
  type?: string;
  diffStatus?: DiffStatus | null;
}

// ─── Core ERD data ────────────────────────────────────────────────────────────

export interface ErdNode {
  id: string;
  label: string;
  type: NodeType;
  dataObjectType?: DataObjectType | string;
  dataObjectName?: string;
  tableType?: string;
  diffStatus?: DiffStatus | null;
  unmapped?: boolean;
  baseModelApiName?: string;
  dimCount: number;
  measCount: number;
  dimensions: DimField[];
  measurements: MeasField[];
  relatedCalcDims: CalcField[];
  relatedCalcMeas: CalcField[];
  relatedHierarchies: HierarchyField[];
  relatedMetrics: MetricField[];
  relatedGroupings: GroupingField[];
}

export interface ErdEdge {
  id: string;
  label: string;
  from: string;
  to: string;
  cardinality: string;
  joinType: string;
  isEnabled: boolean;
  fromField: string;
  toField: string;
  joinOperator: string;
  diffStatus?: DiffStatus | null;
  suggestions?: unknown[];
  baseModelApiName?: string;
}

export interface CrossObjectEntity {
  entityApiName: string;
  entityType: string;
  placement: string;
  referencedObjects: string[];
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: string[];
}

export interface GroupsConfig {
  groups: Array<{ name: string; objects: string[] }>;
  ungrouped?: string[];
}

export interface GroupNode {
  name: string;
  objects: string[];
  count: number;
}

export interface GroupEdge {
  groupA: string;
  groupB: string;
  count: number;
  entityEdges: ErdEdge[];
}

export interface Position {
  x: number;
  y: number;
}

export interface DiffLabels {
  added: string;
  modified: string;
  removed: string;
}

// ─── ErdData: input to initErd ───────────────────────────────────────────────

export interface ErdData {
  nodes?: ErdNode[];
  edges?: ErdEdge[];
  crossObjectEntities?: CrossObjectEntity[];
  calcFieldsLookup?: Record<string, CalcField>;
  baseModelLabels?: Record<string, string>;
  isCompareMode?: boolean;
  isHistoryMode?: boolean;
  commits?: GitCommitInfo[];
  groupsData?: GroupsConfig | null;
  hasGroups?: boolean;
  hasUnmappedNodes?: boolean;
  initialViewMode?: string;
  modelApiName?: string;
  modelLabel?: string;
  // SVG icon strings
  tableSvg?: string;
  dataModelSvg?: string;
  dataLakeSvg?: string;
  calcDimSvg?: string;
  calcMesSvg?: string;
  hierarchySvg?: string;
  metricSvg?: string;
  groupingSvg?: string;
  sharedSvg?: string;
  calcInsightSvg?: string;
}

// ─── VSCode adapter interface ─────────────────────────────────────────────────

export interface VscodeAdapter {
  postMessage(msg: Record<string, unknown>): void;
}

// ─── ErdContext: shared mutable state for all modules ────────────────────────

export interface ErdContext {
  // ── Root element & DOM refs ──
  root: HTMLElement;
  erdContainer: HTMLElement;
  viewport: HTMLElement;
  svg: SVGSVGElement;
  nodesLayer: HTMLElement;
  sidebar: HTMLElement;
  groupContainersLayer: HTMLElement;

  // ── Input data (immutable after init) ──
  nodes: ErdNode[];
  edges: ErdEdge[];
  crossObjectEntities: CrossObjectEntity[];
  calcFieldsLookup: Record<string, CalcField>;
  baseModelLabels: Record<string, string>;
  isCompareMode: boolean;
  isHistoryMode: boolean;
  commits: GitCommitInfo[];
  groupsData: GroupsConfig | null;
  hasGroups: boolean;
  hasUnmappedNodes: boolean;
  initialViewMode: string;
  modelApiName: string;
  modelLabel: string;
  embeddedMode: boolean;

  // ── SVG icons ──
  tableSvg: string;
  dataModelSvg: string;
  dataLakeSvg: string;
  calcDimSvg: string;
  calcMesSvg: string;
  hierarchySvg: string;
  metricSvg: string;
  groupingSvg: string;
  sharedSvg: string;
  calcInsightSvg: string;
  entitySvgIcons: Record<string, string>;
  entityFallbackIcons: Record<string, string>;

  // ── Environment adapter ──
  vscode: VscodeAdapter;

  // ── Position cache ──
  cachedPositionsForModel: Record<string, Position>;
  currentPositionContext: string;
  cachedPositions: Record<string, Position>;
  pendingDrilldownPositions: Record<string, Position> | null;

  // ── Pan / zoom state ──
  panX: number;
  panY: number;
  scale: number;
  isPanning: boolean;
  panStartX: number;
  panStartY: number;

  // ── Drag state ──
  draggingNode: string | null;
  dragOffsetX: number;
  dragOffsetY: number;

  // ── Node state ──
  nodePositions: Record<string, Position>;
  nodeElements: Record<string, HTMLElement>;

  // ── View state ──
  currentView: ViewMode;
  routingMode: RoutingMode;
  showUnmapped: boolean;
  isGridMode: boolean;
  layoutMode: LayoutMode;
  hideRelationships: boolean;
  highlightChangesActive: boolean;
  topHoverActive: boolean;

  // ── Constants ──
  NODE_SIZE: number;
  ENTITY_SIZE: number;
  EDGE_OBJ_SIZE: number;
  GRID_CELL: { w: number; h: number };

  // ── Drill-down state ──
  drilldownTarget: ErdNode | null;
  currentQueryNode: ErdNode | null;
  ddPositions: Record<string, Position>;
  ddElements: Record<string, HTMLElement>;
  ddCenterPos: Position | null;
  ddCenterId: string | null;
  ddEntities: CalcField[];
  ddEdgeObjectIds: Set<string>;
  savedTopViewState: { panX: number; panY: number; scale: number };
  savedDrillNodeId: string | null;
  savedHideRelationships: boolean;
  isTransitioning: boolean;
  ddHoverActive: boolean;
  ddHoverTimer: ReturnType<typeof setTimeout> | null;

  // ── Group state ──
  GROUP_CLOUD_W: number;
  GROUP_CLOUD_H: number;
  GROUP_RECT_PAD: number;
  REPOSITION_ANIM_MS: number;
  expandedGroups: Set<string>;
  groupNodePositions: Record<string, Position>;
  groupNodeElements: Record<string, HTMLElement>;
  groupCenterMarkerElements: Record<string, HTMLElement>;
  groupRectBorderElements: Record<string, HTMLElement>;
  groupEntityPositions: Record<string, Position>;
  groupEntityElements: Record<string, HTMLElement>;
  entityToGroup: Record<string, string>;
  groupNodesList: GroupNode[];
  groupEdgesList: GroupEdge[];
  isGroupedMode: boolean;
  savedGroupState: unknown | null;

  // ── History state ──
  historyCommits: GitCommitInfo[];
  selectedCommitHash: string;
  baseCommitHash: string | null;
  historyViewMode: HistoryViewMode;
  historyLoading: boolean;

  // ── Diff state ──
  diffLabels: DiffLabels;

  // ── Wheel zoom state ──
  wheelAccum: number;
  wheelActive: boolean;
  wheelTimer: ReturnType<typeof setTimeout> | null;

  // ── Cross-module function references (set during init) ──
  drawEdges(): void;
  drawDrillEdges(): void;
  openSidebar(node: ErdNode): void;
  closeSidebar(): void;
  enterDrillDown(node: ErdNode): void;
  exitDrillDown(): void;
  renderTopLevel(forceRelayout?: boolean): void;
  fitToViewport(): void;
  updateView(): void;
  applyHighlightDimming(): void;
  updateLegendCounts(): void;
  redrawGroupEdges(): void;
  getGridCellSize(mode?: string): { w: number; h: number };
  updateLayoutControls(): void;
  updateEmbeddedBackBtnPosition(): void;
  toggleHistoryPanel(): void;
}