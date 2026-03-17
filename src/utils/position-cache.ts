/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

/**
 * Position Cache Utility for ERD Node Positions
 * Generates JavaScript code to be injected into webviews for position caching via extension storage.
 * Supports topLevel and drilldown:{entityId} contexts.
 *
 * @param adapterVarName - Name of the adapter variable to use for messaging (default: 'vscode' for backward compatibility)
 */

export function getPositionCacheJS(adapterVarName: string = 'vscode'): string {
  return `
    let cachedPositionsForModel = {};
    let currentPositionContext = 'topLevel';

    function getPositionContext() {
      if (currentView === 'drilldown' && drilldownTarget) {
        return 'drilldown:' + drilldownTarget.id;
      }
      return 'topLevel';
    }

    function loadCachedPositions() {
      return cachedPositionsForModel;
    }

    function requestPositionsForContext(ctx) {
      currentPositionContext = ctx;
      ${adapterVarName}.postMessage({
        command: 'requestPositions',
        positionContext: ctx
      });
    }

    function saveCachedPosition(nodeId, x, y) {
      cachedPositionsForModel[nodeId] = {x: x, y: y};
      ${adapterVarName}.postMessage({
        command: 'savePosition',
        positionContext: getPositionContext(),
        nodeId: nodeId,
        x: x,
        y: y
      });
    }

    function saveAllCachedPositions(positions) {
      cachedPositionsForModel = positions;
      ${adapterVarName}.postMessage({
        command: 'saveAllPositions',
        positionContext: getPositionContext(),
        positions: positions
      });
    }

    function clearCachedPositions(ctx) {
      cachedPositionsForModel = {};
      ${adapterVarName}.postMessage({
        command: 'clearPositions',
        positionContext: ctx || getPositionContext()
      });
    }

    // Request top-level positions on load
    requestPositionsForContext('topLevel');
  `;
}