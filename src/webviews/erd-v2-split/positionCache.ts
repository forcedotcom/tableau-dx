/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext, Position } from './types';

export interface PositionCacheModule {
  getPositionContext(): string;
  loadCachedPositions(msg?: { positions?: Record<string, Position> }): void;
  requestPositionsForContext(ctx: string): void;
  saveCachedPosition(nodeId: string, x: number, y: number): void;
  saveAllCachedPositions(positions: Record<string, Position>): void;
  clearCachedPositions(ctx?: string): void;
}

export function createPositionCacheModule(ctx: ErdContext): PositionCacheModule {
  function getPositionContext(): string {
    if (ctx.currentView === 'drilldown' && ctx.drilldownTarget) {
      return 'drilldown:' + ctx.drilldownTarget.id;
    }
    return 'topLevel';
  }

  function loadCachedPositions(msg?: { positions?: Record<string, Position> }): void {
    if (msg && msg.positions) {
      const loadedPos = msg.positions;
      ctx.cachedPositionsForModel = loadedPos;
      const posCtx = ctx.currentPositionContext;
      if (posCtx.startsWith('drilldown:')) {
        // Drill-down view — stash for use after the animation starts
        ctx.pendingDrilldownPositions = loadedPos;
      } else {
        // Top-level view — populate cachedPositions (read by layoutForceAtlas2)
        ctx.cachedPositions = loadedPos;
        // If nodes are already rendered, animate them to their loaded positions
        const nodeIds = Object.keys(ctx.nodeElements);
        if (nodeIds.length > 0) {
          nodeIds.forEach(nodeId => {
            if (ctx.nodePositions[nodeId] && loadedPos[nodeId]) {
              ctx.nodePositions[nodeId] = { x: loadedPos[nodeId].x, y: loadedPos[nodeId].y };
            }
          });
          const layoutMod = (ctx as any)._layoutModule;
          if (layoutMod) layoutMod.snapAllToGrid(ctx.nodePositions, layoutMod.getGridCellSize('top'));
          nodeIds.forEach(nodeId => {
            const el = ctx.nodeElements[nodeId];
            const pos = ctx.nodePositions[nodeId];
            if (el && pos) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
          });
          ctx.drawEdges();
          ctx.fitToViewport();
        }
      }
    }
  }

  function requestPositionsForContext(posCtx: string): void {
    ctx.currentPositionContext = posCtx;
    ctx.vscode.postMessage({ command: 'requestPositions', positionContext: posCtx });
  }

  function saveCachedPosition(nodeId: string, x: number, y: number): void {
    ctx.cachedPositionsForModel[nodeId] = { x, y };
    ctx.vscode.postMessage({
      command: 'savePosition',
      positionContext: getPositionContext(),
      nodeId,
      x,
      y,
    });
  }

  function saveAllCachedPositions(positions: Record<string, Position>): void {
    ctx.cachedPositionsForModel = positions;
    ctx.vscode.postMessage({
      command: 'saveAllPositions',
      positionContext: getPositionContext(),
      positions,
    });
  }

  function clearCachedPositions(posCtx?: string): void {
    ctx.cachedPositionsForModel = {};
    ctx.vscode.postMessage({
      command: 'clearPositions',
      positionContext: posCtx || getPositionContext(),
    });
  }

  return { getPositionContext, loadCachedPositions, requestPositionsForContext, saveCachedPosition, saveAllCachedPositions, clearCachedPositions };
}