/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext, ErdNode, ErdEdge, Position } from './types';

export interface LayoutModule {
  getGridCellSize(mode?: string): { w: number; h: number };
  posToCell(x: number, y: number, cs: { w: number; h: number }): { col: number; row: number };
  cellToPos(col: number, row: number, cs: { w: number; h: number }): Position;
  gridKey(col: number, row: number): string;
  buildOccupancyMap(positions: Record<string, Position>, cs: { w: number; h: number }, excludeId?: string): Record<string, string>;
  findNearestFreeCell(tc: number, tr: number, occ: Record<string, string>): { col: number; row: number };
  snapToGridPos(x: number, y: number, cs: { w: number; h: number }): Position;
  snapAllToGrid(positions: Record<string, Position>, cs: { w: number; h: number }, nodeIds?: string[]): void;
  snapDraggedNode(posMap: Record<string, Position>, nodeId: string, cs: { w: number; h: number }, elMap?: Record<string, HTMLElement>): void;
  isComplexModel(): boolean;
  layoutForceAtlas2(nodeList: ErdNode[], edgeList: ErdEdge[], skipCache: boolean): void;
  layoutGrid(nodeList: ErdNode[]): void;
  layoutDrillDown(drillNodes: Array<{ id: string }>, drillEdges: Array<{ from: string; to: string }>): void;
}

