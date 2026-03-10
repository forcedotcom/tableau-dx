/**
 * Position Cache Utility for ERD Node Positions
 * Generates JavaScript code to be injected into webviews for position caching via extension storage.
 * Supports topLevel and drilldown:{entityId} contexts.
 */

export function getPositionCacheJS(): string {
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
      vscode.postMessage({
        command: 'requestPositions',
        positionContext: ctx
      });
    }
    
    function saveCachedPosition(nodeId, x, y) {
      cachedPositionsForModel[nodeId] = {x: x, y: y};
      vscode.postMessage({
        command: 'savePosition',
        positionContext: getPositionContext(),
        nodeId: nodeId,
        x: x,
        y: y
      });
    }
    
    function saveAllCachedPositions(positions) {
      cachedPositionsForModel = positions;
      vscode.postMessage({
        command: 'saveAllPositions',
        positionContext: getPositionContext(),
        positions: positions
      });
    }
    
    function clearCachedPositions(ctx) {
      cachedPositionsForModel = {};
      vscode.postMessage({
        command: 'clearPositions',
        positionContext: ctx || getPositionContext()
      });
    }
    
    // Request top-level positions on load
    requestPositionsForContext('topLevel');
  `;
}