export function createLayoutModule(ctx: ErdContext): LayoutModule {
  function getGridCellSize(mode?: string): { w: number; h: number } {
    if (mode === 'groupCircle') return { w: ctx.GRID_CELL.w * 2, h: ctx.GRID_CELL.h * 2 };
    if (mode === 'groupEntity') return { w: ctx.GRID_CELL.w, h: ctx.GRID_CELL.h };
    if (mode === 'drilldown') return { w: 120, h: 120 };
    return ctx.GRID_CELL;
  }

  function posToCell(x: number, y: number, cs: { w: number; h: number }) {
    return { col: Math.round(x / cs.w), row: Math.round(y / cs.h) };
  }

  function cellToPos(col: number, row: number, cs: { w: number; h: number }): Position {
    return { x: col * cs.w, y: row * cs.h };
  }

  function isComplexModel(): boolean {
    const objectCount = ctx.nodes.length;
    return objectCount > 30 || (objectCount > 15 && ctx.edges.length > 1.3 * objectCount);
  }

  function gridKey(col: number, row: number): string {
    return col + ',' + row;
  }

  function buildOccupancyMap(positions: Record<string, Position>, cs: { w: number; h: number }, excludeId?: string): Record<string, string> {
    const occ: Record<string, string> = {};
    Object.keys(positions).forEach(function (id) {
      if (id === excludeId) return;
      const p = positions[id];
      if (!p) return;
      const c = posToCell(p.x, p.y, cs);
      occ[gridKey(c.col, c.row)] = id;
    });
    return occ;
  }

  function findNearestFreeCell(tc: number, tr: number, occ: Record<string, string>): { col: number; row: number } {
    if (!occ[gridKey(tc, tr)]) return { col: tc, row: tr };
    for (let r = 1; r <= 50; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
          const c = tc + dc, rr = tr + dr;
          if (!occ[gridKey(c, rr)]) return { col: c, row: rr };
        }
      }
    }
    return { col: tc, row: tr };
  }

  function snapToGridPos(x: number, y: number, cs: { w: number; h: number }): Position {
    const c = posToCell(x, y, cs);
    return cellToPos(c.col, c.row, cs);
  }

  function snapAllToGrid(positions: Record<string, Position>, cs: { w: number; h: number }, nodeIds?: string[]): void {
    if (!ctx.isGridMode) return;
    const ids = nodeIds || Object.keys(positions);
    const items: Array<{ id: string; col: number; row: number; dist: number }> = [];
    ids.forEach(function (id) {
      const pos = positions[id];
      if (!pos) return;
      const c = posToCell(pos.x, pos.y, cs);
      const ideal = cellToPos(c.col, c.row, cs);
      const dx = pos.x - ideal.x, dy = pos.y - ideal.y;
      items.push({ id, col: c.col, row: c.row, dist: Math.sqrt(dx * dx + dy * dy) });
    });
    items.sort(function (a, b) { return a.dist - b.dist; });
    const occ: Record<string, boolean> = {};
    items.forEach(function (item) {
      const key = gridKey(item.col, item.row);
      if (!occ[key]) {
        occ[key] = true;
        positions[item.id] = cellToPos(item.col, item.row, cs);
      } else {
        const free = findNearestFreeCell(item.col, item.row, occ as any);
        occ[gridKey(free.col, free.row)] = true;
        positions[item.id] = cellToPos(free.col, free.row, cs);
      }
    });
  }

  function snapDraggedNode(posMap: Record<string, Position>, nodeId: string, cs: { w: number; h: number }, elMap?: Record<string, HTMLElement>): void {
    if (!ctx.isGridMode) return;
    const pos = posMap[nodeId];
    if (!pos) return;
    const occ = buildOccupancyMap(posMap, cs, nodeId);
    const target = posToCell(pos.x, pos.y, cs);
    const free = findNearestFreeCell(target.col, target.row, occ);
    const snapped = cellToPos(free.col, free.row, cs);
    pos.x = snapped.x;
    pos.y = snapped.y;
    const el = elMap ? elMap[nodeId] : null;
    if (el) {
      el.style.transition = 'left 0.15s ease, top 0.15s ease';
      el.style.left = snapped.x + 'px';
      el.style.top = snapped.y + 'px';
      setTimeout(function () { el.style.transition = ''; }, 160);
    }
  }

  function layoutForceAtlas2(nodeList: ErdNode[], edgeList: ErdEdge[], skipCache: boolean): void {
    const iterations = 500;
    const repulsion = 15000;
    const springLength = 200;
    const springStiffness = 0.04;
    const baseGravity = 0.008;
    const gravity = baseGravity * Math.max(1, nodeList.length / 20);
    const maxDisplacement = 50;
    const padding = 150;
    const canvasWidth = Math.max(1200, Math.min(nodeList.length * 140, 3000));
    const canvasHeight = Math.max(800, Math.min(nodeList.length * 100, 2200));

    const degree: Record<string, number> = {};
    nodeList.forEach(n => { degree[n.id] = 0; });
    edgeList.forEach(e => {
      if (degree[e.from] !== undefined) degree[e.from]++;
      if (degree[e.to] !== undefined) degree[e.to]++;
    });

    if (!skipCache) {
      let allCached = Object.keys(ctx.cachedPositions).length > 0;
      nodeList.forEach(n => { if (!ctx.cachedPositions[n.id]) allCached = false; });
      if (allCached) {
        nodeList.forEach(n => {
          ctx.nodePositions[n.id] = { x: ctx.cachedPositions[n.id].x, y: ctx.cachedPositions[n.id].y };
        });
        snapAllToGrid(ctx.nodePositions, getGridCellSize('top'));
        return;
      }
    }

    const positions: Record<string, Position> = {};
    const velocities: Record<string, Position> = {};
    nodeList.forEach(n => {
      if (!skipCache && ctx.cachedPositions[n.id]) {
        positions[n.id] = { x: ctx.cachedPositions[n.id].x, y: ctx.cachedPositions[n.id].y };
      } else {
        positions[n.id] = {
          x: padding + Math.random() * (canvasWidth - 2 * padding),
          y: padding + Math.random() * (canvasHeight - 2 * padding),
        };
      }
      velocities[n.id] = { x: 0, y: 0 };
    });

    for (let iter = 0; iter < iterations; iter++) {
      const forces: Record<string, Position> = {};
      nodeList.forEach(n => { forces[n.id] = { x: 0, y: 0 }; });
      for (let i = 0; i < nodeList.length; i++) {
        for (let j = i + 1; j < nodeList.length; j++) {
          const a = nodeList[i].id, b = nodeList[j].id;
          const dx = positions[a].x - positions[b].x;
          const dy = positions[a].y - positions[b].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = (repulsion * (1 + degree[a]) * (1 + degree[b])) / (dist * dist);
          const fx = force * dx / dist, fy = force * dy / dist;
          forces[a].x += fx; forces[a].y += fy;
          forces[b].x -= fx; forces[b].y -= fy;
        }
      }
      edgeList.forEach(e => {
        const pa = positions[e.from], pb = positions[e.to];
        if (!pa || !pb) return;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = springStiffness * (dist - springLength);
        const fx = force * dx / dist, fy = force * dy / dist;
        forces[e.from].x += fx; forces[e.from].y += fy;
        forces[e.to].x -= fx; forces[e.to].y -= fy;
      });
      nodeList.forEach(n => {
        forces[n.id].x += (canvasWidth / 2 - positions[n.id].x) * gravity;
        forces[n.id].y += (canvasHeight / 2 - positions[n.id].y) * gravity;
      });
      nodeList.forEach(n => {
        velocities[n.id].x = (velocities[n.id].x + forces[n.id].x) * 0.85;
        velocities[n.id].y = (velocities[n.id].y + forces[n.id].y) * 0.85;
        const speed = Math.sqrt(velocities[n.id].x * velocities[n.id].x + velocities[n.id].y * velocities[n.id].y);
        if (speed > maxDisplacement) {
          velocities[n.id].x *= maxDisplacement / speed;
          velocities[n.id].y *= maxDisplacement / speed;
        }
        positions[n.id].x += velocities[n.id].x;
        positions[n.id].y += velocities[n.id].y;
      });
    }

    const xs = Object.values(positions).map(p => p.x);
    const ys = Object.values(positions).map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;

    nodeList.forEach(n => {
      const raw = positions[n.id];
      ctx.nodePositions[n.id] = {
        x: padding + ((raw.x - minX) / rangeX) * (canvasWidth - 2 * padding - ctx.NODE_SIZE),
        y: padding + ((raw.y - minY) / rangeY) * (canvasHeight - 2 * padding - ctx.NODE_SIZE),
      };
    });
    snapAllToGrid(ctx.nodePositions, getGridCellSize('top'));
  }

  function layoutGrid(nodeList: ErdNode[]): void {
    const count = nodeList.length;
    if (count === 0) return;
    const cols = Math.ceil(Math.sqrt(count * 4 / 3));
    const CELL_W = 180;
    const CELL_H = 190;
    const PAD = 60;
    nodeList.forEach(function (n, idx) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      ctx.nodePositions[n.id] = { x: PAD + col * CELL_W, y: PAD + row * CELL_H };
    });
  }

  function layoutDrillDown(drillNodes: Array<{ id: string }>, drillEdges: Array<{ from: string; to: string }>): void {
    const iterations = 300;
    const repulsion = 8000;
    const springLength = 120;
    const springStiffness = 0.08;
    const baseGravity = 0.02;
    const gravity = baseGravity * Math.max(1, drillNodes.length / 10);
    const maxDisplacement = 50;
    const padding = 80;
    const canvasW = Math.max(800, Math.min(drillNodes.length * 100, 2000));
    const canvasH = Math.max(600, Math.min(drillNodes.length * 70, 1500));
    const centerX = canvasW / 2, centerY = canvasH / 2;

    const degree: Record<string, number> = {};
    drillNodes.forEach(n => { degree[n.id] = 0; });
    drillEdges.forEach(e => {
      if (degree[e.from] !== undefined) degree[e.from]++;
      if (degree[e.to] !== undefined) degree[e.to]++;
    });

    const positions: Record<string, Position> = {};
    const velocities: Record<string, Position> = {};
    drillNodes.forEach(n => {
      if (n.id === '__center__') {
        positions[n.id] = { x: centerX, y: centerY };
      } else {
        const angle = Math.random() * 2 * Math.PI;
        const r = 150 + Math.random() * 200;
        positions[n.id] = { x: centerX + Math.cos(angle) * r, y: centerY + Math.sin(angle) * r };
      }
      velocities[n.id] = { x: 0, y: 0 };
    });

    for (let iter = 0; iter < iterations; iter++) {
      const forces: Record<string, Position> = {};
      drillNodes.forEach(n => { forces[n.id] = { x: 0, y: 0 }; });
      for (let i = 0; i < drillNodes.length; i++) {
        for (let j = i + 1; j < drillNodes.length; j++) {
          const a = drillNodes[i].id, b = drillNodes[j].id;
          const dx = positions[a].x - positions[b].x;
          const dy = positions[a].y - positions[b].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = (repulsion * (1 + degree[a]) * (1 + degree[b])) / (dist * dist);
          const fx = force * dx / dist, fy = force * dy / dist;
          forces[a].x += fx; forces[a].y += fy;
          forces[b].x -= fx; forces[b].y -= fy;
        }
      }
      drillEdges.forEach(e => {
        const pa = positions[e.from], pb = positions[e.to];
        if (!pa || !pb) return;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const sf = springStiffness * (dist - springLength);
        const fx = sf * dx / dist, fy = sf * dy / dist;
        forces[e.from].x += fx; forces[e.from].y += fy;
        forces[e.to].x -= fx; forces[e.to].y -= fy;
      });
      drillNodes.forEach(n => {
        if (n.id !== '__center__') {
          forces[n.id].x += (centerX - positions[n.id].x) * gravity;
          forces[n.id].y += (centerY - positions[n.id].y) * gravity;
        }
      });
      drillNodes.forEach(n => {
        if (n.id === '__center__') return;
        velocities[n.id].x = (velocities[n.id].x + forces[n.id].x) * 0.85;
        velocities[n.id].y = (velocities[n.id].y + forces[n.id].y) * 0.85;
        const speed = Math.sqrt(velocities[n.id].x * velocities[n.id].x + velocities[n.id].y * velocities[n.id].y);
        if (speed > maxDisplacement) {
          velocities[n.id].x *= maxDisplacement / speed;
          velocities[n.id].y *= maxDisplacement / speed;
        }
        positions[n.id].x += velocities[n.id].x;
        positions[n.id].y += velocities[n.id].y;
      });
    }

    const xs = Object.values(positions).map(p => p.x);
    const ys = Object.values(positions).map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;

    drillNodes.forEach(n => {
      ctx.ddPositions[n.id] = {
        x: padding + ((positions[n.id].x - minX) / rangeX) * (canvasW - 2 * padding),
        y: padding + ((positions[n.id].y - minY) / rangeY) * (canvasH - 2 * padding),
      };
    });
  }

  return {
    getGridCellSize, posToCell, cellToPos, gridKey, buildOccupancyMap, findNearestFreeCell,
    snapToGridPos, snapAllToGrid, snapDraggedNode, isComplexModel, layoutForceAtlas2, layoutGrid, layoutDrillDown
  };
}