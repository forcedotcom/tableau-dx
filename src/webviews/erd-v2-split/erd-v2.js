export function initErd(root, data, embeddedMode) {
  var nodes = data.nodes || [];
  var edges = data.edges || [];
  var crossObjectEntities = data.crossObjectEntities || [];
  var calcFieldsLookup = data.calcFieldsLookup || {};
  var baseModelLabels = data.baseModelLabels || {};
  var isCompareMode = !!data.isCompareMode;
  var isHistoryMode = !!data.isHistoryMode;
  var commits = data.commits || [];
  var groupsData = data.groupsData || null;
  var hasGroups = !!data.hasGroups;
  var hasUnmappedNodes = !!data.hasUnmappedNodes;
  var initialViewMode = data.initialViewMode || 'top';
  var tableSvg = data.tableSvg || '';
  var dataModelSvg = data.dataModelSvg || '';
  var dataLakeSvg = data.dataLakeSvg || '';
  var calcDimSvg = data.calcDimSvg || '';
  var calcMesSvg = data.calcMesSvg || '';
  var hierarchySvg = data.hierarchySvg || '';
  var metricSvg = data.metricSvg || '';
  var groupingSvg = data.groupingSvg || '';
  var sharedSvg = data.sharedSvg || '';
  var calcInsightSvg = data.calcInsightSvg || '';
  var modelApiName = data.modelApiName || '';
  var modelLabel = data.modelLabel || '';

    // Environment adapter: VSCode webview or Salesforce (no-op)
    const vscode = (typeof window.__erdAdapter !== 'undefined')
      ? window.__erdAdapter
      : (typeof acquireVsCodeApi !== 'undefined')
        ? acquireVsCodeApi()
        : { postMessage: function() {} };


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

    const entitySvgIcons = {
      'calc-dim': calcDimSvg,
      'calc-meas': calcMesSvg,
      'dim-hier': hierarchySvg,
      'metric': metricSvg,
      'grouping': groupingSvg
    };

    function getNodeClass(n) {
      if (n.type === 'logicalView') return 'logical-view';
      if (n.dataObjectType === 'Cio') return 'calc-insight';
      if (n.dataObjectType === 'Dlo') return 'data-lake-object';
      return 'data-object';
    }
    function getNodeIcon(n) {
      if (n.type === 'logicalView') return tableSvg;
      if (n.dataObjectType === 'Cio') return calcInsightSvg;
      if (n.dataObjectType === 'Dlo') return dataLakeSvg;
      return dataModelSvg;
    }

    function getDiffClassFromStatus(ds) {
      if (!ds || ds === 'unchanged') return '';
      if (ds === 'added') return ' diff-added';
      if (ds === 'modified') return ' diff-modified';
      if (ds === 'removed') return ' diff-removed';
      return '';
    }

    function getDiffClass(nodeOrApiName) {
      if (!isCompareMode) return '';
      if (typeof nodeOrApiName === 'object' && nodeOrApiName !== null) {
        return getDiffClassFromStatus(nodeOrApiName.diffStatus);
      }
      const n = nodes.find(nn => nn.id === nodeOrApiName);
      return n ? getDiffClassFromStatus(n.diffStatus) : '';
    }

    function getDiffStatus(nodeOrApiName) {
      if (!isCompareMode) return null;
      if (typeof nodeOrApiName === 'object' && nodeOrApiName !== null) {
        const ds = nodeOrApiName.diffStatus;
        return (ds && ds !== 'unchanged') ? ds : null;
      }
      const n = nodes.find(nn => nn.id === nodeOrApiName);
      if (n) { const ds = n.diffStatus; return (ds && ds !== 'unchanged') ? ds : null; }
      return null;
    }

    function diffBadgeHtml(nodeOrApiNameOrDs) {
      let s = null;
      if (typeof nodeOrApiNameOrDs === 'string' && ['added','modified','removed'].includes(nodeOrApiNameOrDs)) {
        s = nodeOrApiNameOrDs;
      } else {
        s = getDiffStatus(nodeOrApiNameOrDs);
      }
      if (!s) return '';
      return '<span class="sidebar-diff-badge ' + s + '">' + diffLabels[s] + '</span>';
    }

    var highlightChangesActive = false;

    if (isCompareMode) {
      root.querySelector('#diffLegendSection').style.display = 'block';
      let addedCount = 0, modifiedCount = 0, removedCount = 0;
      const allItems = [...nodes, ...edges];
      nodes.forEach(n => {
        [n.relatedCalcDims, n.relatedCalcMeas, n.relatedHierarchies, n.relatedMetrics, n.relatedGroupings].forEach(list => {
          if (list) allItems.push(...list);
        });
      });
      allItems.forEach(item => {
        if (item.diffStatus === 'added') addedCount++;
        else if (item.diffStatus === 'modified') modifiedCount++;
        else if (item.diffStatus === 'removed') removedCount++;
      });
      let total = addedCount + modifiedCount + removedCount;
      let parts = [];
      if (addedCount) parts.push(addedCount + ' added');
      if (modifiedCount) parts.push(modifiedCount + ' modified');
      if (removedCount) parts.push(removedCount + ' ' + diffLabels.removed.toLowerCase());
      root.querySelector('#diffSummary').textContent = total === 0 ? 'No differences found' : parts.join(', ') + ' (' + total + ' total)';
    }

    function updateChangesButtons() {
      var btn = root.querySelector('#changesToggleBtn');
      if (btn) {
        btn.classList.toggle('route-active', highlightChangesActive);
        btn.title = highlightChangesActive ? 'Show All' : 'Highlight Changes';
        var lbl = btn.querySelector('.lp-btn-label');
        if (lbl) lbl.textContent = highlightChangesActive ? 'Changes: On' : 'Highlight Changes';
      }
    }

    function setHighlightChanges(active) {
      if (!isCompareMode) return;
      if (highlightChangesActive === active) return;
      highlightChangesActive = active;
      updateChangesButtons();
      applyHighlightDimming();
    }

    function toggleHighlightChanges() {
      setHighlightChanges(!highlightChangesActive);
    }

    function toggleLegend() {}

    function toggleLeftPanel() {
      var panel = root.querySelector('#leftPanel');
      panel.classList.toggle('expanded');
      // Only track the back button position in embedded mode
      if (embeddedMode) {
        var _lpTransitionStart = Date.now();
        function _trackLeftPanel() {
          updateEmbeddedBackBtnPosition();
          if (Date.now() - _lpTransitionStart < 260) requestAnimationFrame(_trackLeftPanel);
        }
        requestAnimationFrame(_trackLeftPanel);
      }
    }

    function updateLegendCounts() {
      var dmoCount = 0, dloCount = 0, ciCount = 0, lvCount = 0, baseCount = 0, unmappedCount = 0;
      nodes.forEach(function(n) {
        if (n.type === 'logicalView') lvCount++;
        else if (n.dataObjectType === 'Cio') ciCount++;
        else if (n.dataObjectType === 'Dlo') dloCount++;
        else dmoCount++;
        if (n.baseModelApiName) baseCount++;
        if (n.unmapped) unmappedCount++;
      });
      var el;
      el = root.querySelector('#legendDmoCount'); if (el) el.textContent = String(dmoCount);
      el = root.querySelector('#legendDmoItem'); if (el) el.style.display = dmoCount > 0 ? '' : 'none';
      el = root.querySelector('#legendDloCount'); if (el) el.textContent = String(dloCount);
      el = root.querySelector('#legendDloItem'); if (el) el.style.display = dloCount > 0 ? '' : 'none';
      el = root.querySelector('#legendCiCount'); if (el) el.textContent = String(ciCount);
      el = root.querySelector('#legendCiItem'); if (el) el.style.display = ciCount > 0 ? '' : 'none';
      el = root.querySelector('#legendLvCount'); if (el) el.textContent = String(lvCount);
      el = root.querySelector('#legendLvItem'); if (el) el.style.display = lvCount > 0 ? '' : 'none';
      el = root.querySelector('#legendRelCount'); if (el) el.textContent = String(edges.length);
      el = root.querySelector('#legendBaseCount'); if (el) el.textContent = String(baseCount);
      el = root.querySelector('#baseModelLegendItem'); if (el) el.style.display = baseCount > 0 ? '' : 'none';
      el = root.querySelector('#legendUnmappedCount'); if (el) el.textContent = String(unmappedCount);
      el = root.querySelector('#unmappedLegendItem'); if (el) el.style.display = unmappedCount > 0 ? '' : 'none';
      el = root.querySelector('#indicatorsLegendSection'); if (el) el.style.display = (baseCount > 0 || unmappedCount > 0) ? 'block' : 'none';
    }

    function applyHighlightDimming() {
      if (!isCompareMode) return;

      if (currentView === 'top') {
        nodes.forEach(n => {
          const el = nodeElements[n.id];
          if (!el) return;
          const hasChange = n.diffStatus && n.diffStatus !== 'unchanged';
          if (highlightChangesActive && !hasChange) {
            el.classList.add('diff-dimmed');
          } else {
            el.classList.remove('diff-dimmed');
          }
        });
        drawEdges();
      } else if (currentView === 'drilldown') {
        Object.keys(ddElements).forEach(key => {
          const el = ddElements[key];
          if (!el) return;
          let hasChange = false;
          if (key === '__center__') {
            const cn = nodes.find(n => n.id === ddCenterId);
            hasChange = cn && cn.diffStatus && cn.diffStatus !== 'unchanged';
          } else if (key.startsWith('ent_')) {
            const entApi = key.substring(4);
            const ent = ddEntities.find(e => e.apiName === entApi);
            hasChange = ent && ent.diffStatus && ent.diffStatus !== 'unchanged';
          } else if (key.startsWith('eobj_')) {
            const objApi = key.substring(5);
            const n = nodes.find(nn => nn.id === objApi);
            hasChange = n && n.diffStatus && n.diffStatus !== 'unchanged';
          }
          if (highlightChangesActive && !hasChange) {
            el.classList.add('diff-dimmed');
          } else {
            el.classList.remove('diff-dimmed');
          }
        });
        drawDrillEdges();
      }
    }

    const erdContainer = root.querySelector('#erdContainer');
    const viewport = root.querySelector('#viewport');
    const svg = root.querySelector('#linesSvg');
    const nodesLayer = root.querySelector('#nodesLayer');
    const sidebar = root.querySelector('#sidebar');
    
    let panX = 0, panY = 0, scale = 1;
    let isPanning = false, panStartX = 0, panStartY = 0;
    let draggingNode = null, dragOffsetX = 0, dragOffsetY = 0;
    var nodePositions = {};
    var nodeElements = {};
    const NODE_SIZE = 120;
    let cachedPositions = {};
    var pendingDrilldownPositions = null;
    var currentView = 'top'; // 'top' or 'drilldown'
    var routingMode = 'classic'; // 'classic' | 'orthogonal' | 'curved' | 'straight'
    var showUnmapped = true;
    var isGridMode = true;
    var layoutMode = 'force';
    var hideRelationships = false;
    var topHoverActive = false;

    var GRID_CELL = { w: 170, h: 200 };

    function getGridCellSize() {
      return GRID_CELL;
    }

    function posToCell(x, y, cs) {
      return { col: Math.round(x / cs.w), row: Math.round(y / cs.h) };
    }

    function cellToPos(col, row, cs) {
      return { x: col * cs.w, y: row * cs.h };
    }

    function isComplexModel() {
      var objectCount = nodes.length;
      return objectCount > 30 || (objectCount > 15 && edges.length > 1.3 * objectCount);
    }

    function gridKey(col, row) { return col + ',' + row; }

    function buildOccupancyMap(positions, cs, excludeId) {
      var occ = {};
      Object.keys(positions).forEach(function(id) {
        if (id === excludeId) return;
        var p = positions[id];
        if (!p) return;
        var c = posToCell(p.x, p.y, cs);
        occ[gridKey(c.col, c.row)] = id;
      });
      return occ;
    }

    function findNearestFreeCell(tc, tr, occ) {
      if (!occ[gridKey(tc, tr)]) return { col: tc, row: tr };
      for (var r = 1; r <= 50; r++) {
        for (var dc = -r; dc <= r; dc++) {
          for (var dr = -r; dr <= r; dr++) {
            if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
            var c = tc + dc, rr = tr + dr;
            if (!occ[gridKey(c, rr)]) return { col: c, row: rr };
          }
        }
      }
      return { col: tc, row: tr };
    }

    function snapToGridPos(x, y, cs) {
      var c = posToCell(x, y, cs);
      return cellToPos(c.col, c.row, cs);
    }

    function snapAllToGrid(positions, cs, nodeIds) {
      if (!isGridMode) return;
      var ids = nodeIds || Object.keys(positions);
      var items = [];
      ids.forEach(function(id) {
        var pos = positions[id];
        if (!pos) return;
        var c = posToCell(pos.x, pos.y, cs);
        var ideal = cellToPos(c.col, c.row, cs);
        var dx = pos.x - ideal.x, dy = pos.y - ideal.y;
        items.push({ id: id, col: c.col, row: c.row, dist: Math.sqrt(dx * dx + dy * dy) });
      });
      items.sort(function(a, b) { return a.dist - b.dist; });
      var occ = {};
      items.forEach(function(item) {
        var key = gridKey(item.col, item.row);
        if (!occ[key]) {
          occ[key] = true;
          positions[item.id] = cellToPos(item.col, item.row, cs);
        } else {
          var free = findNearestFreeCell(item.col, item.row, occ);
          occ[gridKey(free.col, free.row)] = true;
          positions[item.id] = cellToPos(free.col, free.row, cs);
        }
      });
    }

    function snapDraggedNode(posMap, nodeId, cs, elMap) {
      if (!isGridMode) return;
      var pos = posMap[nodeId];
      if (!pos) return;
      var occ = buildOccupancyMap(posMap, cs, nodeId);
      var target = posToCell(pos.x, pos.y, cs);
      var free = findNearestFreeCell(target.col, target.row, occ);
      var snapped = cellToPos(free.col, free.row, cs);
      pos.x = snapped.x;
      pos.y = snapped.y;
      var el = elMap ? elMap[nodeId] : null;
      if (el) {
        el.style.transition = 'left 0.15s ease, top 0.15s ease';
        el.style.left = snapped.x + 'px';
        el.style.top = snapped.y + 'px';
        setTimeout(function() { el.style.transition = ''; }, 160);
      }
    }
    let drilldownTarget = null;
    let currentQueryNode = null;
    
    // Drill-down state for dragging and line redrawing
    const ENTITY_SIZE = 80;
    const EDGE_OBJ_SIZE = 100;
    let ddPositions = {};
    let ddElements = {};
    let ddCenterPos = null;
    let ddCenterId = null;
    let ddEntities = [];
    let ddEdgeObjectIds = new Set();
    
    let savedTopViewState = { panX: 0, panY: 0, scale: 1 };
    let savedDrillNodeId = null;
    let savedHideRelationships = false;
    let isTransitioning = false;
    
    const entityFallbackIcons = {
      'calc-dim': 'Cd',
      'calc-meas': 'Cm',
      'dim-hier': 'Dh',
      'metric': 'M',
      'grouping': 'G'
    };
    
    // Show drill hint briefly
    setTimeout(() => { root.querySelector('#drillHint').classList.add('visible'); }, 500);
    setTimeout(() => { root.querySelector('#drillHint').classList.remove('visible'); }, 4000);
    
    // =====================================================================
    // --- Routing Mode Path Generators ---
    // =====================================================================

    function generateOrthogonalPath(sx, sy, tx, ty, allPositions, nodeSize) {
      var dx = tx - sx, dy = ty - sy;
      var absDx = Math.abs(dx), absDy = Math.abs(dy);
      var margin = 30;
      var r = 8;
      var points = [{x: sx, y: sy}];

      if (absDx < 1 && absDy < 1) return 'M ' + sx + ' ' + sy + ' L ' + tx + ' ' + ty;

      var midX = (sx + tx) / 2, midY = (sy + ty) / 2;
      var horizontal = absDx >= absDy;

      if (horizontal) {
        var needsDetour = false;
        if (allPositions && nodeSize) {
          var keys = Object.keys(allPositions);
          for (var ki = 0; ki < keys.length; ki++) {
            var np = allPositions[keys[ki]];
            var ncx = np.x + nodeSize / 2, ncy = np.y + nodeSize / 2;
            var halfW = nodeSize / 2 + margin, halfH = nodeSize / 2 + margin;
            var checkY = sy;
            var minCheckX = Math.min(sx, tx), maxCheckX = Math.max(sx, tx);
            if (checkY > ncy - halfH && checkY < ncy + halfH &&
                ncx > minCheckX + 10 && ncx < maxCheckX - 10) {
              needsDetour = true;
              break;
            }
          }
        }
        if (needsDetour) {
          var detourY = sy + (dy > 0 ? -1 : 1) * (nodeSize + margin);
          points.push({x: sx, y: detourY});
          points.push({x: tx, y: detourY});
        } else {
          points.push({x: midX, y: sy});
          points.push({x: midX, y: ty});
        }
      } else {
        var needsDetour = false;
        if (allPositions && nodeSize) {
          var keys = Object.keys(allPositions);
          for (var ki = 0; ki < keys.length; ki++) {
            var np = allPositions[keys[ki]];
            var ncx = np.x + nodeSize / 2, ncy = np.y + nodeSize / 2;
            var halfW = nodeSize / 2 + margin, halfH = nodeSize / 2 + margin;
            var checkX = sx;
            var minCheckY = Math.min(sy, ty), maxCheckY = Math.max(sy, ty);
            if (checkX > ncx - halfW && checkX < ncx + halfW &&
                ncy > minCheckY + 10 && ncy < maxCheckY - 10) {
              needsDetour = true;
              break;
            }
          }
        }
        if (needsDetour) {
          var detourX = sx + (dx > 0 ? -1 : 1) * (nodeSize + margin);
          points.push({x: detourX, y: sy});
          points.push({x: detourX, y: ty});
        } else {
          points.push({x: sx, y: midY});
          points.push({x: tx, y: midY});
        }
      }
      points.push({x: tx, y: ty});

      var d = 'M ' + points[0].x + ' ' + points[0].y;
      for (var i = 1; i < points.length; i++) {
        var prev = points[i - 1], curr = points[i], next = points[i + 1];
        if (next) {
          var dxIn = curr.x - prev.x, dyIn = curr.y - prev.y;
          var dxOut = next.x - curr.x, dyOut = next.y - curr.y;
          if ((Math.abs(dxIn) > 0.5 || Math.abs(dyIn) > 0.5) &&
              (Math.abs(dxOut) > 0.5 || Math.abs(dyOut) > 0.5) &&
              (Math.abs(dxIn * dyOut - dyIn * dxOut) > 0.1)) {
            var lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
            var lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut);
            var rr = Math.min(r, lenIn / 2, lenOut / 2);
            var bx = curr.x - (dxIn / lenIn) * rr;
            var by = curr.y - (dyIn / lenIn) * rr;
            var ax = curr.x + (dxOut / lenOut) * rr;
            var ay = curr.y + (dyOut / lenOut) * rr;
            d += ' L ' + bx + ' ' + by;
            d += ' Q ' + curr.x + ' ' + curr.y + ' ' + ax + ' ' + ay;
          } else {
            d += ' L ' + curr.x + ' ' + curr.y;
          }
        } else {
          d += ' L ' + curr.x + ' ' + curr.y;
        }
      }
      return d;
    }

    function generateCurvedPath(sx, sy, tx, ty) {
      var dx = tx - sx, dy = ty - sy;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var tension = Math.min(dist * 0.4, 150);
      var absDx = Math.abs(dx), absDy = Math.abs(dy);
      var cp1x, cp1y, cp2x, cp2y;
      if (absDx >= absDy) {
        var dir = dx > 0 ? 1 : -1;
        cp1x = sx + dir * tension;
        cp1y = sy;
        cp2x = tx - dir * tension;
        cp2y = ty;
      } else {
        var dir = dy > 0 ? 1 : -1;
        cp1x = sx;
        cp1y = sy + dir * tension;
        cp2x = tx;
        cp2y = ty - dir * tension;
      }
      return 'M ' + sx + ' ' + sy + ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + tx + ' ' + ty;
    }

    function generateStraightPath(sx, sy, tx, ty, curveOffset) {
      if (Math.abs(curveOffset) < 0.5) {
        return 'M ' + sx + ' ' + sy + ' L ' + tx + ' ' + ty;
      }
      var dx = tx - sx, dy = ty - sy;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var midX = (sx + tx) / 2 + (-dy / dist) * curveOffset;
      var midY = (sy + ty) / 2 + (dx / dist) * curveOffset;
      return 'M ' + sx + ' ' + sy + ' Q ' + midX + ' ' + midY + ' ' + tx + ' ' + ty;
    }

    function generateRoutedPath(sx, sy, tx, ty, curveOffset, allPositions, nodeSize) {
      if (routingMode === 'orthogonal') {
        return generateOrthogonalPath(sx, sy, tx, ty, allPositions, nodeSize);
      } else if (routingMode === 'curved') {
        return generateCurvedPath(sx, sy, tx, ty);
      } else {
        return generateStraightPath(sx, sy, tx, ty, curveOffset);
      }
    }

    function generateClassicPath(sx, sy, tx, ty, co) {
      var dx = tx - sx, dy = ty - sy;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var midX = (sx + tx) / 2 + (-dy / dist) * co;
      var midY = (sy + ty) / 2 + (dx / dist) * co;
      return { d: 'M ' + sx + ' ' + sy + ' Q ' + midX + ' ' + midY + ' ' + tx + ' ' + ty, mx: midX, my: midY };
    }

    function getEdgeMidpoint(sx, sy, tx, ty, curveOffset) {
      if (routingMode === 'orthogonal') {
        var dx = tx - sx, dy = ty - sy;
        var absDx = Math.abs(dx), absDy = Math.abs(dy);
        if (absDx >= absDy) {
          var midX = (sx + tx) / 2;
          return { x: midX, y: sy + (ty - sy) * 0.5 };
        } else {
          var midY = (sy + ty) / 2;
          return { x: sx + (tx - sx) * 0.5, y: midY };
        }
      } else if (routingMode === 'curved') {
        return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
      } else {
        var dx = tx - sx, dy = ty - sy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return {
          x: (sx + tx) / 2 + (-dy / dist) * curveOffset,
          y: (sy + ty) / 2 + (dx / dist) * curveOffset
        };
      }
    }

    // =====================================================================
    // --- Port Distribution ---
    // =====================================================================

    function getSide(fromCx, fromCy, toCx, toCy) {
      var dx = toCx - fromCx, dy = toCy - fromCy;
      if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'bottom' : 'top';
    }

    function buildPortMap(edgeList, positions, nodeSize) {
      var portCounts = {};
      edgeList.forEach(function(e) {
        var fp = positions[e.from], tp = positions[e.to];
        if (!fp || !tp) return;
        var r = nodeSize / 2;
        var fcx = fp.x + r, fcy = fp.y + r, tcx = tp.x + r, tcy = tp.y + r;
        var fromSide = getSide(fcx, fcy, tcx, tcy);
        var toSide = getSide(tcx, tcy, fcx, fcy);
        var fk = e.from + '|' + fromSide;
        var tk = e.to + '|' + toSide;
        if (!portCounts[fk]) portCounts[fk] = [];
        portCounts[fk].push(e.id);
        if (!portCounts[tk]) portCounts[tk] = [];
        portCounts[tk].push(e.id);
      });
      return portCounts;
    }

    function getPortOffset(edgeId, nodeId, side, portMap, nodeSize) {
      var key = nodeId + '|' + side;
      var list = portMap[key];
      if (!list || list.length <= 1) return 0;
      var idx = list.indexOf(edgeId);
      if (idx < 0) idx = 0;
      var count = list.length;
      var spacing = Math.min(16, (nodeSize * 0.6) / count);
      return (idx - (count - 1) / 2) * spacing;
    }

    function getPortPoint(cx, cy, side, offset, nodeRadius) {
      switch (side) {
        case 'right':  return { x: cx + nodeRadius + 5, y: cy + offset };
        case 'left':   return { x: cx - nodeRadius - 5, y: cy + offset };
        case 'bottom': return { x: cx + offset, y: cy + nodeRadius + 5 };
        case 'top':    return { x: cx + offset, y: cy - nodeRadius - 5 };
        default:       return { x: cx, y: cy };
      }
    }

    // =====================================================================
    // --- Grouped ERD View ---
    // =====================================================================
    const GROUP_CLOUD_W = 120;
    const GROUP_CLOUD_H = 120;
    var expandedGroups = new Set();
    var groupNodePositions = {};
    var groupNodeElements = {};
    var groupCenterMarkerElements = {};
    var groupRectBorderElements = {};
    var groupEntityPositions = {};
    var groupEntityElements = {};
    var entityToGroup = {};
    var groupNodesList = [];
    var groupEdgesList = [];
    var isGroupedMode = false;
    var savedGroupState = null;
    const groupContainersLayer = root.querySelector('#groupContainersLayer');

    var GROUP_COLOR_MAP = {
      'Sales Cloud': 'sales', 'Service Cloud': 'service', 'Marketing Cloud': 'marketing',
      'Commerce Cloud': 'commerce', 'Experience Cloud': 'experience', 'Field Service': 'fieldservice',
      'Revenue Cloud': 'revenue', 'Data Cloud': 'datacloud', 'Industry Clouds': 'industry',
      'Platform': 'platform', 'Other': 'other'
    };

    function getGroupColorClass(name) {
      return 'group-color-' + (GROUP_COLOR_MAP[name] || 'other');
    }

    function buildGroupData() {
      if (!groupsData) return;
      groupNodesList = [];
      entityToGroup = {};
      var nodeIdSet = {};
      nodes.forEach(function(n) {
        if (!showUnmapped && n.unmapped) return;
        nodeIdSet[n.id] = true;
      });

      groupsData.groups.forEach(function(g) {
        var validObjects = g.objects.filter(function(o) { return nodeIdSet[o]; });
        if (validObjects.length > 0) {
          groupNodesList.push({ name: g.name, objects: validObjects, count: validObjects.length });
          validObjects.forEach(function(obj) { entityToGroup[obj] = g.name; });
        }
      });

      if (groupsData.ungrouped && groupsData.ungrouped.length > 0) {
        var validUngrouped = groupsData.ungrouped.filter(function(o) { return nodeIdSet[o]; });
        if (validUngrouped.length > 0) {
          groupNodesList.push({ name: 'Other', objects: validUngrouped, count: validUngrouped.length });
          validUngrouped.forEach(function(obj) { entityToGroup[obj] = 'Other'; });
        }
      }

      nodes.forEach(function(n) {
        if (!showUnmapped && n.unmapped) return;
        if (!entityToGroup[n.id]) {
          entityToGroup[n.id] = 'Other';
          var otherGroup = groupNodesList.find(function(g) { return g.name === 'Other'; });
          if (!otherGroup) {
            otherGroup = { name: 'Other', objects: [], count: 0 };
            groupNodesList.push(otherGroup);
          }
          otherGroup.objects.push(n.id);
          otherGroup.count++;
        }
      });

      var edgeMap = {};
      edges.forEach(function(e) {
        var fg = entityToGroup[e.from];
        var tg = entityToGroup[e.to];
        if (fg && tg && fg !== tg) {
          var key = fg < tg ? fg + '|||' + tg : tg + '|||' + fg;
          if (!edgeMap[key]) {
            edgeMap[key] = { groupA: fg < tg ? fg : tg, groupB: fg < tg ? tg : fg, count: 0, entityEdges: [] };
          }
          edgeMap[key].count++;
          edgeMap[key].entityEdges.push(e);
        }
      });
      groupEdgesList = Object.values(edgeMap);
    }

    function layoutGroupForce() {
      var padding = 200;
      var canvasW = Math.max(1200, groupNodesList.length * 300);
      var canvasH = Math.max(800, groupNodesList.length * 250);
      var positions = {};

      var cachedGroupPos = cachedPositionsForModel || {};
      var allCached = true;
      groupNodesList.forEach(function(g) {
        if (!cachedGroupPos['grp_' + g.name]) allCached = false;
      });

      if (allCached && groupNodesList.length > 0) {
        groupNodesList.forEach(function(g) {
          var cp = cachedGroupPos['grp_' + g.name];
          positions[g.name] = { x: cp.x, y: cp.y };
        });
        groupNodePositions = positions;
        snapAllToGrid(groupNodePositions, getGridCellSize('groupCircle'));
        return;
      }

      var degree = {};
      groupNodesList.forEach(function(g) { degree[g.name] = 0; });
      groupEdgesList.forEach(function(e) {
        if (degree[e.groupA] !== undefined) degree[e.groupA]++;
        if (degree[e.groupB] !== undefined) degree[e.groupB]++;
      });

      var velocities = {};
      groupNodesList.forEach(function(g) {
        positions[g.name] = {
          x: padding + Math.random() * (canvasW - 2 * padding),
          y: padding + Math.random() * (canvasH - 2 * padding)
        };
        velocities[g.name] = { x: 0, y: 0 };
      });

      var iterations = 500;
      var repulsion = 15000;
      var springLength = 200;
      var springStiffness = 0.04;
      var gravity = 0.008;

      for (var iter = 0; iter < iterations; iter++) {
        var forces = {};
        groupNodesList.forEach(function(g) { forces[g.name] = { x: 0, y: 0 }; });

        for (var i = 0; i < groupNodesList.length; i++) {
          for (var j = i + 1; j < groupNodesList.length; j++) {
            var a = groupNodesList[i].name, b = groupNodesList[j].name;
            var dx = positions[a].x - positions[b].x;
            var dy = positions[a].y - positions[b].y;
            var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            var force = (repulsion * (1 + degree[a]) * (1 + degree[b])) / (dist * dist);
            var fx = force * dx / dist, fy = force * dy / dist;
            forces[a].x += fx; forces[a].y += fy;
            forces[b].x -= fx; forces[b].y -= fy;
          }
        }

        groupEdgesList.forEach(function(e) {
          var pa = positions[e.groupA], pb = positions[e.groupB];
          if (!pa || !pb) return;
          var dx = pb.x - pa.x, dy = pb.y - pa.y;
          var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          var sf = springStiffness * (dist - springLength);
          var fx = sf * dx / dist, fy = sf * dy / dist;
          forces[e.groupA].x += fx; forces[e.groupA].y += fy;
          forces[e.groupB].x -= fx; forces[e.groupB].y -= fy;
        });

        groupNodesList.forEach(function(g) {
          forces[g.name].x += (canvasW / 2 - positions[g.name].x) * gravity;
          forces[g.name].y += (canvasH / 2 - positions[g.name].y) * gravity;
        });

        groupNodesList.forEach(function(g) {
          velocities[g.name].x = (velocities[g.name].x + forces[g.name].x) * 0.85;
          velocities[g.name].y = (velocities[g.name].y + forces[g.name].y) * 0.85;
          positions[g.name].x += velocities[g.name].x;
          positions[g.name].y += velocities[g.name].y;
        });
      }

      var xs = [], ys = [];
      groupNodesList.forEach(function(g) { xs.push(positions[g.name].x); ys.push(positions[g.name].y); });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      var rX = maxX - minX || 1, rY = maxY - minY || 1;
      groupNodesList.forEach(function(g) {
        var p = positions[g.name];
        positions[g.name] = {
          x: padding + ((p.x - minX) / rX) * (canvasW - 2 * padding - GROUP_CLOUD_W),
          y: padding + ((p.y - minY) / rY) * (canvasH - 2 * padding - GROUP_CLOUD_H)
        };
      });
      groupNodePositions = positions;
      snapAllToGrid(groupNodePositions, getGridCellSize('groupCircle'));
    }

    function getGroupCenter(groupName) {
      var p = groupNodePositions[groupName];
      if (!p) return { x: 0, y: 0 };
      return { x: p.x + GROUP_CLOUD_W / 2, y: p.y + GROUP_CLOUD_H / 2 };
    }

    function collectObstacles(excludeGroupName) {
      var obstacles = [];
      groupNodesList.forEach(function(g) {
        if (g.name === excludeGroupName) return;
        if (expandedGroups.has(g.name)) {
          g.objects.forEach(function(objId) {
            var ep = groupEntityPositions[objId];
            if (ep) obstacles.push({ x: ep.x + NODE_SIZE / 2, y: ep.y + NODE_SIZE / 2, r: NODE_SIZE / 2 + 10 });
          });
        } else {
          var c = getGroupCenter(g.name);
          obstacles.push({ x: c.x, y: c.y, r: Math.max(GROUP_CLOUD_W, GROUP_CLOUD_H) / 2 + 15 });
        }
      });
      return obstacles;
    }

    function layoutEntitiesForceDirected(groupName) {
      var g = groupNodesList.find(function(gg) { return gg.name === groupName; });
      if (!g) return;
      var center = getGroupCenter(groupName);
      var count = g.objects.length;
      if (count === 0) return;

      if (count === 1) {
        groupEntityPositions[g.objects[0]] = { x: center.x - NODE_SIZE / 2, y: center.y - NODE_SIZE / 2 };
        return;
      }

      var groupNodeList = [];
      g.objects.forEach(function(objId) {
        var n = nodes.find(function(nn) { return nn.id === objId; });
        if (n) groupNodeList.push(n);
      });

      var intraEdges = edges.filter(function(e) {
        return entityToGroup[e.from] === groupName && entityToGroup[e.to] === groupName;
      });

      var iterations = 400;
      var repulsion = 4000;
      var springLength = 100;
      var springStiffness = 0.08;
      var gravity = 0.025;
      var pad = 60;
      var canvasW = Math.max(400, count * 100);
      var canvasH = Math.max(300, count * 75);

      var degree = {};
      groupNodeList.forEach(function(n) { degree[n.id] = 0; });
      intraEdges.forEach(function(e) {
        if (degree[e.from] !== undefined) degree[e.from]++;
        if (degree[e.to] !== undefined) degree[e.to]++;
      });

      var positions = {};
      var velocities = {};
      groupNodeList.forEach(function(n) {
        positions[n.id] = {
          x: pad + Math.random() * (canvasW - 2 * pad),
          y: pad + Math.random() * (canvasH - 2 * pad)
        };
        velocities[n.id] = { x: 0, y: 0 };
      });

      for (var iter = 0; iter < iterations; iter++) {
        var forces = {};
        groupNodeList.forEach(function(n) { forces[n.id] = { x: 0, y: 0 }; });

        for (var i = 0; i < groupNodeList.length; i++) {
          for (var j = i + 1; j < groupNodeList.length; j++) {
            var a = groupNodeList[i].id, b = groupNodeList[j].id;
            var dx = positions[a].x - positions[b].x;
            var dy = positions[a].y - positions[b].y;
            var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            var force = (repulsion * (1 + degree[a]) * (1 + degree[b])) / (dist * dist);
            var fx = force * dx / dist, fy = force * dy / dist;
            forces[a].x += fx; forces[a].y += fy;
            forces[b].x -= fx; forces[b].y -= fy;
          }
        }

        intraEdges.forEach(function(e) {
          var pa = positions[e.from], pb = positions[e.to];
          if (!pa || !pb) return;
          var dx = pb.x - pa.x, dy = pb.y - pa.y;
          var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          var sf = springStiffness * (dist - springLength);
          var fx = sf * dx / dist, fy = sf * dy / dist;
          forces[e.from].x += fx; forces[e.from].y += fy;
          forces[e.to].x -= fx; forces[e.to].y -= fy;
        });

        groupNodeList.forEach(function(n) {
          forces[n.id].x += (canvasW / 2 - positions[n.id].x) * gravity;
          forces[n.id].y += (canvasH / 2 - positions[n.id].y) * gravity;
        });

        groupNodeList.forEach(function(n) {
          velocities[n.id].x = (velocities[n.id].x + forces[n.id].x) * 0.85;
          velocities[n.id].y = (velocities[n.id].y + forces[n.id].y) * 0.85;
          positions[n.id].x += velocities[n.id].x;
          positions[n.id].y += velocities[n.id].y;
        });
      }

      var xs = [], ys = [];
      groupNodeList.forEach(function(n) { xs.push(positions[n.id].x); ys.push(positions[n.id].y); });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      var rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;

      var targetW = Math.max(200, count * 65);
      var targetH = Math.max(160, count * 50);

      groupNodeList.forEach(function(n) {
        var raw = positions[n.id];
        var normX = ((raw.x - minX) / rangeX) * targetW;
        var normY = ((raw.y - minY) / rangeY) * targetH;
        groupEntityPositions[n.id] = {
          x: center.x - targetW / 2 + normX - NODE_SIZE / 2,
          y: center.y - targetH / 2 + normY - NODE_SIZE / 2
        };
      });
      var entityIds = groupNodeList.map(function(n) { return n.id; });
      snapAllToGrid(groupEntityPositions, getGridCellSize('groupEntity'), entityIds);
    }

    var NODE_LABEL_H = 60;

    function estimateExpandedSize(count) {
      if (isGridMode && count > 0) {
        var cols = Math.ceil(Math.sqrt(count));
        var rows = Math.ceil(count / cols);
        var w = cols * GRID_CELL.w + NODE_SIZE;
        var h = rows * GRID_CELL.h + NODE_LABEL_H;
        return { w: w, h: h };
      }
      var w = Math.max(200, count * 65) + NODE_SIZE;
      var h = Math.max(160, count * 50) + NODE_SIZE + NODE_LABEL_H;
      return { w: w, h: h };
    }

    function getGroupBoundingBox(groupName) {
      var g = groupNodesList.find(function(gg) { return gg.name === groupName; });
      var center = getGroupCenter(groupName);
      if (!g) return { x: center.x - GROUP_CLOUD_W / 2, y: center.y - GROUP_CLOUD_H / 2, w: GROUP_CLOUD_W, h: GROUP_CLOUD_H };

      if (expandedGroups.has(groupName)) {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        var hasPositions = false;
        g.objects.forEach(function(objId) {
          var ep = groupEntityPositions[objId];
          if (ep) {
            hasPositions = true;
            if (ep.x < minX) minX = ep.x;
            if (ep.y < minY) minY = ep.y;
            if (ep.x + NODE_SIZE > maxX) maxX = ep.x + NODE_SIZE;
            if (ep.y + NODE_SIZE + NODE_LABEL_H > maxY) maxY = ep.y + NODE_SIZE + NODE_LABEL_H;
          }
        });
        if (!hasPositions) {
          var est = estimateExpandedSize(g.objects.length);
          return { x: center.x - est.w / 2, y: center.y - est.h / 2, w: est.w, h: est.h };
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      } else {
        return { x: center.x - GROUP_CLOUD_W / 2, y: center.y - GROUP_CLOUD_H / 2, w: GROUP_CLOUD_W, h: GROUP_CLOUD_H };
      }
    }

    function getGroupBoundingBoxForExpansion(groupName) {
      var g = groupNodesList.find(function(gg) { return gg.name === groupName; });
      var center = getGroupCenter(groupName);
      if (!g) return { x: center.x - GROUP_CLOUD_W / 2, y: center.y - GROUP_CLOUD_H / 2, w: GROUP_CLOUD_W, h: GROUP_CLOUD_H };
      var est = estimateExpandedSize(g.objects.length);
      return { x: center.x - est.w / 2, y: center.y - est.h / 2, w: est.w, h: est.h };
    }

    function rectsOverlap(a, b, pad) {
      return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x ||
               a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
    }

    function getGroupBox(gName, expandingGroupName) {
      if (gName === expandingGroupName || expandedGroups.has(gName)) {
        return getGroupBoundingBoxForExpansion(gName);
      }
      return getGroupBoundingBox(gName);
    }

    function ensureNoOverlap(expandingGroupName) {
      var PAD = Math.max(GRID_CELL.w, GRID_CELL.h);
      var MAX_ITER = 80;

      for (var iter = 0; iter < MAX_ITER; iter++) {
        var anyPush = false;
        for (var i = 0; i < groupNodesList.length; i++) {
          for (var j = i + 1; j < groupNodesList.length; j++) {
            var gA = groupNodesList[i].name;
            var gB = groupNodesList[j].name;
            var boxA = getGroupBox(gA, expandingGroupName);
            var boxB = getGroupBox(gB, expandingGroupName);

            if (!rectsOverlap(boxA, boxB, PAD)) continue;
            anyPush = true;

            var cAx = boxA.x + boxA.w / 2, cAy = boxA.y + boxA.h / 2;
            var cBx = boxB.x + boxB.w / 2, cBy = boxB.y + boxB.h / 2;
            var dx = cBx - cAx, dy = cBy - cAy;

            var overlapX = (boxA.w / 2 + boxB.w / 2 + PAD) - Math.abs(dx);
            var overlapY = (boxA.h / 2 + boxB.h / 2 + PAD) - Math.abs(dy);
            if (overlapX <= 0 && overlapY <= 0) continue;

            var pA = groupNodePositions[gA];
            var pB = groupNodePositions[gB];
            if (overlapX > 0 && (overlapX <= overlapY || overlapY <= 0)) {
              var signX = dx >= 0 ? 1 : -1;
              var halfPush = (overlapX / 2) + 1;
              if (pA) pA.x -= signX * halfPush;
              if (pB) pB.x += signX * halfPush;
            } else if (overlapY > 0) {
              var signY = dy >= 0 ? 1 : -1;
              var halfPush = (overlapY / 2) + 1;
              if (pA) pA.y -= signY * halfPush;
              if (pB) pB.y += signY * halfPush;
            }
          }
        }
        if (!anyPush) break;
      }
    }

    var GROUP_RECT_PAD = 15;

    function positionGroupRect(gName) {
      var box = getGroupBoundingBox(gName);
      var bEl = groupRectBorderElements[gName];
      if (bEl) {
        bEl.style.left = (box.x - GROUP_RECT_PAD) + 'px';
        bEl.style.top = (box.y - GROUP_RECT_PAD) + 'px';
        bEl.style.width = (box.w + GROUP_RECT_PAD * 2) + 'px';
        bEl.style.height = (box.h + GROUP_RECT_PAD * 2) + 'px';
      }
      var lEl = groupCenterMarkerElements[gName];
      if (lEl) {
        lEl.style.left = (box.x - GROUP_RECT_PAD + 16) + 'px';
        lEl.style.top = (box.y - GROUP_RECT_PAD) + 'px';
      }
    }

    function repositionGroupElements() {
      groupNodesList.forEach(function(g) {
        if (expandedGroups.has(g.name)) {
          var pos = groupNodePositions[g.name];
          if (pos) {
            var gEl = groupNodeElements[g.name];
            if (gEl) { gEl.style.left = pos.x + 'px'; gEl.style.top = pos.y + 'px'; }
          }
          g.objects.forEach(function(objId) {
            var ep = groupEntityPositions[objId];
            var eEl = groupEntityElements[objId];
            if (ep && eEl) { eEl.style.left = ep.x + 'px'; eEl.style.top = ep.y + 'px'; }
          });
          positionGroupRect(g.name);
        } else {
          var pos = groupNodePositions[g.name];
          var gEl = groupNodeElements[g.name];
          if (pos && gEl) { gEl.style.left = pos.x + 'px'; gEl.style.top = pos.y + 'px'; }
        }
      });
    }

    var REPOSITION_ANIM_MS = 500;

    function animateRepositionGroupElements(skipGroupName, callback) {
      var startPositions = {};
      var targetPositions = {};
      var startEntityPositions = {};
      var hasMovement = false;

      groupNodesList.forEach(function(g) {
        if (g.name === skipGroupName) return;
        var targetPos = groupNodePositions[g.name];
        if (!targetPos) return;
        var el = groupNodeElements[g.name];
        var curDataX, curDataY;
        if (el) {
          curDataX = parseFloat(el.style.left) || 0;
          curDataY = parseFloat(el.style.top) || 0;
        } else {
          var oldPos = groupNodePositions[g.name];
          if (!oldPos) return;
          curDataX = oldPos.x;
          curDataY = oldPos.y;
        }
        if (Math.abs(curDataX - targetPos.x) > 2 || Math.abs(curDataY - targetPos.y) > 2) {
          startPositions[g.name] = { x: curDataX, y: curDataY };
          targetPositions[g.name] = { x: targetPos.x, y: targetPos.y };
          hasMovement = true;
          if (expandedGroups.has(g.name)) {
            var snap = {};
            g.objects.forEach(function(objId) {
              var ep = groupEntityPositions[objId];
              if (ep) snap[objId] = { x: ep.x, y: ep.y };
            });
            startEntityPositions[g.name] = snap;
          }
        }
      });

      if (!hasMovement) {
        repositionGroupElements();
        if (callback) callback();
        return;
      }

      var animStart = performance.now();
      var rafId;

      function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      }

      function tick(now) {
        var elapsed = now - animStart;
        var progress = Math.min(1, elapsed / REPOSITION_ANIM_MS);
        var eased = easeInOut(progress);

        Object.keys(startPositions).forEach(function(gName) {
          var sp = startPositions[gName];
          var tp = targetPositions[gName];
          var curX = sp.x + (tp.x - sp.x) * eased;
          var curY = sp.y + (tp.y - sp.y) * eased;

          groupNodePositions[gName] = { x: curX, y: curY };

          if (expandedGroups.has(gName) && startEntityPositions[gName]) {
            var deltaX = curX - sp.x;
            var deltaY = curY - sp.y;
            var gg = groupNodesList.find(function(g) { return g.name === gName; });
            if (gg) {
              gg.objects.forEach(function(objId) {
                var origEp = startEntityPositions[gName][objId];
                if (!origEp) return;
                var newEp = { x: origEp.x + deltaX, y: origEp.y + deltaY };
                groupEntityPositions[objId] = newEp;
                var eEl = groupEntityElements[objId];
                if (eEl) { eEl.style.left = newEp.x + 'px'; eEl.style.top = newEp.y + 'px'; }
              });
            }
            positionGroupRect(gName);
          } else {
            var gEl = groupNodeElements[gName];
            if (gEl) { gEl.style.left = curX + 'px'; gEl.style.top = curY + 'px'; }
          }
        });

        redrawGroupEdges();

        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          Object.keys(targetPositions).forEach(function(gName) {
            groupNodePositions[gName] = { x: targetPositions[gName].x, y: targetPositions[gName].y };
          });
          repositionGroupElements();
          redrawGroupEdges();
          if (callback) callback();
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    function renderGroupedView() {
      if (!groupsData) return;
      currentView = 'grouped';
      isGroupedMode = true;
      nodesLayer.innerHTML = '';
      groupContainersLayer.innerHTML = '';
      svg.innerHTML = '';
      nodeElements = {};
      groupNodeElements = {};
      groupCenterMarkerElements = {};
      groupRectBorderElements = {};
      groupEntityElements = {};
      groupEntityPositions = {};
      root.querySelector('#backBtn').style.display = 'none';
      root.querySelector('#headerTitle').textContent = modelLabel + ' - Grouped ERD';
      root.querySelector('#topStats').style.display = 'flex';

      buildGroupData();
      layoutGroupForce();

      groupNodesList.forEach(function(g) {
        if (expandedGroups.has(g.name)) {
          layoutEntitiesForceDirected(g.name);
        }
      });
      if (expandedGroups.size > 0) {
        ensureNoOverlap(null);
        groupNodesList.forEach(function(g) {
          if (expandedGroups.has(g.name)) layoutEntitiesForceDirected(g.name);
        });
      }
      groupNodesList.forEach(function(g) {
        if (expandedGroups.has(g.name)) {
          createGroupRect(g);
          g.objects.forEach(function(objId, idx) {
            var n = nodes.find(function(nn) { return nn.id === objId; });
            if (!n) return;
            var ePos = groupEntityPositions[objId];
            if (!ePos) return;
            var div = createEntityNode(n, g.name);
            div.style.left = ePos.x + 'px';
            div.style.top = ePos.y + 'px';
            setTimeout(function() { div.classList.add('group-entity-visible'); }, 30 + idx * 25);
          });
        } else {
          createGroupCircle(g);
        }
      });

      redrawGroupEdges();
      fitGroupedViewport();
      updateGroupButtons();
    }

    // =====================================================================
    // --- List-Grouped ERD View ---
    // =====================================================================

    var listGroupNodePositions = {};
    var listGroupNodeElements = {};
    var listGroupTotalH = 0;
    var listHoverActive = false;

    function renderListGroupedView() {
      if (!groupsData) return;
      currentView = 'listGrouped';
      nodesLayer.innerHTML = '';
      groupContainersLayer.innerHTML = '';
      svg.innerHTML = '';
      listGroupNodePositions = {};
      listGroupNodeElements = {};
      nodeElements = {};
      root.querySelector('#backBtn').style.display = 'none';
      root.querySelector('#headerTitle').textContent = modelLabel + ' - List Grouped ERD';
      root.querySelector('#topStats').style.display = 'flex';
      var gc = root.querySelector('#groupControls');
      if (gc) gc.classList.remove('visible');

      buildGroupData();

      var COLS = 10;
      var CELL_W = 180;
      var CELL_H = 190;
      var HEADER_H = 40;
      var GROUP_GAP = 50;
      var LEFT_PAD = 40;
      var curY = 40;

      groupNodesList.forEach(function(g) {
        var header = document.createElement('div');
        header.className = 'list-group-header';
        header.innerHTML = g.name + ' <span class="lg-count">' + g.count + '</span>';
        var rows = Math.ceil(g.objects.length / COLS);
        var headerW = Math.max(400, Math.min(COLS, g.objects.length) * CELL_W);
        header.style.left = LEFT_PAD + 'px';
        header.style.top = curY + 'px';
        header.style.width = headerW + 'px';
        groupContainersLayer.appendChild(header);

        curY += HEADER_H;

        g.objects.forEach(function(objId, idx) {
          var n = nodes.find(function(nn) { return nn.id === objId; });
          if (!n) return;
          var col = idx % COLS;
          var row = Math.floor(idx / COLS);
          var nx = LEFT_PAD + col * CELL_W;
          var ny = curY + row * CELL_H;

          listGroupNodePositions[n.id] = { x: nx, y: ny };

          var div = document.createElement('div');
          div.className = 'node ' + getNodeClass(n) + (n.unmapped ? ' node-unmapped' : '');
          div.id = 'lgn-' + n.id;
          div.setAttribute('data-node-id', n.id);
          var iconSvg = getNodeIcon(n);
          var isShared = n.tableType === 'Shared';
          var isBase = !!n.baseModelApiName;
          var needsWrap = isShared || isBase;
          var sharedBadge = isShared ? '<div class="shared-badge">' + sharedSvg + '</div>' : '';
          var baseBadge = isBase ? '<div class="base-model-badge">BASE</div>' : '';
          var circleHtml = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
          div.innerHTML = (needsWrap ? '<div class="node-circle-wrap">' + circleHtml + sharedBadge + baseBadge + '</div>' : circleHtml) +
            '<div class="node-label"><div class="node-title">' + n.label + '</div></div>';

          div.style.left = nx + 'px';
          div.style.top = ny + 'px';

          div.addEventListener('click', function(e) {
            e.stopPropagation();
            openSidebar(n);
          });
          div.addEventListener('mouseenter', function() { listGroupHoverIn(n.id); });
          div.addEventListener('mouseleave', function() { listGroupHoverOut(); });

          nodesLayer.appendChild(div);
          listGroupNodeElements[n.id] = div;
        });

        curY += rows * CELL_H + GROUP_GAP;
      });

      listGroupTotalH = curY;
      fitListGroupedViewport(curY);
    }

    function fitListGroupedViewport(totalH) {
      var allPos = Object.values(listGroupNodePositions);
      if (allPos.length === 0) return;
      var xs = allPos.map(function(p) { return p.x; });
      var ys = allPos.map(function(p) { return p.y; });
      var minX = Math.min.apply(null, xs) - 60;
      var maxX = Math.max.apply(null, xs) + 180;
      var minY = 0;
      var maxY = totalH + 60;
      var w = maxX - minX, h = maxY - minY;
      var lpw = getLeftPanelWidth();
      var availW = getAvailableWidth();
      var availH = erdContainer.clientHeight;
      var sw = availW / w, sh = availH / h;
      scale = Math.min(sw, sh, 1);
      panX = lpw + (availW - w * scale) / 2 - minX * scale;
      panY = (availH - h * scale) / 2 - minY * scale;
      updateView();
    }

    function listGroupHoverIn(nodeId) {
      if (listHoverActive) listGroupHoverOut();
      listHoverActive = true;

      var connectedIds = new Set();
      connectedIds.add(nodeId);
      var relEdges = [];
      edges.forEach(function(e) {
        if (e.from === nodeId || e.to === nodeId) {
          connectedIds.add(e.from);
          connectedIds.add(e.to);
          relEdges.push(e);
        }
      });

      Object.keys(listGroupNodeElements).forEach(function(id) {
        var el = listGroupNodeElements[id];
        if (connectedIds.has(id)) {
          el.classList.add('list-hover-related');
          el.classList.remove('list-hover-dimmed');
        } else {
          el.classList.add('list-hover-dimmed');
          el.classList.remove('list-hover-related');
        }
      });

      svg.innerHTML = '';
      if (relEdges.length === 0) return;
      var arrowColors = { default: '#0070d2' };
      createArrowMarkers(svg, arrowColors, 'lghover-');

      var portMap = isClassicMode() ? null : buildPortMap(relEdges, listGroupNodePositions, NODE_SIZE);

      relEdges.forEach(function(edge, idx) {
        var fp = listGroupNodePositions[edge.from];
        var tp = listGroupNodePositions[edge.to];
        if (!fp || !tp) return;
        var r = NODE_SIZE / 2;
        var d;

        if (isClassicMode()) {
          var fcx = fp.x + r, fcy = fp.y + r;
          var tcx = tp.x + r, tcy = tp.y + r;
          var angle = Math.atan2(tcy - fcy, tcx - fcx);
          var fex = fcx + Math.cos(angle) * (r + 5);
          var fey = fcy + Math.sin(angle) * (r + 5);
          var tex = tcx - Math.cos(angle) * (r + 10);
          var tey = tcy - Math.sin(angle) * (r + 10);
          var co = 20 * (idx % 2 === 0 ? 1 : -1);
          var cp = generateClassicPath(fex, fey, tex, tey, co);
          d = cp.d;
        } else {
          var fcx2 = fp.x + r, fcy2 = fp.y + r;
          var tcx2 = tp.x + r, tcy2 = tp.y + r;
          var fSide = getSide(fcx2, fcy2, tcx2, tcy2);
          var tSide = getSide(tcx2, tcy2, fcx2, fcy2);
          var edgeId = edge.from + '>' + edge.to;
          var fOff = getPortOffset(edgeId, edge.from, fSide, portMap, NODE_SIZE);
          var tOff = getPortOffset(edgeId, edge.to, tSide, portMap, NODE_SIZE);
          var fPt = getPortPoint(fcx2, fcy2, fSide, fOff, r + 2);
          var tPt = getPortPoint(tcx2, tcy2, tSide, tOff, r + 8);
          var co2 = 20 * (idx % 2 === 0 ? 1 : -1);
          d = generateRoutedPath(fPt.x, fPt.y, tPt.x, tPt.y, co2, listGroupNodePositions, NODE_SIZE);
        }

        var glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        glow.setAttribute('d', d);
        glow.setAttribute('stroke', '#0070d2');
        glow.setAttribute('stroke-width', edgeGlowWidth());
        glow.setAttribute('fill', 'none');
        glow.setAttribute('opacity', edgeGlowOpacity());
        glow.setAttribute('stroke-linecap', 'round');
        svg.appendChild(glow);

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#0070d2');
        path.setAttribute('stroke-width', edgeStroke());
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#lghover-default)');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
      });
    }

    function listGroupHoverOut() {
      if (!listHoverActive) return;
      listHoverActive = false;
      svg.innerHTML = '';
      Object.keys(listGroupNodeElements).forEach(function(id) {
        var el = listGroupNodeElements[id];
        el.classList.remove('list-hover-dimmed', 'list-hover-related');
      });
    }

    // =====================================================================
    // --- End List-Grouped ERD View ---
    // =====================================================================

    function createGroupCircle(g) {
      var pos = groupNodePositions[g.name];
      if (!pos) return;
      var colorClass = getGroupColorClass(g.name);
      var div = document.createElement('div');
      div.className = 'group-circle ' + colorClass;
      div.id = 'grp-' + g.name.replace(/\\s+/g, '_');
      div.innerHTML = '<div class="group-circle-inner">' +
        '<div class="group-circle-name">' + g.name + '</div>' +
        '<div class="group-circle-count">' + g.count + ' entities</div>' +
        '</div>';
      div.style.left = pos.x + 'px';
      div.style.top = pos.y + 'px';

      var clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
      div.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        clickStartTime = Date.now();
        clickStartPos = { x: e.clientX, y: e.clientY };
        draggingNode = 'grp_' + g.name;
        var rect = div.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
      });
      div.addEventListener('mouseup', function(e) {
        var dur = Date.now() - clickStartTime;
        var dist = Math.sqrt(Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2));
        if (dur < 300 && dist < 10) { /* single click */ }
      });
      div.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        e.preventDefault();
        expandGroup(g.name);
      });

      nodesLayer.appendChild(div);
      groupNodeElements[g.name] = div;
    }

    function createGroupRect(g) {
      var colorClass = getGroupColorClass(g.name);
      var box = getGroupBoundingBox(g.name);

      var border = document.createElement('div');
      border.className = 'group-rect-border ' + colorClass;
      border.id = 'grp-rect-' + g.name.replace(/\\s+/g, '_');
      border.style.left = (box.x - GROUP_RECT_PAD) + 'px';
      border.style.top = (box.y - GROUP_RECT_PAD) + 'px';
      border.style.width = (box.w + GROUP_RECT_PAD * 2) + 'px';
      border.style.height = (box.h + GROUP_RECT_PAD * 2) + 'px';
      nodesLayer.appendChild(border);
      groupRectBorderElements[g.name] = border;

      var label = document.createElement('div');
      label.className = 'group-rect-label ' + colorClass;
      label.id = 'grp-label-' + g.name.replace(/\\s+/g, '_');
      label.innerHTML = g.name + '<span class="rect-label-count">' + g.count + '</span>';
      label.style.left = (box.x - GROUP_RECT_PAD + 16) + 'px';
      label.style.top = (box.y - GROUP_RECT_PAD) + 'px';

      var clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
      label.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        clickStartTime = Date.now();
        clickStartPos = { x: e.clientX, y: e.clientY };
        draggingNode = 'grp_' + g.name;
        var gp = groupNodePositions[g.name];
        if (gp) {
          var cRectMd = erdContainer.getBoundingClientRect();
          var cursorCanvasX = (e.clientX - cRectMd.left - panX) / scale;
          var cursorCanvasY = (e.clientY - cRectMd.top - panY) / scale;
          dragOffsetX = cursorCanvasX - gp.x;
          dragOffsetY = cursorCanvasY - gp.y;
        } else {
          dragOffsetX = 0;
          dragOffsetY = 0;
        }
      });
      label.addEventListener('mouseup', function(e) {
        var dur = Date.now() - clickStartTime;
        var dist = Math.sqrt(Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2));
        if (dur < 300 && dist < 10) { /* single click */ }
      });
      label.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        e.preventDefault();
        collapseGroup(g.name);
      });

      nodesLayer.appendChild(label);
      groupCenterMarkerElements[g.name] = label;
    }

    function createEntityNode(n, groupName) {
      var div = document.createElement('div');
      div.className = 'node ' + getNodeClass(n) + ' group-entity-appear' + (n.unmapped ? ' node-unmapped' : '');
      div.id = 'grpent-' + n.id;
      var iconSvg = getNodeIcon(n);
      var isShared = n.tableType === 'Shared';
      var isBase = !!n.baseModelApiName;
      var needsWrap = isShared || isBase;
      var sharedBadge = isShared ? '<div class="shared-badge">' + sharedSvg + '</div>' : '';
      var baseBadge = isBase ? '<div class="base-model-badge">BASE</div>' : '';
      var circleHtml = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
      div.innerHTML = (needsWrap ? '<div class="node-circle-wrap">' + circleHtml + sharedBadge + baseBadge + '</div>' : circleHtml) +
        '<div class="node-label"><div class="node-title">' + n.label + '</div></div>';

      var clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
      div.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        clickStartTime = Date.now();
        clickStartPos = { x: e.clientX, y: e.clientY };
        draggingNode = 'gent_' + n.id;
        var rect = div.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
      });
      div.addEventListener('mouseup', function(e) {
        var dur = Date.now() - clickStartTime;
        var dist = Math.sqrt(Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2));
        if (dur < 300 && dist < 10) { openSidebar(n); }
      });
      div.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        e.preventDefault();
        savedGroupState = { expanded: new Set(expandedGroups), panX: panX, panY: panY, scale: scale };
        enterDrillDown(n);
      });

      nodesLayer.appendChild(div);
      groupEntityElements[n.id] = div;
      return div;
    }

    function expandGroup(groupName) {
      if (isTransitioning) return;
      isTransitioning = true;
      expandedGroups.add(groupName);

      ensureNoOverlap(groupName);

      animateRepositionGroupElements(groupName, function() {
        doExpandGroup(groupName);
      });
    }

    function doExpandGroup(groupName) {
      var circle = groupNodeElements[groupName];
      if (circle) {
        circle.querySelector('.group-circle-inner').classList.add('group-circle-shrink');
      }

      var g = groupNodesList.find(function(gg) { return gg.name === groupName; });
      if (!g) { isTransitioning = false; return; }

      layoutEntitiesForceDirected(groupName);
      createGroupRect(g);

      var center = getGroupCenter(groupName);

      g.objects.forEach(function(objId, idx) {
        var n = nodes.find(function(nn) { return nn.id === objId; });
        if (!n) return;
        var finalPos = groupEntityPositions[objId];
        if (!finalPos) return;

        var div = createEntityNode(n, groupName);
        div.style.left = (center.x - NODE_SIZE / 2) + 'px';
        div.style.top = (center.y - NODE_SIZE / 2) + 'px';

        setTimeout(function() {
          div.style.left = finalPos.x + 'px';
          div.style.top = finalPos.y + 'px';
          div.classList.add('group-entity-visible');
        }, 50 + idx * 35);
      });

      setTimeout(function() {
        if (circle) { circle.remove(); delete groupNodeElements[groupName]; }
        redrawGroupEdges();
        updateGroupButtons();
        animateFitGroupedViewport();
        isTransitioning = false;
      }, 100 + g.count * 35 + 350);
    }

    function collapseGroup(groupName) {
      if (isTransitioning) return;
      isTransitioning = true;
      expandedGroups.delete(groupName);

      var center = getGroupCenter(groupName);
      var g = groupNodesList.find(function(gg) { return gg.name === groupName; });
      if (!g) { isTransitioning = false; return; }

      g.objects.forEach(function(objId) {
        var el = groupEntityElements[objId];
        if (el) {
          el.style.left = (center.x - NODE_SIZE / 2) + 'px';
          el.style.top = (center.y - NODE_SIZE / 2) + 'px';
          el.classList.add('group-entity-collapse');
        }
      });

      var marker = groupCenterMarkerElements[groupName];
      var rectBorder = groupRectBorderElements[groupName];

      setTimeout(function() {
        g.objects.forEach(function(objId) {
          var el = groupEntityElements[objId];
          if (el) { el.remove(); delete groupEntityElements[objId]; }
          delete groupEntityPositions[objId];
        });
        if (marker) { marker.remove(); delete groupCenterMarkerElements[groupName]; }
        if (rectBorder) { rectBorder.remove(); delete groupRectBorderElements[groupName]; }

        createGroupCircle(g);
        ensureNoOverlap(null);
        snapAllToGrid(groupNodePositions, getGridCellSize());
        groupNodesList.forEach(function(gg) {
          var pos = groupNodePositions[gg.name];
          var gEl = groupNodeElements[gg.name];
          if (pos && gEl) { gEl.style.left = pos.x + 'px'; gEl.style.top = pos.y + 'px'; }
        });
        redrawGroupEdges();
        updateGroupButtons();
        animateFitGroupedViewport();
        isTransitioning = false;
      }, 350);
    }

    function expandAllGroups() {
      if (isTransitioning) return;
      isTransitioning = true;
      var toExpand = groupNodesList.filter(function(g) { return !expandedGroups.has(g.name); });
      if (toExpand.length === 0) { isTransitioning = false; return; }

      toExpand.forEach(function(g) { expandedGroups.add(g.name); });

      ensureNoOverlap(null);

      animateRepositionGroupElements(null, function() {
        toExpand.forEach(function(g) {
          var circle = groupNodeElements[g.name];
          if (circle) { circle.remove(); delete groupNodeElements[g.name]; }
        });

        groupNodesList.forEach(function(g) {
          if (expandedGroups.has(g.name)) layoutEntitiesForceDirected(g.name);
        });

        toExpand.forEach(function(g) {
          createGroupRect(g);
          g.objects.forEach(function(objId, idx) {
            var n = nodes.find(function(nn) { return nn.id === objId; });
            if (!n) return;
            var ePos = groupEntityPositions[objId];
            if (!ePos) return;
            var div = createEntityNode(n, g.name);
            div.style.left = ePos.x + 'px';
            div.style.top = ePos.y + 'px';
            setTimeout(function() { div.classList.add('group-entity-visible'); }, 30 + idx * 25);
          });
        });
        redrawGroupEdges();
        updateGroupButtons();
        animateFitGroupedViewport();
        isTransitioning = false;
      });
    }

    function collapseAllGroups() {
      if (isTransitioning) return;
      var expanded = Array.from(expandedGroups);
      if (expanded.length === 0) return;

      expanded.forEach(function(name) {
        expandedGroups.delete(name);
        var g = groupNodesList.find(function(gg) { return gg.name === name; });
        if (!g) return;
        var center = getGroupCenter(name);
        g.objects.forEach(function(objId) {
          var el = groupEntityElements[objId];
          if (el) {
            el.style.left = (center.x - NODE_SIZE / 2) + 'px';
            el.style.top = (center.y - NODE_SIZE / 2) + 'px';
            el.classList.add('group-entity-collapse');
          }
        });
      });

      setTimeout(function() {
        expanded.forEach(function(name) {
          var g = groupNodesList.find(function(gg) { return gg.name === name; });
          if (!g) return;
          g.objects.forEach(function(objId) {
            var el = groupEntityElements[objId];
            if (el) { el.remove(); delete groupEntityElements[objId]; }
            delete groupEntityPositions[objId];
          });
          var marker = groupCenterMarkerElements[name];
          if (marker) { marker.remove(); delete groupCenterMarkerElements[name]; }
          var rectBorder = groupRectBorderElements[name];
          if (rectBorder) { rectBorder.remove(); delete groupRectBorderElements[name]; }
        });

        var cx = 0, cy = 0, cnt = 0;
        groupNodesList.forEach(function(g) {
          var p = groupNodePositions[g.name];
          if (p) { cx += p.x; cy += p.y; cnt++; }
        });
        if (cnt > 0) { cx /= cnt; cy /= cnt; }
        groupNodesList.forEach(function(g) {
          var p = groupNodePositions[g.name];
          if (p) {
            p.x = cx + (p.x - cx) * 0.25;
            p.y = cy + (p.y - cy) * 0.25;
          }
        });
        ensureNoOverlap(null);
        snapAllToGrid(groupNodePositions, getGridCellSize());

        groupNodesList.forEach(function(g) {
          createGroupCircle(g);
        });
        redrawGroupEdges();
        updateGroupButtons();
        fitGroupedViewport();
      }, 350);
    }

    function updateGroupButtons() {
      var expandBtn = root.querySelector('#expandAllBtn');
      var collapseBtn = root.querySelector('#collapseAllBtn');
      if (expandBtn) expandBtn.disabled = expandedGroups.size === groupNodesList.length;
      if (collapseBtn) collapseBtn.disabled = expandedGroups.size === 0;
    }

    function redrawGroupEdges() {
      svg.innerHTML = '';
      var colors = { default: '#939393', group: '#0070d2' };
      createArrowMarkers(svg, colors, 'grp-arrow-');

      root.querySelectorAll('.group-edge-badge').forEach(function(el) { el.remove(); });

      var aggregated = {};
      var drawnEntityEdges = [];

      edges.forEach(function(e) {
        var fg = entityToGroup[e.from];
        var tg = entityToGroup[e.to];
        if (!fg || !tg) return;
        if (fg === tg) {
          if (expandedGroups.has(fg)) {
            drawnEntityEdges.push(e);
          }
          return;
        }
        var key = fg < tg ? fg + '|||' + tg : tg + '|||' + fg;
        if (!aggregated[key]) aggregated[key] = { groupA: fg < tg ? fg : tg, groupB: fg < tg ? tg : fg, count: 0 };
        aggregated[key].count++;
      });

      Object.values(aggregated).forEach(function(ae) {
        drawAggregatedGroupEdge(ae.groupA, ae.groupB, ae.count);
      });

      drawnEntityEdges.forEach(function(e, idx) {
        drawEntityEdgeInGroup(e, idx, drawnEntityEdges);
      });
    }

    function nearestPointOnRect(rect, px, py) {
      var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      var dx = px - cx, dy = py - cy;
      var hw = rect.w / 2, hh = rect.h / 2;
      if (dx === 0 && dy === 0) return { x: cx + hw, y: cy };
      var sx = hw / (Math.abs(dx) || 1), sy = hh / (Math.abs(dy) || 1);
      var s = Math.min(sx, sy);
      return { x: cx + dx * s, y: cy + dy * s };
    }

    function drawAggregatedGroupEdge(groupA, groupB, count) {
      var fromC = getGroupCenter(groupA);
      var toC = getGroupCenter(groupB);

      var boxA = getGroupBoundingBox(groupA);
      var boxB = getGroupBoundingBox(groupB);
      var p1 = nearestPointOnRect(boxA, toC.x, toC.y);
      var p2 = nearestPointOnRect(boxB, fromC.x, fromC.y);
      var x1 = p1.x, y1 = p1.y;
      var x2 = p2.x, y2 = p2.y;

      var d = isClassicMode()
        ? 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2
        : generateRoutedPath(x1, y1, x2, y2, 0, null, null);
      var glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', '#0070d2'); glow.setAttribute('stroke-width', edgeGlowWidth());
      glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', '0.12');
      glow.setAttribute('stroke-linecap', 'round');
      svg.appendChild(glow);

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#0070d2'); path.setAttribute('stroke-width', edgeGroupStroke());
      path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#grp-arrow-group)');
      path.setAttribute('stroke-linecap', 'round'); path.setAttribute('opacity', '0.6');
      svg.appendChild(path);

      var badge = document.createElement('div');
      badge.className = 'group-edge-badge';
      badge.textContent = String(count);
      badge.style.left = ((x1 + x2) / 2 - 14) + 'px';
      badge.style.top = ((y1 + y2) / 2 - 12) + 'px';
      nodesLayer.appendChild(badge);
    }

    function drawEntityToGroupEdge(entityId, groupName, edge) {
      var ep = groupEntityPositions[entityId];
      if (!ep) return;
      var gc = getGroupCenter(groupName);
      var x1 = ep.x + NODE_SIZE / 2, y1 = ep.y + NODE_SIZE / 2;
      var dx = gc.x - x1, dy = gc.y - y1;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var toR = GROUP_CLOUD_W / 2 + 15;
      var x2 = gc.x - (dx / dist) * toR, y2 = gc.y - (dy / dist) * toR;

      var d = isClassicMode()
        ? 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2
        : generateRoutedPath(x1, y1, x2, y2, 0, groupEntityPositions, NODE_SIZE);
      var glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', '#939393'); glow.setAttribute('stroke-width', edgeGlowWidth());
      glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', '0.1');
      glow.setAttribute('stroke-linecap', 'round');
      svg.appendChild(glow);

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#939393'); path.setAttribute('stroke-width', isClassicMode() ? '2' : '1.5');
      path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#grp-arrow-default)');
      path.setAttribute('stroke-linecap', 'round'); path.setAttribute('opacity', '0.5');
      svg.appendChild(path);
    }

    function drawGroupToEntityEdge(groupName, entityId, edge) {
      var gc = getGroupCenter(groupName);
      var ep = groupEntityPositions[entityId];
      if (!ep) return;
      var x2 = ep.x + NODE_SIZE / 2, y2 = ep.y + NODE_SIZE / 2;
      var dx = x2 - gc.x, dy = y2 - gc.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var fromR = GROUP_CLOUD_W / 2 + 5;
      var x1 = gc.x + (dx / dist) * fromR, y1 = gc.y + (dy / dist) * fromR;

      var d = isClassicMode()
        ? 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2
        : generateRoutedPath(x1, y1, x2, y2, 0, groupEntityPositions, NODE_SIZE);
      var glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', '#939393'); glow.setAttribute('stroke-width', edgeGlowWidth());
      glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', '0.1');
      glow.setAttribute('stroke-linecap', 'round');
      svg.appendChild(glow);

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#939393'); path.setAttribute('stroke-width', isClassicMode() ? '2' : '1.5');
      path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#grp-arrow-default)');
      path.setAttribute('stroke-linecap', 'round'); path.setAttribute('opacity', '0.5');
      svg.appendChild(path);
    }

    function drawEntityEdgeInGroup(edge, idx, allEdges) {
      var fp = groupEntityPositions[edge.from];
      var tp = groupEntityPositions[edge.to];
      if (!fp || !tp) return;
      var r = NODE_SIZE / 2;
      var fcx = fp.x + r, fcy = fp.y + r;
      var tcx = tp.x + r, tcy = tp.y + r;

      var d;
      if (isClassicMode()) {
        var angle = Math.atan2(tcy - fcy, tcx - fcx);
        var fex = fcx + Math.cos(angle) * (r + 5), fey = fcy + Math.sin(angle) * (r + 5);
        var tex = tcx - Math.cos(angle) * (r + 15), tey = tcy - Math.sin(angle) * (r + 15);
        var co = 25 * (idx % 2 === 0 ? 1 : -1);
        d = generateClassicPath(fex, fey, tex, tey, co).d;
      } else {
        var fromSide = getSide(fcx, fcy, tcx, tcy);
        var toSide = getSide(tcx, tcy, fcx, fcy);
        var sp = getPortPoint(fcx, fcy, fromSide, 0, r);
        var tp2 = getPortPoint(tcx, tcy, toSide, 0, r);
        var curveOffset = 0;
        if (routingMode === 'straight') {
          curveOffset = 20 * (idx % 2 === 0 ? 1 : -1);
        }
        d = generateRoutedPath(sp.x, sp.y, tp2.x, tp2.y, curveOffset, groupEntityPositions, NODE_SIZE);
      }

      var glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', '#939393'); glow.setAttribute('stroke-width', edgeGlowWidth());
      glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', '0.1');
      glow.setAttribute('stroke-linecap', 'round');
      svg.appendChild(glow);

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#939393'); path.setAttribute('stroke-width', isClassicMode() ? '2' : '1.5');
      path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#grp-arrow-default)');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    }

    function computeGroupedFit() {
      var allPos = [];
      groupNodesList.forEach(function(g) {
        var p = groupNodePositions[g.name];
        if (!p) return;
        if (!expandedGroups.has(g.name)) {
          allPos.push({ x: p.x, y: p.y });
          allPos.push({ x: p.x + GROUP_CLOUD_W, y: p.y + GROUP_CLOUD_H + 30 });
        }
      });
      Object.values(groupEntityPositions).forEach(function(p) {
        allPos.push({ x: p.x, y: p.y });
        allPos.push({ x: p.x + NODE_SIZE, y: p.y + NODE_SIZE + 30 });
      });
      if (allPos.length === 0) return null;
      var xs = allPos.map(function(p) { return p.x; });
      var ys = allPos.map(function(p) { return p.y; });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      var w = maxX - minX + 80, h = maxY - minY + 80;
      var lpw = getLeftPanelWidth();
      var availW = getAvailableWidth();
      var availH = erdContainer.clientHeight;
      var sw = availW / w, sh = availH / h;
      var tScale = Math.min(sw, sh, 1);
      var tPanX = lpw + (availW - (maxX - minX) * tScale) / 2 - minX * tScale;
      var tPanY = (availH - (maxY - minY) * tScale) / 2 - minY * tScale;
      return { scale: tScale, panX: tPanX, panY: tPanY };
    }

    function fitGroupedViewport() {
      var fit = computeGroupedFit();
      if (!fit) return;
      scale = fit.scale;
      panX = fit.panX;
      panY = fit.panY;
      updateView();
    }

    var ZOOM_ANIM_MS = 400;

    function animateFitGroupedViewport() {
      var fit = computeGroupedFit();
      if (!fit) return;
      if (Math.abs(scale - fit.scale) < 0.005 && Math.abs(panX - fit.panX) < 2 && Math.abs(panY - fit.panY) < 2) {
        scale = fit.scale; panX = fit.panX; panY = fit.panY;
        updateView();
        return;
      }

      var startScale = scale, startPanX = panX, startPanY = panY;
      var animStart = performance.now();

      function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

      function tick(now) {
        var progress = Math.min(1, (now - animStart) / ZOOM_ANIM_MS);
        var e = easeOut(progress);
        scale = startScale + (fit.scale - startScale) * e;
        panX = startPanX + (fit.panX - startPanX) * e;
        panY = startPanY + (fit.panY - startPanY) * e;
        updateView();
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    // =====================================================================
    // --- End Grouped ERD View ---
    // =====================================================================

    // --- Position cache messages ---
    let initialRenderDone = false;
    
    window.addEventListener('message', function(event) {
      const message = event.data;
      if (message.command === 'positionsLoaded') {
        var loadedCtx = message.positionContext || 'topLevel';
        var loadedPos = message.positions || {};
        cachedPositionsForModel = loadedPos;

        if (loadedCtx === 'topLevel') {
          cachedPositions = loadedPos;
          if (!initialRenderDone) {
            initialRenderDone = true;
            if (initialViewMode === 'listGrouped' && hasGroups) {
              renderListGroupedView();
            } else if (initialViewMode === 'grouped' && hasGroups) {
              renderGroupedView();
            } else {
              if (isComplexModel()) {
                layoutMode = 'grid';
                hideRelationships = true;
              }
              renderTopLevel();
              if (Object.keys(cachedPositions).length === 0 && layoutMode !== 'grid') {
                saveAllCachedPositions(nodePositions);
              }
            }
            if (hasUnmappedNodes) {
              var unmLegend = root.querySelector('#unmappedLegendItem');
              if (unmLegend) unmLegend.style.display = '';
              var indSec = root.querySelector('#indicatorsLegendSection');
              if (indSec) indSec.style.display = 'block';
            }
          } else if (Object.keys(loadedPos).length > 0) {
            Object.keys(loadedPos).forEach(function(nodeId) {
              if (nodePositions[nodeId] && loadedPos[nodeId]) {
                nodePositions[nodeId] = { x: loadedPos[nodeId].x, y: loadedPos[nodeId].y };
              }
            });
            snapAllToGrid(nodePositions, getGridCellSize('top'));
            var repositioned = false;
            Object.keys(nodePositions).forEach(function(nodeId) {
              if (nodeElements[nodeId]) {
                nodeElements[nodeId].style.left = nodePositions[nodeId].x + 'px';
                nodeElements[nodeId].style.top = nodePositions[nodeId].y + 'px';
                repositioned = true;
              }
            });
            if (repositioned) { drawEdges(); fitToViewport(); }
          }
        } else if (loadedCtx.indexOf('drilldown:') === 0) {
          pendingDrilldownPositions = loadedPos;
        }
      }
      if (message.command === 'queryResult') {
        handleQueryResult(message);
      }
    });
    
    // --- ForceAtlas2 Layout ---
    function layoutForceAtlas2(nodeList, edgeList, skipCache) {
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
      
      const degree = {};
      nodeList.forEach(n => { degree[n.id] = 0; });
      edgeList.forEach(e => {
        if (degree[e.from] !== undefined) degree[e.from]++;
        if (degree[e.to] !== undefined) degree[e.to]++;
      });
      
      if (!skipCache) {
        let allCached = Object.keys(cachedPositions).length > 0;
        nodeList.forEach(n => { if (!cachedPositions[n.id]) allCached = false; });
        
        if (allCached) {
          nodeList.forEach(n => {
            nodePositions[n.id] = { x: cachedPositions[n.id].x, y: cachedPositions[n.id].y };
          });
          snapAllToGrid(nodePositions, getGridCellSize('top'));
          return;
        }
      }
      
      const positions = {};
      const velocities = {};
      nodeList.forEach(n => {
        if (!skipCache && cachedPositions[n.id]) {
          positions[n.id] = { x: cachedPositions[n.id].x, y: cachedPositions[n.id].y };
        } else {
          positions[n.id] = {
            x: padding + Math.random() * (canvasWidth - 2 * padding),
            y: padding + Math.random() * (canvasHeight - 2 * padding),
          };
        }
        velocities[n.id] = { x: 0, y: 0 };
      });
      
      for (let iter = 0; iter < iterations; iter++) {
        const forces = {};
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
          var speed = Math.sqrt(velocities[n.id].x * velocities[n.id].x + velocities[n.id].y * velocities[n.id].y);
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
        nodePositions[n.id] = {
          x: padding + ((raw.x - minX) / rangeX) * (canvasWidth - 2 * padding - NODE_SIZE),
          y: padding + ((raw.y - minY) / rangeY) * (canvasHeight - 2 * padding - NODE_SIZE)
        };
      });
      snapAllToGrid(nodePositions, getGridCellSize('top'));
    }

    function layoutGrid(nodeList) {
      var count = nodeList.length;
      if (count === 0) return;
      var cols = Math.ceil(Math.sqrt(count * 4 / 3));
      var CELL_W = 180;
      var CELL_H = 190;
      var PAD = 60;
      nodeList.forEach(function(n, idx) {
        var col = idx % cols;
        var row = Math.floor(idx / cols);
        nodePositions[n.id] = { x: PAD + col * CELL_W, y: PAD + row * CELL_H };
      });
    }
    
    // --- Top-level rendering ---
    function renderTopLevel(forceRelayout) {
      currentView = 'top';
      drilldownTarget = null;
      nodesLayer.innerHTML = '';
      svg.innerHTML = '';
      nodePositions = {};
      nodeElements = {};
      topHoverActive = false;
      root.querySelector('#backBtn').style.display = 'none';
      var ddLegend = root.querySelector('#drilldownLegendSection');
      if (ddLegend) ddLegend.style.display = 'none';
      var viewSuffix = isCompareMode ? ' - Compare (Local vs Remote)' : (layoutMode === 'grid' ? ' - Grid View' : ' - ERD V2');
      root.querySelector('#headerTitle').textContent = modelLabel + viewSuffix;
      root.querySelector('#topStats').style.display = 'flex';

      if (hasUnmappedNodes) { var unmGrpR = root.querySelector('#unmappedGroup'); if (unmGrpR) unmGrpR.classList.add('visible'); }
      var relEyeR = root.querySelector('#relToggleBtn'); if (relEyeR) relEyeR.style.display = '';
      var gridBtnR = root.querySelector('#layoutGridBtn');
      var forceBtnR = root.querySelector('#layoutForceBtn');
      if (gridBtnR) gridBtnR.style.display = '';
      if (forceBtnR) forceBtnR.style.display = '';
      updateLayoutControls();
      
      var visibleNodes = showUnmapped ? nodes : nodes.filter(function(n) { return !n.unmapped; });
      var visibleEdges = edges.filter(function(e) {
        var fromVisible = visibleNodes.some(function(n) { return n.id === e.from; });
        var toVisible = visibleNodes.some(function(n) { return n.id === e.to; });
        return fromVisible && toVisible;
      });

      if (layoutMode === 'grid') {
        layoutGrid(visibleNodes);
      } else {
        layoutForceAtlas2(visibleNodes, visibleEdges, !!forceRelayout);
      }
      
      visibleNodes.forEach(n => {
        const div = document.createElement('div');
        div.className = 'node ' + getNodeClass(n) + getDiffClassFromStatus(n.diffStatus) + (n.baseModelApiName ? ' pattern-base' : '') + (n.unmapped ? ' node-unmapped' : '');
        div.id = 'node-' + n.id;
        const iconSvg = getNodeIcon(n);
        const isShared = n.tableType === 'Shared';
        const isBase = !!n.baseModelApiName;
        const needsWrap = isShared || isBase;
        const sharedBadge = isShared ? '<div class="shared-badge">' + sharedSvg + '</div>' : '';
        const baseBadge = isBase ? '<div class="base-model-badge">BASE</div>' : '';
        const circleHtml = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
        div.innerHTML = (needsWrap ? '<div class="node-circle-wrap">' + circleHtml + sharedBadge + baseBadge + '</div>' : circleHtml) +
          '<div class="node-label"><div class="node-title">' + n.label + '</div></div>';
        
        const pos = nodePositions[n.id];
        div.style.left = pos.x + 'px';
        div.style.top = pos.y + 'px';

        if (layoutMode === 'grid') {
          div.style.cursor = 'pointer';
          div.addEventListener('click', function(e) { e.stopPropagation(); openSidebar(n); });
          div.addEventListener('dblclick', function(e) { e.stopPropagation(); e.preventDefault(); enterDrillDown(n); });
          div.addEventListener('mouseenter', function() { topLevelHoverIn(n.id); });
          div.addEventListener('mouseleave', function() { topLevelHoverOut(); });
        } else {
          let clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
          div.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            clickStartTime = Date.now();
            clickStartPos = { x: e.clientX, y: e.clientY };
            draggingNode = n.id;
            const rect = div.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
          });
          div.addEventListener('mouseup', (e) => {
            const dur = Date.now() - clickStartTime;
            const dist = Math.sqrt(Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2));
            if (dur < 300 && dist < 10) {
              openSidebar(n);
            }
          });
          div.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            enterDrillDown(n);
          });
          div.addEventListener('mouseenter', function() { topLevelHoverIn(n.id); });
          div.addEventListener('mouseleave', function() { topLevelHoverOut(); });
        }
        
        nodesLayer.appendChild(div);
        nodeElements[n.id] = div;
      });
      
      if (!hideRelationships) {
        drawEdges();
      }
      fitToViewport();
      updateLayoutControls();
    }
    
    function drawHoverEdges(relEdges) {
      if (relEdges.length === 0) return;
      createArrowMarkers(svg, { default: '#0070d2' }, 'tophover-');
      var portMap = isClassicMode() ? null : buildPortMap(edges, nodePositions, NODE_SIZE);
      var relSet = {};
      relEdges.forEach(function(e) { relSet[e.id] = true; });

      var pairCounts = {};
      edges.forEach(function(e) {
        var pk = e.from < e.to ? e.from + '||' + e.to : e.to + '||' + e.from;
        if (!pairCounts[pk]) pairCounts[pk] = { count: 0, idx: 0 };
        pairCounts[pk].count++;
      });

      edges.forEach(function(edge, idx) {
        var fromPos = nodePositions[edge.from];
        var toPos = nodePositions[edge.to];
        if (!fromPos || !toPos) return;
        var radius = NODE_SIZE / 2;
        var fcx = fromPos.x + radius, fcy = fromPos.y + radius;
        var tcx = toPos.x + radius, tcy = toPos.y + radius;
        var d;

        if (isClassicMode()) {
          var angle = Math.atan2(tcy - fcy, tcx - fcx);
          var fex = fcx + Math.cos(angle) * (radius + 5), fey = fcy + Math.sin(angle) * (radius + 5);
          var tex = tcx - Math.cos(angle) * (radius + 15), tey = tcy - Math.sin(angle) * (radius + 15);
          var co = 30 * (idx % 2 === 0 ? 1 : -1);
          var cp = generateClassicPath(fex, fey, tex, tey, co);
          d = cp.d;
        } else {
          var fromSide = getSide(fcx, fcy, tcx, tcy);
          var toSide = getSide(tcx, tcy, fcx, fcy);
          var fromOff = getPortOffset(edge.id, edge.from, fromSide, portMap, NODE_SIZE);
          var toOff = getPortOffset(edge.id, edge.to, toSide, portMap, NODE_SIZE);
          var sp = getPortPoint(fcx, fcy, fromSide, fromOff, radius);
          var tp = getPortPoint(tcx, tcy, toSide, toOff, radius);

          var pk = edge.from < edge.to ? edge.from + '||' + edge.to : edge.to + '||' + edge.from;
          var pc = pairCounts[pk];
          var curveOffset = 0;
          if (routingMode === 'straight') {
            var spacing = 20;
            curveOffset = spacing * (pc.idx - (pc.count - 1) / 2);
          }
          pc.idx++;

          d = generateRoutedPath(sp.x, sp.y, tp.x, tp.y, curveOffset, nodePositions, NODE_SIZE);
        }

        if (!relSet[edge.id]) return;

        var hoverStroke = isClassicMode() ? '5' : '3';
        var hoverGlow = isClassicMode() ? '12' : '8';

        var glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        glow.setAttribute('d', d);
        glow.setAttribute('stroke', '#0070d2');
        glow.setAttribute('stroke-width', hoverGlow);
        glow.setAttribute('fill', 'none');
        glow.setAttribute('opacity', '0.25');
        glow.setAttribute('stroke-linecap', 'round');
        svg.appendChild(glow);

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#0070d2');
        path.setAttribute('stroke-width', hoverStroke);
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#tophover-default)');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
      });
    }

    function topLevelHoverIn(nodeId) {
      if (topHoverActive) topLevelHoverOut();
      topHoverActive = true;

      var connectedIds = new Set();
      connectedIds.add(nodeId);
      var relEdges = [];
      edges.forEach(function(e) {
        if (e.from === nodeId || e.to === nodeId) {
          connectedIds.add(e.from);
          connectedIds.add(e.to);
          relEdges.push(e);
        }
      });

      if (hideRelationships) {
        Object.keys(nodeElements).forEach(function(id) {
          var el = nodeElements[id];
          if (connectedIds.has(id)) {
            el.classList.add('list-hover-related');
            el.classList.remove('list-hover-dimmed');
          } else {
            el.classList.add('list-hover-dimmed');
            el.classList.remove('list-hover-related');
          }
        });
        svg.innerHTML = '';
        drawHoverEdges(relEdges);
      } else {
        svg.querySelectorAll('path').forEach(function(p) { p.setAttribute('opacity', '0.12'); });
        root.querySelectorAll('.edge-label').forEach(function(el) { el.style.opacity = '0.12'; });
        drawHoverEdges(relEdges);
      }
    }

    function topLevelHoverOut() {
      if (!topHoverActive) return;
      topHoverActive = false;

      Object.keys(nodeElements).forEach(function(id) {
        var el = nodeElements[id];
        el.classList.remove('list-hover-dimmed', 'list-hover-related');
      });

      if (hideRelationships) {
        svg.innerHTML = '';
      } else {
        root.querySelectorAll('.edge-label').forEach(function(el) { el.style.opacity = ''; });
        drawEdges();
      }
    }

    function setLayoutMode(mode) {
      if (currentView === 'drilldown') return;
      if (layoutMode === mode) return;
      layoutMode = mode;
      if (layoutMode === 'grid') {
        hideRelationships = true;
      }
      updateLayoutControls();
      renderTopLevel(true);
    }

    function toggleRelationships() {
      hideRelationships = !hideRelationships;
      updateLayoutControls();
      if (currentView === 'drilldown') {
        if (hideRelationships) {
          svg.innerHTML = '';
        } else {
          drawDrillEdges();
        }
      } else if (currentView === 'top') {
        if (hideRelationships) {
          svg.innerHTML = '';
          root.querySelectorAll('.edge-label').forEach(function(el) { el.remove(); });
        } else {
          drawEdges();
        }
      }
    }

    function updateLayoutControls() {
      var gridBtn = root.querySelector('#layoutGridBtn');
      var forceBtn = root.querySelector('#layoutForceBtn');
      var autoBtn = root.querySelector('#autoLayoutBtn');
      var relBtn = root.querySelector('#relToggleBtn');

      if (gridBtn) {
        gridBtn.classList.toggle('route-active', layoutMode === 'grid');
      }
      if (forceBtn) {
        forceBtn.classList.toggle('route-active', layoutMode === 'force');
      }
      if (autoBtn) {
        autoBtn.style.display = (layoutMode === 'grid' && currentView !== 'drilldown') ? 'none' : '';
      }
      if (relBtn) {
        relBtn.classList.toggle('route-active', !hideRelationships);
        relBtn.title = hideRelationships ? 'Show Connectors' : 'Hide Connectors';
        var relLabel = relBtn.querySelector('.lp-btn-label');
        if (relLabel) relLabel.textContent = hideRelationships ? 'Show Connectors' : 'Hide Connectors';
      }
    }

    function isClassicMode() { return routingMode === 'classic'; }

    function edgeStroke() { return isClassicMode() ? '3' : '1.5'; }
    function edgeDiffStroke() { return isClassicMode() ? '4' : '2.5'; }
    function edgeGlowWidth() { return isClassicMode() ? '8' : '5'; }
    function edgeGlowOpacity() { return isClassicMode() ? '0.2' : '0.15'; }
    function edgeGroupStroke() { return isClassicMode() ? '3' : '1.5'; }

    function createArrowMarkers(svgEl, colors, prefix) {
      var sz = isClassicMode() ? 12 : 8;
      var half = sz / 2;
      var refX = isClassicMode() ? 10 : 7;
      var arrowD = isClassicMode()
        ? 'M 0 0 L 12 6 L 0 12 L 3 6 Z'
        : 'M 0 0 L 8 4 L 0 8 L 2 4 Z';
      var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      Object.entries(colors).forEach(function(entry) {
        var name = entry[0], color = entry[1];
        var mk = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        mk.setAttribute('id', prefix + name);
        mk.setAttribute('markerWidth', String(sz)); mk.setAttribute('markerHeight', String(sz));
        mk.setAttribute('refX', String(refX)); mk.setAttribute('refY', String(half));
        mk.setAttribute('orient', 'auto'); mk.setAttribute('markerUnits', 'userSpaceOnUse');
        var ap = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        ap.setAttribute('d', arrowD);
        ap.setAttribute('fill', color);
        mk.appendChild(ap);
        defs.appendChild(mk);
      });
      svgEl.appendChild(defs);
      return defs;
    }

    function drawEdges() {
      if (hideRelationships && currentView === 'top') {
        svg.innerHTML = '';
        root.querySelectorAll('.edge-label').forEach(function(el) { el.remove(); });
        return;
      }
      svg.innerHTML = '';
      var arrowColors = { default: '#939393', added: '#2ecc71', modified: '#f1c40f', removed: '#e74c3c', dimmed: '#e5e5e5' };
      createArrowMarkers(svg, arrowColors, 'arrowhead-');
      
      root.querySelectorAll('.edge-label').forEach(el => el.remove());

      var portMap = isClassicMode() ? null : buildPortMap(edges, nodePositions, NODE_SIZE);
      var pairCounts = {};
      edges.forEach(function(e) {
        var pk = e.from < e.to ? e.from + '||' + e.to : e.to + '||' + e.from;
        if (!pairCounts[pk]) pairCounts[pk] = { count: 0, idx: 0 };
        pairCounts[pk].count++;
      });
      
      edges.forEach((edge, idx) => {
        const fromPos = nodePositions[edge.from], toPos = nodePositions[edge.to];
        if (!fromPos || !toPos) return;
        const radius = NODE_SIZE / 2;
        const fcx = fromPos.x + radius, fcy = fromPos.y + radius;
        const tcx = toPos.x + radius, tcy = toPos.y + radius;

        var d, mpX, mpY;

        if (isClassicMode()) {
          var angle = Math.atan2(tcy - fcy, tcx - fcx);
          var fex = fcx + Math.cos(angle) * (radius + 5), fey = fcy + Math.sin(angle) * (radius + 5);
          var tex = tcx - Math.cos(angle) * (radius + 15), tey = tcy - Math.sin(angle) * (radius + 15);
          var co = 30 * (idx % 2 === 0 ? 1 : -1);
          var cp = generateClassicPath(fex, fey, tex, tey, co);
          d = cp.d; mpX = cp.mx; mpY = cp.my;
        } else {
          var fromSide = getSide(fcx, fcy, tcx, tcy);
          var toSide = getSide(tcx, tcy, fcx, fcy);
          var fromOff = getPortOffset(edge.id, edge.from, fromSide, portMap, NODE_SIZE);
          var toOff = getPortOffset(edge.id, edge.to, toSide, portMap, NODE_SIZE);
          var sp = getPortPoint(fcx, fcy, fromSide, fromOff, radius);
          var tp = getPortPoint(tcx, tcy, toSide, toOff, radius);

          var pk = edge.from < edge.to ? edge.from + '||' + edge.to : edge.to + '||' + edge.from;
          var pc = pairCounts[pk];
          var curveOffset = 0;
          if (routingMode === 'straight') {
            var spacing = 20;
            curveOffset = spacing * (pc.idx - (pc.count - 1) / 2);
          }
          pc.idx++;

          d = generateRoutedPath(sp.x, sp.y, tp.x, tp.y, curveOffset, nodePositions, NODE_SIZE);
          var mp = getEdgeMidpoint(sp.x, sp.y, tp.x, tp.y, curveOffset);
          mpX = mp.x; mpY = mp.y;
        }
        
        const edgeDiff = (edge.diffStatus && edge.diffStatus !== 'unchanged') ? edge.diffStatus : null;
        const isDimmed = highlightChangesActive && !edgeDiff;
        const edgeColor = isDimmed ? '#e5e5e5'
          : edgeDiff === 'added' ? '#2ecc71' : edgeDiff === 'modified' ? '#f1c40f' : edgeDiff === 'removed' ? '#e74c3c' : '#939393';
        
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        glow.setAttribute('d', d);
        glow.setAttribute('stroke', edgeColor); glow.setAttribute('stroke-width', edgeGlowWidth());
        glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', isDimmed ? '0.05' : edgeGlowOpacity());
        glow.setAttribute('stroke-linecap', 'round');
        svg.insertBefore(glow, svg.firstChild ? svg.firstChild.nextSibling : null);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        var arrowName = isDimmed ? 'dimmed' : edgeDiff ? edgeDiff : 'default';
        path.setAttribute('stroke', edgeColor); path.setAttribute('stroke-width', edgeDiff ? edgeDiffStroke() : edgeStroke());
        path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#arrowhead-' + arrowName + ')');
        path.setAttribute('stroke-linecap', 'round');
        if (isDimmed) path.setAttribute('opacity', '0.35');
        svg.appendChild(path);
        
        const cardMap = { 'Many_to_Many':'M:N','ManyToMany':'M:N','One_to_Many':'1:N','OneToMany':'1:N','Many_to_One':'N:1','ManyToOne':'N:1','One_to_One':'1:1','OneToOne':'1:1' };
        const label = document.createElement('div');
        label.className = 'edge-label';
        if (isClassicMode()) label.classList.add('edge-label-classic');
        label.innerHTML = '<span class="cardinality">' + (cardMap[edge.cardinality] || edge.cardinality || '—') + '</span>';
        label.title = edge.label + '\\n' + (edge.fromField || '') + ' → ' + (edge.toField || '');
        label.style.left = (mpX - (isClassicMode() ? 20 : 18)) + 'px';
        label.style.top = (mpY - (isClassicMode() ? 12 : 10)) + 'px';
        if (isDimmed) { label.style.opacity = '0.2'; label.style.borderColor = '#e5e5e5'; }
        nodesLayer.appendChild(label);
      });
    }
    
    // --- Drill-Down View ---
    function enterDrillDown(nodeData) {
      if (isTransitioning) return;
      isTransitioning = true;
      closeSidebar();
      closeResults();
      if (highlightChangesActive) {
        highlightChangesActive = false;
        updateChangesButtons();
      }

      // Save state for exit animation
      savedTopViewState = { panX, panY, scale };
      savedDrillNodeId = nodeData.id;
      savedHideRelationships = hideRelationships;
      hideRelationships = false;
      updateLayoutControls();
      drilldownTarget = nodeData;
      
      // Pre-compute drill-down layout while animating
      const allEntities = [];
      (nodeData.relatedCalcDims || []).forEach(e => { if (!e.isSystemDefinition) allEntities.push({ ...e, cssClass: 'calc-dim', typeLabel: 'Calc Dimension' }); });
      (nodeData.relatedCalcMeas || []).forEach(e => { if (!e.isSystemDefinition) allEntities.push({ ...e, cssClass: 'calc-meas', typeLabel: 'Calc Measurement' }); });
      (nodeData.relatedHierarchies || []).forEach(e => allEntities.push({ ...e, cssClass: 'dim-hier', typeLabel: 'Dim Hierarchy' }));
      (nodeData.relatedMetrics || []).forEach(e => allEntities.push({ ...e, cssClass: 'metric', typeLabel: 'Metric' }));
      (nodeData.relatedGroupings || []).forEach(e => allEntities.push({ ...e, cssClass: 'grouping', typeLabel: 'Grouping' }));

      // Pull in missing intermediate calcs (1 level only — from original entities)
      var knownApiNames = new Set(allEntities.map(e => e.apiName));
      var originalCount = allEntities.length;
      for (var oi = 0; oi < originalCount; oi++) {
        var ent = allEntities[oi];
        var info = calcFieldsLookup[ent.apiName];
        if (!info || !info.directReferences) continue;
        info.directReferences.forEach(function(ref) {
          if (!ref.objectApiName && ref.fieldApiName && !knownApiNames.has(ref.fieldApiName)) {
            var missingCalc = calcFieldsLookup[ref.fieldApiName];
            if (missingCalc) {
              var cssClass = missingCalc.entityType === 'calculatedDimension' ? 'calc-dim' : 'calc-meas';
              var typeLabel = missingCalc.entityType === 'calculatedDimension' ? 'Calc Dimension' : 'Calc Measurement';
              allEntities.push({
                apiName: missingCalc.apiName,
                label: missingCalc.label,
                expression: missingCalc.expression,
                placement: missingCalc.placement,
                referencedObjects: missingCalc.referencedObjects || [],
                directReferences: missingCalc.directReferences,
                cssClass: cssClass,
                typeLabel: typeLabel,
                type: cssClass,
                baseModelApiName: missingCalc.baseModelApiName || null,
                diffStatus: missingCalc.diffStatus || null,
              });
              knownApiNames.add(ref.fieldApiName);
            }
          }
        });
      }
      
      ddEntities = allEntities;
      ddCenterId = nodeData.id;
      ddPositions = {};
      ddElements = {};
      ddEdgeObjectIds = new Set();
      
      allEntities.forEach(ent => {
        var cl0 = calcFieldsLookup[ent.apiName];
        if (cl0 && cl0.directReferences) {
          cl0.directReferences.forEach(function(r) {
            if (r.objectApiName && r.objectApiName !== nodeData.id) ddEdgeObjectIds.add(r.objectApiName);
          });
        } else {
          (ent.referencedObjects || []).forEach(function(o) {
            if (o !== nodeData.id) ddEdgeObjectIds.add(o);
          });
        }
      });
      const edgeObjArr = Array.from(ddEdgeObjectIds);
      
      const drillNodes = [{ id: '__center__', type: 'center' }];
      const drillEdges = [];
      const entApiNames = new Set(allEntities.map(e => e.apiName));
      
      allEntities.forEach(ent => {
        drillNodes.push({ id: 'ent_' + ent.apiName, type: 'entity' });
        
        const lookup = calcFieldsLookup[ent.apiName];
        const directRefs = lookup ? lookup.directReferences || [] : [];
        let refsOtherCalcs = false;
        const addedCalcEdges = new Set();
        
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
        directRefs.forEach(ref => {
          if (ref.objectApiName === nodeData.id) refsCenter = true;
        });
        
        const referencesCenter = (ent.referencedObjects || []).indexOf(nodeData.id) >= 0;
        if (refsCenter || (!refsOtherCalcs && referencesCenter)) {
          drillEdges.push({ from: '__center__', to: 'ent_' + ent.apiName });
        }
      });
      
      edgeObjArr.forEach(objId => { drillNodes.push({ id: 'eobj_' + objId, type: 'edgeObj' }); });
      allEntities.forEach(ent => {
        var directObjSet = new Set();
        var cl = calcFieldsLookup[ent.apiName];
        if (cl && cl.directReferences) {
          cl.directReferences.forEach(function(r) { if (r.objectApiName) directObjSet.add(r.objectApiName); });
        } else {
          (ent.referencedObjects || []).forEach(function(o) { directObjSet.add(o); });
        }
        directObjSet.forEach(function(o) {
          if (o !== nodeData.id && ddEdgeObjectIds.has(o)) {
            drillEdges.push({ from: 'ent_' + ent.apiName, to: 'eobj_' + o });
          }
        });
      });
      // Pre-compute layout as fallback; cached positions from file may override in phase 2
      const algorithmPositions = layoutDrillDown(drillNodes, drillEdges);
      pendingDrilldownPositions = null;
      requestPositionsForContext('drilldown:' + nodeData.id);
      
      // --- PHASE 1: Animate top-level out (500ms) ---
      // Fade out edges
      svg.classList.add('morph-hide');
      root.querySelectorAll('.edge-label').forEach(el => el.classList.add('morph-hide'));
      
      // Calculate center of viewport in canvas coords
      const viewCx = (erdContainer.clientWidth / 2 - panX) / scale;
      const viewCy = (erdContainer.clientHeight / 2 - panY) / scale;
      
      // Animate clicked node to center of viewport
      nodes.forEach(n => {
        const el = nodeElements[n.id];
        if (!el) return;
        el.classList.add('morph-animate');
        if (n.id === nodeData.id) {
          el.style.left = (viewCx - NODE_SIZE / 2) + 'px';
          el.style.top = (viewCy - NODE_SIZE / 2) + 'px';
        } else {
          el.classList.add('morph-fade-out');
        }
      });
      
      // --- PHASE 2: After fade, swap to drill-down (500ms later) ---
      setTimeout(() => {
        currentView = 'drilldown';
        var ddLegend = root.querySelector('#drilldownLegendSection');
        if (ddLegend) ddLegend.style.display = '';

        // Use cached positions from file if available, otherwise use algorithm layout.
        // Always merge algorithm positions for entities missing from cache (e.g. newly added calcs).
        var useCached = pendingDrilldownPositions && Object.keys(pendingDrilldownPositions).length > 0;
        var drillPositions = useCached ? pendingDrilldownPositions : algorithmPositions;
        Object.keys(drillPositions).forEach(function(k) { ddPositions[k] = drillPositions[k]; });
        if (useCached) {
          var hadMissing = false;
          Object.keys(algorithmPositions).forEach(function(k) {
            if (!ddPositions[k]) { ddPositions[k] = algorithmPositions[k]; hadMissing = true; }
          });
          if (hadMissing) { saveAllCachedPositions(ddPositions); }
        }
        snapAllToGrid(ddPositions, getGridCellSize('drilldown'));
        ddCenterPos = ddPositions['__center__'] || algorithmPositions['__center__'];
        
        if (!useCached) {
          saveAllCachedPositions(ddPositions);
        }
        pendingDrilldownPositions = null;

        nodesLayer.innerHTML = '';
        svg.innerHTML = '';
        svg.classList.remove('morph-hide');
        
        root.querySelector('#backBtn').style.display = 'flex';
        root.querySelector('#headerTitle').textContent = 'Drill-Down: ' + nodeData.label;
        showEmbeddedBackBtn();
        root.querySelector('#topStats').style.display = 'none';

        var unmGrp = root.querySelector('#unmappedGroup');
        if (unmGrp) unmGrp.classList.remove('visible');
        var gridBtn = root.querySelector('#layoutGridBtn');
        var forceBtn = root.querySelector('#layoutForceBtn');
        var autoBtn = root.querySelector('#autoLayoutBtn');
        if (gridBtn) gridBtn.style.display = 'none';
        if (forceBtn) forceBtn.style.display = 'none';
        if (autoBtn) autoBtn.style.display = '';
        
        // Fit drill-down to viewport first (compute scale/pan)
        const allX = [], allY = [];
        Object.values(ddPositions).forEach(p => { allX.push(p.x); allY.push(p.y); });
        if (allX.length > 0) {
          const mnX = Math.min(...allX) - 150, mxX = Math.max(...allX) + 200;
          const mnY = Math.min(...allY) - 100, mxY = Math.max(...allY) + 100;
          const w = mxX - mnX, h = mxY - mnY;
          const lpw = getLeftPanelWidth();
          const availW = getAvailableWidth();
          const sw = availW / (w + 50);
          const sh = erdContainer.clientHeight / (h + 50);
          scale = Math.min(sw, sh, 1);
          panX = lpw + (availW - w * scale) / 2 - mnX * scale;
          panY = (erdContainer.clientHeight - h * scale) / 2 - mnY * scale;
        } else {
          panX = 0; panY = 0; scale = 1;
        }
        updateView();
        
        const cp = ddCenterPos;
        const CENTER_RADIUS = 60;
        const dims = nodeData.dimensions || [];
        const meas = nodeData.measurements || [];
        const isLV = nodeData.type === 'logicalView';
        const isDLO = nodeData.dataObjectType === 'Dlo';
        const centerIcon = getNodeIcon(nodeData);
        
        // Create center node (appears immediately, it "was" the clicked node)
        const centerDiv = document.createElement('div');
        centerDiv.className = 'center-node' + (isLV ? ' lv' : '') + (isDLO ? ' dlo' : '') + getDiffClassFromStatus(nodeData.diffStatus) + (nodeData.baseModelApiName ? ' pattern-base' : '');
        centerDiv.setAttribute('data-dd-key', '__center__');
        centerDiv.style.left = (cp.x - CENTER_RADIUS) + 'px';
        centerDiv.style.top = (cp.y - CENTER_RADIUS) + 'px';
        
        const isCenterShared = nodeData.tableType === 'Shared';
        const isCenterBase = !!nodeData.baseModelApiName;
        const centerNeedsWrap = isCenterShared || isCenterBase;
        const centerSharedBadge = isCenterShared ? '<div class="shared-badge">' + sharedSvg + '</div>' : '';
        const centerBaseBadge = isCenterBase ? '<div class="base-model-badge">BASE</div>' : '';
        const centerCircle = '<div class="node-circle"><div class="node-icon">' + centerIcon + '</div></div>';
        let centerHtml = centerNeedsWrap ? '<div class="node-circle-wrap">' + centerCircle + centerSharedBadge + centerBaseBadge + '</div>' : centerCircle;
        centerHtml += '<div class="node-label"><div class="node-title">' + nodeData.label + '</div>';
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
          draggingNode = '__center__';
          const rect = centerDiv.getBoundingClientRect();
          dragOffsetX = e.clientX - rect.left;
          dragOffsetY = e.clientY - rect.top;
        });
        centerDiv.addEventListener('mouseup', (e) => {
          const dur = Date.now() - centerClickStart;
          const dist = Math.sqrt(Math.pow(e.clientX - centerClickPos.x, 2) + Math.pow(e.clientY - centerClickPos.y, 2));
          if (dur < 300 && dist < 10) { openSidebar(nodeData); }
        });
        nodesLayer.appendChild(centerDiv);
        ddElements['__center__'] = centerDiv;
        
        // Create drill-down entities at center (hidden), will animate outward
        const ddDivs = [];
        allEntities.forEach(ent => {
          const key = 'ent_' + ent.apiName;
          const pos = ddPositions[key];
          if (!pos) return;
          
          const div = document.createElement('div');
          div.className = 'entity-node ' + ent.cssClass + (ent.placement === 'crossObject' ? ' cross-object' : '') + getDiffClassFromStatus(ent.diffStatus) + (ent.baseModelApiName ? ' pattern-base' : '') + ' morph-animate morph-fade-in-start';
          div.setAttribute('data-dd-key', key);
          div.style.left = (cp.x - ENTITY_SIZE / 2) + 'px';
          div.style.top = (cp.y - ENTITY_SIZE / 2) + 'px';
          
          const svgIcon = entitySvgIcons[ent.cssClass];
          const fallback = entityFallbackIcons[ent.cssClass] || '?';
          const iconContent = svgIcon ? '<div class="entity-circle-icon">' + svgIcon + '</div>' : '<span class="entity-circle-icon-text">' + fallback + '</span>';
          const entBaseBadge = ent.baseModelApiName ? '<div class="base-model-badge">BASE</div>' : '';
          let html = '<div class="entity-circle" style="' + (ent.baseModelApiName ? 'position:relative;overflow:visible;' : '') + '">' + iconContent + entBaseBadge + '</div>';
          html += '<div class="entity-label-wrap"><div class="entity-title">' + ent.label + '</div>';
          html += '<div class="entity-type-label">' + ent.typeLabel + '</div>';
          if (ent.placement === 'crossObject') {
            const others = (ent.referencedObjects || []).filter(o => o !== nodeData.id);
            if (others.length > 0) {
              const otherLabels = others.map(o => { const nd = nodes.find(nn => nn.id === o); return nd ? nd.label : o; });
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
            draggingNode = key;
            const rect = div.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
          });
          div.addEventListener('mouseup', (e) => {
            const dur = Date.now() - entClickStart;
            const dist = Math.sqrt(Math.pow(e.clientX - entClickPos.x, 2) + Math.pow(e.clientY - entClickPos.y, 2));
            if (dur < 300 && dist < 10) { openSidebar(Object.assign({}, ent, { origType: ent.type, type: ent.cssClass })); }
          });
          div.addEventListener('mouseenter', () => { onDrillEntityHover(ent.apiName); });
          div.addEventListener('mouseleave', () => { onDrillEntityLeave(); });
          
          nodesLayer.appendChild(div);
          ddElements[key] = div;
          ddDivs.push({ div, pos, key });
        });
        
        // Create edge objects at center (hidden)
        edgeObjArr.forEach(objId => {
          const key = 'eobj_' + objId;
          const pos = ddPositions[key];
          if (!pos) return;
          
          const objNode = nodes.find(n => n.id === objId);
          const objLabel = objNode ? objNode.label : objId.replace(/_/g, ' ');
          const icon = objNode ? getNodeIcon(objNode) : tableSvg;
          
          const div = document.createElement('div');
          const edgeObjTypeClass = objNode ? getNodeClass(objNode) : 'data-object';
          div.className = 'edge-object ' + edgeObjTypeClass + ' morph-animate morph-fade-in-start';
          div.setAttribute('data-dd-key', key);
          div.style.left = (cp.x - EDGE_OBJ_SIZE / 2) + 'px';
          div.style.top = (cp.y - EDGE_OBJ_SIZE / 2) + 'px';
          div.innerHTML = '<div class="edge-object-circle"><div class="edge-object-icon">' + icon + '</div></div>' +
            '<div class="edge-object-label">' + objLabel + '</div>';
          div.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            draggingNode = key;
            const rect = div.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
          });
          div.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (objNode) enterDrillDown(objNode);
          });
          nodesLayer.appendChild(div);
          ddElements[key] = div;
          ddDivs.push({ div, pos, key });
        });
        
        // --- PHASE 3: Stagger animate entities from center to final positions ---
        requestAnimationFrame(() => {
          ddDivs.forEach((item, i) => {
            setTimeout(() => {
              item.div.classList.add('morph-fade-in');
              const halfSize = item.key.startsWith('eobj_') ? EDGE_OBJ_SIZE / 2 : ENTITY_SIZE / 2;
              item.div.style.left = (item.pos.x - halfSize) + 'px';
              item.div.style.top = (item.pos.y - halfSize) + 'px';
            }, 30 + i * 40);
          });
        });
        
        // Draw edges after entities finish animating
        setTimeout(() => {
          drawDrillEdges();
          isTransitioning = false;
          // Remove transition classes so dragging works normally
          ddDivs.forEach(item => {
            item.div.classList.remove('morph-animate', 'morph-fade-in-start', 'morph-fade-in');
          });
        }, 100 + ddDivs.length * 40 + 500);
        
      }, 500);
    }
    
    
    function drawDrillEdges() {
      svg.innerHTML = '';
      if (!ddCenterPos) return;
      if (hideRelationships) return;
      
      const colors = { exclusive: '#706e6b', cross: '#b45309', chain: '#0070d2' };
      createArrowMarkers(svg, colors, 'dd-arrow-');
      
      const cp = ddCenterPos;
      const entApiNames = new Set(ddEntities.map(e => e.apiName));
      let arrowIdx = 0;
      
      ddEntities.forEach(ent => {
        const entKey = 'ent_' + ent.apiName;
        const pos = ddPositions[entKey];
        if (!pos) return;
        const entDimmed = highlightChangesActive && (!ent.diffStatus || ent.diffStatus === 'unchanged');
        
        const lookup = calcFieldsLookup[ent.apiName];
        const directRefs = lookup ? lookup.directReferences || [] : [];
        const isCross = ent.placement === 'crossObject';
        
        let refsCenter = false;
        const calcTargetSet = new Set();
        
        directRefs.forEach(ref => {
          if (ref.objectApiName === ddCenterId) {
            refsCenter = true;
          } else if (!ref.objectApiName && ref.fieldApiName && entApiNames.has(ref.fieldApiName)) {
            calcTargetSet.add(ref.fieldApiName);
          }
        });
        const calcTargets = Array.from(calcTargetSet);
        
        const referencesCenter = (ent.referencedObjects || []).indexOf(ddCenterId) >= 0;
        if (directRefs.length === 0 && referencesCenter) {
          const color = isCross ? '#b45309' : '#706e6b';
          const markerName = isCross ? 'cross' : 'exclusive';
          drawDrillArrow(pos.x, pos.y, cp.x, cp.y, ENTITY_SIZE / 2, 60, color, markerName, isCross, arrowIdx++, entDimmed, entKey, '__center__');
        } else {
          if (refsCenter) {
            const color = isCross ? '#b45309' : '#706e6b';
            const markerName = isCross ? 'cross' : 'exclusive';
            drawDrillArrow(pos.x, pos.y, cp.x, cp.y, ENTITY_SIZE / 2, 60, color, markerName, isCross, arrowIdx++, entDimmed, entKey, '__center__');
          }
          
          calcTargets.forEach(targetApiName => {
            const targetPos = ddPositions['ent_' + targetApiName];
            const targetEnt = ddEntities.find(e => e.apiName === targetApiName);
            const targetDimmed = highlightChangesActive && (!targetEnt || !targetEnt.diffStatus || targetEnt.diffStatus === 'unchanged');
            if (targetPos) {
              drawDrillArrow(pos.x, pos.y, targetPos.x, targetPos.y, ENTITY_SIZE / 2, ENTITY_SIZE / 2, '#0070d2', 'chain', false, arrowIdx++, entDimmed && targetDimmed, entKey, 'ent_' + targetApiName);
            }
          });
          
          if (!refsCenter && calcTargets.length === 0 && referencesCenter) {
            const color = isCross ? '#b45309' : '#706e6b';
            const markerName = isCross ? 'cross' : 'exclusive';
            drawDrillArrow(pos.x, pos.y, cp.x, cp.y, ENTITY_SIZE / 2, 60, color, markerName, isCross, arrowIdx++, entDimmed, entKey, '__center__');
          }
        }
      });
      
      ddEntities.forEach(ent => {
        const entKey = 'ent_' + ent.apiName;
        const ep = ddPositions[entKey];
        if (!ep) return;
        const entDimmed = highlightChangesActive && (!ent.diffStatus || ent.diffStatus === 'unchanged');
        var directObjSet2 = new Set();
        var cl2 = calcFieldsLookup[ent.apiName];
        if (cl2 && cl2.directReferences) {
          cl2.directReferences.forEach(function(r) { if (r.objectApiName) directObjSet2.add(r.objectApiName); });
        } else {
          (ent.referencedObjects || []).forEach(function(o) { directObjSet2.add(o); });
        }
        directObjSet2.forEach(function(o) {
          if (o !== ddCenterId && ddEdgeObjectIds.has(o)) {
            const op = ddPositions['eobj_' + o];
            if (op) {
              drawDrillArrow(ep.x, ep.y, op.x, op.y, ENTITY_SIZE / 2, EDGE_OBJ_SIZE / 2, '#b45309', 'cross', true, arrowIdx++, entDimmed, entKey, 'eobj_' + o);
            }
          }
        });
      });
    }
    
    function drawDrillArrow(x1, y1, x2, y2, r1, r2, color, markerName, dashed, idx, dimmed, fromKey, toKey) {
      const useColor = dimmed ? '#c9c7c5' : color;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const fex = x1 + Math.cos(angle) * (r1 + 5);
      const fey = y1 + Math.sin(angle) * (r1 + 5);
      const tex = x2 - Math.cos(angle) * (r2 + (isClassicMode() ? 15 : 10));
      const tey = y2 - Math.sin(angle) * (r2 + (isClassicMode() ? 15 : 10));

      var d;
      if (isClassicMode()) {
        var co = Math.min(25, Math.max(1, Math.sqrt((tex-fex)*(tex-fex)+(tey-fey)*(tey-fey))) * 0.12) * ((idx || 0) % 2 === 0 ? 1 : -1);
        d = generateClassicPath(fex, fey, tex, tey, co).d;
      } else {
        var curveOffset = Math.min(25, Math.max(1, Math.sqrt((tex-fex)*(tex-fex)+(tey-fey)*(tey-fey))) * 0.12) * ((idx || 0) % 2 === 0 ? 1 : -1);
        d = generateRoutedPath(fex, fey, tex, tey, curveOffset, ddPositions, ENTITY_SIZE);
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
      
      svg.appendChild(g);
    }
    
    // --- Drill-down hover chain highlight ---
    var ddHoverActive = false;
    var ddHoverTimer = null;
    
    function getDrillChainRelated(startApiName) {
      var relatedKeys = new Set();
      var visited = new Set();
      var entNames = new Set(ddEntities.map(function(e) { return e.apiName; }));

      function walk(apiName) {
        if (visited.has(apiName)) return;
        visited.add(apiName);
        relatedKeys.add('ent_' + apiName);

        var ent = ddEntities.find(function(e) { return e.apiName === apiName; });
        var lookup = calcFieldsLookup[apiName];
        var directRefs = lookup ? lookup.directReferences || [] : [];
        var referencesCenter = ent && (ent.referencedObjects || []).indexOf(ddCenterId) >= 0;

        if (directRefs.length === 0) {
          if (referencesCenter) relatedKeys.add('__center__');
        } else {
          directRefs.forEach(function(ref) {
            if (ref.objectApiName) {
              if (ref.objectApiName === ddCenterId) {
                relatedKeys.add('__center__');
              } else if (ddEdgeObjectIds.has(ref.objectApiName)) {
                relatedKeys.add('eobj_' + ref.objectApiName);
              }
            } else if (ref.fieldApiName && entNames.has(ref.fieldApiName)) {
              walk(ref.fieldApiName);
            }
          });
        }

        // For non-calc entities (hierarchies, metrics, groupings), use referencedObjects
        if (!lookup) {
          (ent && ent.referencedObjects || []).forEach(function(o) {
            if (o === ddCenterId) {
              relatedKeys.add('__center__');
            } else if (ddEdgeObjectIds.has(o)) {
              relatedKeys.add('eobj_' + o);
            }
          });
        }
      }

      walk(startApiName);
      return relatedKeys;
    }
    
    function onDrillEntityHover(apiName) {
      if (isTransitioning) return;
      if (ddHoverTimer) { clearTimeout(ddHoverTimer); ddHoverTimer = null; }
      ddHoverTimer = setTimeout(function() {
        ddHoverTimer = null;
        if (isTransitioning || ddHoverActive) return;
        ddHoverActive = true;
        var relatedKeys = getDrillChainRelated(apiName);
        
        Object.keys(ddElements).forEach(function(key) {
          var el = ddElements[key];
          if (relatedKeys.has(key)) {
            el.classList.add('dd-hover-related');
          } else {
            el.classList.add('dd-hover-dimmed');
          }
        });
        
        svg.querySelectorAll('g[data-from]').forEach(function(g) {
          var from = g.getAttribute('data-from');
          var to = g.getAttribute('data-to');
          if (relatedKeys.has(from) && relatedKeys.has(to)) {
            g.classList.add('dd-hover-related');
          } else {
            g.classList.add('dd-hover-dimmed');
          }
        });
      }, 1000);
    }
    
    function onDrillEntityLeave() {
      if (ddHoverTimer) { clearTimeout(ddHoverTimer); ddHoverTimer = null; }
      if (!ddHoverActive) return;
      ddHoverActive = false;
      Object.keys(ddElements).forEach(function(key) {
        ddElements[key].classList.remove('dd-hover-related', 'dd-hover-dimmed');
      });
      svg.querySelectorAll('g[data-from]').forEach(function(g) {
        g.classList.remove('dd-hover-related', 'dd-hover-dimmed');
      });
    }
    
    // Force-directed layout for drill-down view (center node pinned)
    function layoutDrillDown(drillNodes, drillEdges) {
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
      
      const degree = {};
      drillNodes.forEach(n => { degree[n.id] = 0; });
      drillEdges.forEach(e => {
        if (degree[e.from] !== undefined) degree[e.from]++;
        if (degree[e.to] !== undefined) degree[e.to]++;
      });
      
      const positions = {};
      const velocities = {};
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
        const forces = {};
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
          const force = springStiffness * (dist - springLength);
          const fx = force * dx / dist, fy = force * dy / dist;
          forces[e.from].x += fx; forces[e.from].y += fy;
          forces[e.to].x -= fx; forces[e.to].y -= fy;
        });
        
        drillNodes.forEach(n => {
          forces[n.id].x += (centerX - positions[n.id].x) * gravity;
          forces[n.id].y += (centerY - positions[n.id].y) * gravity;
        });
        
        drillNodes.forEach(n => {
          if (n.id === '__center__') return;
          velocities[n.id].x = (velocities[n.id].x + forces[n.id].x) * 0.85;
          velocities[n.id].y = (velocities[n.id].y + forces[n.id].y) * 0.85;
          var speed = Math.sqrt(velocities[n.id].x * velocities[n.id].x + velocities[n.id].y * velocities[n.id].y);
          if (speed > maxDisplacement) {
            velocities[n.id].x *= maxDisplacement / speed;
            velocities[n.id].y *= maxDisplacement / speed;
          }
          positions[n.id].x += velocities[n.id].x;
          positions[n.id].y += velocities[n.id].y;
        });
      }
      
      // Normalize
      const xs = Object.values(positions).map(p => p.x);
      const ys = Object.values(positions).map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
      
      const result = {};
      drillNodes.forEach(n => {
        result[n.id] = {
          x: padding + ((positions[n.id].x - minX) / rangeX) * (canvasW - 2 * padding),
          y: padding + ((positions[n.id].y - minY) / rangeY) * (canvasH - 2 * padding)
        };
      });
      snapAllToGrid(result, getGridCellSize('drilldown'));
      return result;
    }
    
    // drawDrillLine replaced by drawDrillArrow above
    
    function exitDrillDown() {
      if (isTransitioning) return;
      isTransitioning = true;
      closeSidebar();
      onDrillEntityLeave();
      if (highlightChangesActive) {
        highlightChangesActive = false;
        updateChangesButtons();
      }
      
      // --- PHASE 1: Collapse drill-down entities back to center (400ms) ---
      svg.classList.add('morph-hide');
      
      const cp = ddCenterPos || { x: 500, y: 400 };
      const ddKeys = Object.keys(ddElements).filter(k => k !== '__center__');
      
      ddKeys.forEach((key, i) => {
        const el = ddElements[key];
        if (!el) return;
        el.classList.add('morph-animate');
        setTimeout(() => {
          const halfSize = key.startsWith('eobj_') ? EDGE_OBJ_SIZE / 2 : ENTITY_SIZE / 2;
          el.style.left = (cp.x - halfSize) + 'px';
          el.style.top = (cp.y - halfSize) + 'px';
          el.classList.add('morph-fade-out');
        }, i * 20);
      });
      
      // --- PHASE 2: After collapse, swap to top-level or grouped (500ms later) ---
      setTimeout(() => {
        drilldownTarget = null;
        nodesLayer.innerHTML = '';
        groupContainersLayer.innerHTML = '';
        svg.innerHTML = '';
        svg.classList.remove('morph-hide');

        if (savedGroupState) {
          expandedGroups = savedGroupState.expanded;
          panX = savedGroupState.panX;
          panY = savedGroupState.panY;
          scale = savedGroupState.scale;
          savedGroupState = null;
          renderGroupedView();
          updateView();
          isTransitioning = false;
          return;
        }
        
        currentView = 'top';
        root.querySelector('#backBtn').style.display = 'none';
        var ddLegendExit = root.querySelector('#drilldownLegendSection');
        if (ddLegendExit) ddLegendExit.style.display = 'none';
        var exitViewSuffix = isCompareMode ? ' - Compare (Local vs Remote)' : (layoutMode === 'grid' ? ' - Grid View' : ' - ERD V2');
        root.querySelector('#headerTitle').textContent = modelLabel + exitViewSuffix;
        hideEmbeddedBackBtn();
        root.querySelector('#topStats').style.display = 'flex';

        if (hasUnmappedNodes) { var unmGrp2 = root.querySelector('#unmappedGroup'); if (unmGrp2) unmGrp2.classList.add('visible'); }
        var relEye2 = root.querySelector('#relToggleBtn'); if (relEye2) relEye2.style.display = '';
        var gridBtn2 = root.querySelector('#layoutGridBtn');
        var forceBtn2 = root.querySelector('#layoutForceBtn');
        if (gridBtn2) gridBtn2.style.display = '';
        if (forceBtn2) forceBtn2.style.display = '';
        hideRelationships = savedHideRelationships;
        updateLayoutControls();
        
        if (layoutMode === 'grid') {
          renderTopLevel();
          isTransitioning = false;
          return;
        }

        // Restore saved viewport
        panX = savedTopViewState.panX;
        panY = savedTopViewState.panY;
        scale = savedTopViewState.scale;
        
        layoutForceAtlas2(nodes, edges);
        
        // Calculate where the drilled node will be in the viewport center
        const viewCx = (erdContainer.clientWidth / 2 - panX) / scale;
        const viewCy = (erdContainer.clientHeight / 2 - panY) / scale;
        
        // Create all top-level nodes
        nodes.forEach(n => {
          const div = document.createElement('div');
          div.className = 'node ' + getNodeClass(n) + getDiffClassFromStatus(n.diffStatus) + (n.baseModelApiName ? ' pattern-base' : '') + ' morph-animate';
          div.id = 'node-' + n.id;
          const iconSvg = getNodeIcon(n);
          const isMorphShared = n.tableType === 'Shared';
          const isMorphBase = !!n.baseModelApiName;
          const morphNeedsWrap = isMorphShared || isMorphBase;
          const morphSharedBadge = isMorphShared ? '<div class="shared-badge">' + sharedSvg + '</div>' : '';
          const morphBaseBadge = isMorphBase ? '<div class="base-model-badge">BASE</div>' : '';
          const morphCircle = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
          div.innerHTML = (morphNeedsWrap ? '<div class="node-circle-wrap">' + morphCircle + morphSharedBadge + morphBaseBadge + '</div>' : morphCircle) +
            '<div class="node-label"><div class="node-title">' + n.label + '</div></div>';
          
          const finalPos = nodePositions[n.id];
          
          if (n.id === savedDrillNodeId) {
            div.style.left = (viewCx - NODE_SIZE / 2) + 'px';
            div.style.top = (viewCy - NODE_SIZE / 2) + 'px';
          } else {
            div.style.left = finalPos.x + 'px';
            div.style.top = finalPos.y + 'px';
            div.classList.add('morph-fade-in-start');
          }
          
          let clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
          div.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            clickStartTime = Date.now();
            clickStartPos = { x: e.clientX, y: e.clientY };
            draggingNode = n.id;
            const rect = div.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
          });
          div.addEventListener('mouseup', (e) => {
            const dur = Date.now() - clickStartTime;
            const dist = Math.sqrt(Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2));
            if (dur < 300 && dist < 10) { openSidebar(n); }
          });
          div.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            enterDrillDown(n);
          });
          div.addEventListener('mouseenter', function() { topLevelHoverIn(n.id); });
          div.addEventListener('mouseleave', function() { topLevelHoverOut(); });
          
          nodesLayer.appendChild(div);
          nodeElements[n.id] = div;
        });
        
        // Animate: drilled node moves to its position, others fade in
        requestAnimationFrame(() => {
          nodes.forEach(n => {
            const el = nodeElements[n.id];
            const pos = nodePositions[n.id];
            if (n.id === savedDrillNodeId) {
              el.style.left = pos.x + 'px';
              el.style.top = pos.y + 'px';
            } else {
              el.classList.add('morph-fade-in');
            }
          });
        });
        
        // Draw edges after animation
        setTimeout(() => {
          drawEdges();
          isTransitioning = false;
          nodes.forEach(n => {
            const el = nodeElements[n.id];
            if (el) el.classList.remove('morph-animate', 'morph-fade-in-start', 'morph-fade-in', 'morph-fade-out');
          });
        }, 600);
        
        updateView();
      }, 400 + ddKeys.length * 20);
    }
    
    // --- Sidebar ---
    const entityTypes = { 'calc-dim': 1, 'calc-meas': 1, 'dim-hier': 1, 'metric': 1, 'grouping': 1 };
    
    function openSidebar(nodeData) {
      updateEmbeddedBackBtnPosition();
      if (nodeData.type in entityTypes) {
        openEntitySidebar(nodeData);
        return;
      }
      const typeLabel = nodeData.type === 'logicalView' ? 'Logical View'
        : nodeData.dataObjectType === 'Cio' ? 'Calculated Insight'
        : nodeData.dataObjectType === 'Dlo' ? 'Data Lake Object'
        : 'Data Model Object';
      const sharedLabel = nodeData.tableType === 'Shared' ? ' <span class="sidebar-shared-badge">Shared Table</span>' : '';
      const baseLabel = nodeData.baseModelApiName ? ' <span class="sidebar-base-badge">Base: ' + (baseModelLabels[nodeData.baseModelApiName] || nodeData.baseModelApiName) + '</span>' : '';
      const unmappedLabel = nodeData.unmapped ? ' <span class="sidebar-unmapped-badge">Unmapped</span>' : '';
      root.querySelector('#sidebar-title').innerHTML = nodeData.label + diffBadgeHtml(nodeData.diffStatus) + sharedLabel + baseLabel + unmappedLabel;
      root.querySelector('#sidebar-type').textContent = typeLabel;
      root.querySelector('#sidebar-api').textContent = nodeData.id;
      
      const content = root.querySelector('#sidebar-content');
      const dims = nodeData.dimensions || [];
      const meas = nodeData.measurements || [];
      const calcDims = (nodeData.relatedCalcDims || []).filter(c => !c.isSystemDefinition);
      const calcMeas = (nodeData.relatedCalcMeas || []).filter(c => !c.isSystemDefinition);
      const hiers = nodeData.relatedHierarchies || [];
      const metrics = nodeData.relatedMetrics || [];
      const groupings = nodeData.relatedGroupings || [];
      
      let html = '';
      
      // Dimensions
      var isLV = nodeData.type === 'logicalView';
      html += buildSidebarSection('dim', 'Dimensions', dims, d =>
        '<div><div class="field-name">' + (d.label || d.apiName) + '</div><div class="field-api">' + d.apiName + '</div>' +
        (isLV && d.sourceObject ? '<div class="field-source">from ' + d.sourceObject + '</div>' : '') +
        '</div>' +
        '<span class="field-type">' + (d.dataType || 'Text') + '</span>'
      );
      
      // Measurements
      html += buildSidebarSection('meas', 'Measurements', meas, m =>
        '<div><div class="field-name">' + (m.label || m.apiName) + '</div><div class="field-api">' + m.apiName + '</div>' +
        (isLV && m.sourceObject ? '<div class="field-source">from ' + m.sourceObject + '</div>' : '') +
        '</div>' +
        '<span class="field-type">' + (m.dataType || 'Number') + '</span>'
      );
      
      // Calc Dimensions
      if (calcDims.length > 0) {
        html += buildSidebarSection('calc', 'Calc Dimensions', calcDims, c =>
          '<div><div class="field-name">' + (c.label || c.apiName) + '</div><div class="field-api">' + c.apiName + '</div>' +
          (c.placement === 'crossObject' ? '<div class="field-placement cross">' + c.placement + '</div><div class="field-refs">→ ' + (c.referencedObjects || []).join(', ') + '</div>' : '') +
          '</div><span class="field-type">' + (c.dataType || 'Calc') + '</span>'
        );
      }
      
      // Calc Measurements
      if (calcMeas.length > 0) {
        html += buildSidebarSection('calc', 'Calc Measurements', calcMeas, c =>
          '<div><div class="field-name">' + (c.label || c.apiName) + '</div><div class="field-api">' + c.apiName + '</div>' +
          (c.placement === 'crossObject' ? '<div class="field-placement cross">' + c.placement + '</div><div class="field-refs">→ ' + (c.referencedObjects || []).join(', ') + '</div>' : '') +
          '</div><span class="field-type">' + (c.dataType || 'Calc') + '</span>'
        );
      }
      
      // Hierarchies
      if (hiers.length > 0) {
        html += buildSidebarSection('hier', 'Dim Hierarchies', hiers, h =>
          '<div><div class="field-name">' + (h.label || h.apiName) + '</div><div class="field-api">' + h.apiName + '</div>' +
          (h.placement === 'crossObject' ? '<div class="field-placement cross">' + h.placement + '</div><div class="field-refs">→ ' + (h.referencedObjects || []).join(', ') + '</div>' : '') +
          '</div><span class="field-type">Hierarchy</span>'
        );
      }
      
      // Metrics
      if (metrics.length > 0) {
        html += buildSidebarSection('met', 'Metrics', metrics, m =>
          '<div><div class="field-name">' + (m.label || m.apiName) + '</div><div class="field-api">' + m.apiName + '</div>' +
          (m.placement === 'crossObject' ? '<div class="field-placement cross">' + m.placement + '</div><div class="field-refs">→ ' + (m.referencedObjects || []).join(', ') + '</div>' : '') +
          '</div><span class="field-type">' + (m.aggregationType || 'Metric') + '</span>'
        );
      }
      
      // Groupings
      if (groupings.length > 0) {
        html += buildSidebarSection('grp', 'Groupings', groupings, g =>
          '<div><div class="field-name">' + (g.label || g.apiName) + '</div><div class="field-api">' + g.apiName + '</div>' +
          '</div><span class="field-type">' + (g.type || 'Group') + '</span>'
        );
      }
      
      content.innerHTML = html;
      sidebar.classList.add('open');
      
      const actionsDiv = root.querySelector('#sidebar-actions');
      if ((nodeData.type === 'dataObject' || nodeData.type === 'logicalView') && (dims.length > 0 || meas.length > 0) && !nodeData.unmapped) {
        actionsDiv.style.display = 'block';
        currentQueryNode = nodeData;
      } else {
        actionsDiv.style.display = 'none';
        currentQueryNode = null;
      }
    }
    
    function openEntitySidebar(ent) {
      const typeLabelMap = {
        'calc-dim': 'Calculated Dimension',
        'calc-meas': 'Calculated Measurement',
        'dim-hier': 'Dimension Hierarchy',
        'metric': 'Metric',
        'grouping': 'Grouping'
      };
      
      const iconHtml = entitySvgIcons[ent.cssClass || ent.type]
        ? '<span class="entity-type-badge ' + (ent.cssClass || ent.type) + '">' + entitySvgIcons[ent.cssClass || ent.type] + ' ' + (typeLabelMap[ent.type] || ent.typeLabel || 'Entity') + '</span>'
        : '<span class="entity-type-badge ' + (ent.cssClass || ent.type) + '">' + (typeLabelMap[ent.type] || ent.typeLabel || 'Entity') + '</span>';
      
      const entBaseLabel = ent.baseModelApiName ? ' <span class="sidebar-base-badge">Base: ' + (baseModelLabels[ent.baseModelApiName] || ent.baseModelApiName) + '</span>' : '';
      root.querySelector('#sidebar-title').innerHTML = (ent.label || ent.apiName) + diffBadgeHtml(ent.diffStatus) + entBaseLabel;
      root.querySelector('#sidebar-type').innerHTML = iconHtml;
      root.querySelector('#sidebar-api').textContent = ent.apiName;
      
      const content = root.querySelector('#sidebar-content');
      let html = '<div class="entity-detail">';
      
      // --- Calc Dimension / Calc Measurement ---
      if (ent.type === 'calc-dim' || ent.type === 'calc-meas') {
        const calcInfo = calcFieldsLookup[ent.apiName];
        
        // Expression
        if (ent.expression) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Expression</div>';
          html += '<div class="entity-expression">' + escapeHtmlStr(ent.expression) + '</div>';
          html += '</div>';
        }
        
        // Properties
        html += '<div class="entity-detail-section">';
        html += '<div class="entity-detail-section-title">Properties</div>';
        html += '<div class="entity-kv"><span class="entity-kv-label">Data Type</span><span class="entity-kv-value">' + (ent.dataType || 'N/A') + '</span></div>';
        if (ent.placement === 'crossObject') { html += '<div class="entity-kv"><span class="entity-kv-label">Placement</span><span class="entity-kv-value"><span class="entity-placement-badge crossObject">' + ent.placement + '</span></span></div>'; }
        html += '</div>';
        
        // Referenced Objects
        const refs = ent.referencedObjects || [];
        if (refs.length > 0) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Referenced Objects</div>';
          html += '<ul class="entity-ref-list">';
          refs.forEach(function(objApiName) {
            const nd = nodes.find(function(n) { return n.id === objApiName; });
            const lbl = nd ? nd.label : objApiName.replace(/_/g, ' ');
            html += '<li class="entity-ref-item"><span class="entity-ref-icon obj">O</span><div><div style="color:#080707;font-size:12px">' + lbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + objApiName + '</div></div></li>';
          });
          html += '</ul></div>';
        }
        
        // Dependency Chain (tree)
        if (calcInfo && calcInfo.directReferences && calcInfo.directReferences.length > 0) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Dependency Chain</div>';
          html += '<div class="entity-chain">';

          var visited = {};
          visited[ent.apiName] = true;
          function buildChainTree(apiName) {
            var children = [];
            var seen = {};
            var info = calcFieldsLookup[apiName];
            if (!info || !info.directReferences) return children;
            info.directReferences.forEach(function(ref) {
              if (ref.objectApiName) {
                var key = ref.objectApiName + '.' + ref.fieldApiName;
                if (seen[key]) return;
                seen[key] = true;
                var nd2 = nodes.find(function(n) { return n.id === ref.objectApiName; });
                var objLbl = nd2 ? nd2.label : ref.objectApiName.replace(/_/g, ' ');
                children.push({ name: objLbl + '.' + ref.fieldApiName, type: 'Object Field', children: [] });
              } else {
                var refName = ref.fieldApiName;
                if (seen[refName]) return;
                seen[refName] = true;
                var refCalc = calcFieldsLookup[refName];
                if (refCalc && !visited[refName]) {
                  visited[refName] = true;
                  var subChildren = buildChainTree(refName);
                  children.push({ name: refCalc.label || refName, api: refName, type: refCalc.entityType === 'calculatedDimension' ? 'Calc Dimension' : 'Calc Measurement', children: subChildren });
                } else if (!refCalc) {
                  children.push({ name: refName, type: 'Parameter / Other', children: [] });
                }
              }
            });
            return children;
          }
          var rootChildren = buildChainTree(ent.apiName);
          function renderChainNode(node, isRoot) {
            html += '<div class="entity-chain-node' + (isRoot ? ' entity-chain-root' : '') + '">';
            html += '<div class="entity-chain-step' + (isRoot ? ' current' : '') + '"><div class="entity-chain-step-name">' + node.name + '</div>';
            if (node.api) html += '<div class="entity-chain-step-api">' + node.api + '</div>';
            html += '<div class="entity-chain-step-type">' + node.type + '</div></div>';
            if (node.children && node.children.length > 0) {
              node.children.forEach(function(child) { renderChainNode(child, false); });
            }
            html += '</div>';
          }
          var rootNode = { name: ent.label || ent.apiName, type: typeLabelMap[ent.type] || 'Calc', children: rootChildren };
          renderChainNode(rootNode, true);

          html += '</div></div>';
        }
      }
      
      // --- Dimension Hierarchy ---
      if (ent.type === 'dim-hier') {
        // Levels
        var levels = ent.levels || [];
        if (levels.length > 0) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Hierarchy Levels (' + levels.length + ')</div>';
          levels.sort(function(a, b) { return (a.position || 0) - (b.position || 0); });
          levels.forEach(function(lvl) {
            var fieldName = lvl.definitionFieldName || lvl.definitionApiName;
            var sourceName = lvl.definitionApiName || '';
            var nd3 = nodes.find(function(n) { return n.id === sourceName; });
            var srcLabel = nd3 ? nd3.label : sourceName.replace(/_/g, ' ');
            html += '<div class="hier-level">';
            html += '<div class="hier-level-pos">' + (lvl.position || '?') + '</div>';
            html += '<div class="hier-level-info"><div class="hier-level-field">' + fieldName.replace(/_/g, ' ') + '</div><div class="hier-level-source">' + srcLabel + ' → ' + fieldName + '</div></div>';
            html += '</div>';
          });
          html += '</div>';
        }
        
        // Properties
        html += '<div class="entity-detail-section">';
        html += '<div class="entity-detail-section-title">Properties</div>';
        if (ent.placement === 'crossObject') { html += '<div class="entity-kv"><span class="entity-kv-label">Placement</span><span class="entity-kv-value"><span class="entity-placement-badge crossObject">' + ent.placement + '</span></span></div>'; }
        html += '<div class="entity-kv"><span class="entity-kv-label">Levels</span><span class="entity-kv-value">' + levels.length + '</span></div>';
        html += '</div>';
        
        // Referenced Objects
        var hierRefs = ent.referencedObjects || [];
        if (hierRefs.length > 0) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Referenced Objects</div>';
          html += '<ul class="entity-ref-list">';
          hierRefs.forEach(function(objApiName) {
            var nd4 = nodes.find(function(n) { return n.id === objApiName; });
            var lbl = nd4 ? nd4.label : objApiName.replace(/_/g, ' ');
            html += '<li class="entity-ref-item"><span class="entity-ref-icon obj">O</span><div><div style="color:#080707;font-size:12px">' + lbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + objApiName + '</div></div></li>';
          });
          html += '</ul></div>';
        }
      }
      
      // --- Metric ---
      if (ent.type === 'metric') {
        html += '<div class="entity-detail-section">';
        html += '<div class="entity-detail-section-title">Properties</div>';
        html += '<div class="entity-kv"><span class="entity-kv-label">Aggregation</span><span class="entity-kv-value">' + (ent.aggregationType || 'N/A') + '</span></div>';
        if (ent.placement === 'crossObject') { html += '<div class="entity-kv"><span class="entity-kv-label">Placement</span><span class="entity-kv-value"><span class="entity-placement-badge crossObject">' + ent.placement + '</span></span></div>'; }
        if (ent.timeGrains && ent.timeGrains.length > 0) {
          html += '<div class="entity-kv"><span class="entity-kv-label">Time Grains</span><span class="entity-kv-value">' + ent.timeGrains.join(', ') + '</span></div>';
        }
        html += '</div>';
        
        // Measurement Reference
        if (ent.measurementRef) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Measurement Reference</div>';
          html += '<ul class="entity-ref-list">';
          if (ent.measurementRef.calcField) {
            var calcRef = calcFieldsLookup[ent.measurementRef.calcField];
            var calcLbl = calcRef ? calcRef.label : ent.measurementRef.calcField.replace(/_/g, ' ');
            html += '<li class="entity-ref-item"><span class="entity-ref-icon calc">C</span><div><div style="color:#080707;font-size:12px">' + calcLbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + ent.measurementRef.calcField + '</div></div></li>';
          } else {
            var mnd = nodes.find(function(n) { return n.id === ent.measurementRef.table; });
            var mLbl = mnd ? mnd.label : (ent.measurementRef.table || '').replace(/_/g, ' ');
            html += '<li class="entity-ref-item"><span class="entity-ref-icon field">F</span><div><div style="color:#080707;font-size:12px">' + (ent.measurementRef.field || '').replace(/_/g, ' ') + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + mLbl + '.' + ent.measurementRef.field + '</div></div></li>';
          }
          html += '</ul></div>';
        }
        
        // Time Dimension Reference
        if (ent.timeDimRef) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Time Dimension Reference</div>';
          html += '<ul class="entity-ref-list">';
          var tnd = nodes.find(function(n) { return n.id === ent.timeDimRef.table; });
          var tLbl = tnd ? tnd.label : (ent.timeDimRef.table || '').replace(/_/g, ' ');
          html += '<li class="entity-ref-item"><span class="entity-ref-icon field">T</span><div><div style="color:#080707;font-size:12px">' + (ent.timeDimRef.field || '').replace(/_/g, ' ') + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + tLbl + '.' + ent.timeDimRef.field + '</div></div></li>';
          html += '</ul></div>';
        }
        
        // Referenced Objects
        var metRefs = ent.referencedObjects || [];
        if (metRefs.length > 0) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Referenced Objects</div>';
          html += '<ul class="entity-ref-list">';
          metRefs.forEach(function(objApiName) {
            var nd5 = nodes.find(function(n) { return n.id === objApiName; });
            var lbl = nd5 ? nd5.label : objApiName.replace(/_/g, ' ');
            html += '<li class="entity-ref-item"><span class="entity-ref-icon obj">O</span><div><div style="color:#080707;font-size:12px">' + lbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + objApiName + '</div></div></li>';
          });
          html += '</ul></div>';
        }
      }
      
      // --- Grouping ---
      if (ent.type === 'grouping') {
        html += '<div class="entity-detail-section">';
        html += '<div class="entity-detail-section-title">Properties</div>';
        html += '<div class="entity-kv"><span class="entity-kv-label">Grouping Type</span><span class="entity-kv-value">' + (ent.origType || 'N/A') + '</span></div>';
        if (ent.placement === 'crossObject') { html += '<div class="entity-kv"><span class="entity-kv-label">Placement</span><span class="entity-kv-value"><span class="entity-placement-badge crossObject">' + ent.placement + '</span></span></div>'; }
        html += '</div>';
        
        // Field Reference
        if (ent.fieldRef) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Source Field</div>';
          html += '<ul class="entity-ref-list">';
          var gnd = nodes.find(function(n) { return n.id === ent.fieldRef.table; });
          var gLbl = gnd ? gnd.label : (ent.fieldRef.table || '').replace(/_/g, ' ');
          html += '<li class="entity-ref-item"><span class="entity-ref-icon field">F</span><div><div style="color:#080707;font-size:12px">' + (ent.fieldRef.field || '').replace(/_/g, ' ') + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + gLbl + '.' + ent.fieldRef.field + '</div></div></li>';
          html += '</ul></div>';
        }
        
        // Referenced Objects
        var grpRefs = ent.referencedObjects || [];
        if (grpRefs.length > 0) {
          html += '<div class="entity-detail-section">';
          html += '<div class="entity-detail-section-title">Referenced Objects</div>';
          html += '<ul class="entity-ref-list">';
          grpRefs.forEach(function(objApiName) {
            var nd6 = nodes.find(function(n) { return n.id === objApiName; });
            var lbl = nd6 ? nd6.label : objApiName.replace(/_/g, ' ');
            html += '<li class="entity-ref-item"><span class="entity-ref-icon obj">O</span><div><div style="color:#080707;font-size:12px">' + lbl + '</div><div style="color:#706e6b;font-size:10px;font-family:monospace">' + objApiName + '</div></div></li>';
          });
          html += '</ul></div>';
        }
      }
      
      html += '</div>';
      content.innerHTML = html;
      sidebar.classList.add('open');
      root.querySelector('#sidebar-actions').style.display = 'none';
    }
    
    function escapeHtmlStr(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    
    function buildSidebarSection(dotClass, title, items, renderItem) {
      let html = '<div class="sidebar-section">';
      html += '<div class="sidebar-section-header">';
      html += '<span class="sidebar-section-title"><span class="dot ' + dotClass + '"></span> ' + title + '</span>';
      html += '<span class="sidebar-section-count">' + items.length + '</span>';
      html += '</div><div class="sidebar-section-body">';
      if (items.length === 0) {
        html += '<div class="empty-state">None</div>';
      } else {
        items.forEach(item => { html += '<div class="field-item">' + renderItem(item) + '</div>'; });
      }
      html += '</div></div>';
      return html;
    }
    
    function closeSidebar() { sidebar.classList.remove('open'); currentQueryNode = null; updateEmbeddedBackBtnPosition(); }
    
    function showCrossObjectEntities() {
      root.querySelector('#sidebar-title').textContent = 'Cross-Object Entities';
      root.querySelector('#sidebar-type').textContent = 'Bridges between objects';
      root.querySelector('#sidebar-api').textContent = crossObjectEntities.length + ' entities';
      
      const content = root.querySelector('#sidebar-content');
      let html = '';
      if (crossObjectEntities.length === 0) {
        html = '<div class="empty-state">No cross-object entities found</div>';
      } else {
        const typeMap = { calculatedDimension: 'Calc Dim', calculatedMeasurement: 'Calc Meas', dimensionHierarchy: 'Hierarchy', metric: 'Metric', grouping: 'Grouping' };
        html += '<div class="sidebar-section"><div class="sidebar-section-header">';
        html += '<span class="sidebar-section-title"><span class="dot calc"></span> Cross-Object</span>';
        html += '<span class="sidebar-section-count">' + crossObjectEntities.length + '</span>';
        html += '</div><div class="sidebar-section-body">';
        crossObjectEntities.forEach(e => {
          html += '<div class="field-item"><div>';
          html += '<div class="field-name">' + e.entityApiName + '</div>';
          html += '<div class="field-placement cross">' + (typeMap[e.entityType] || e.entityType) + '</div>';
          html += '<div class="field-refs">→ ' + (e.referencedObjects || []).join(', ') + '</div>';
          html += '</div></div>';
        });
        html += '</div></div>';
      }
      content.innerHTML = html;
      sidebar.classList.add('open');
      root.querySelector('#sidebar-actions').style.display = 'none';
    }
    
    // --- Query ---
    function runQuery() {
      if (!currentQueryNode) return;
      const btn = root.querySelector('#queryBtn');
      btn.disabled = true; btn.textContent = 'Querying...';
      
      const dims = currentQueryNode.dimensions || [];
      const meas = currentQueryNode.measurements || [];
      const fields = [
        ...dims.map(d => ({ apiName: d.apiName, label: d.label, dataType: d.dataType, dataObjectFieldName: d.dataObjectFieldName, tableApiName: currentQueryNode.id, fieldType: 'dimension' })),
        ...meas.map(m => ({ apiName: m.apiName, label: m.label, dataType: m.dataType, dataObjectFieldName: m.dataObjectFieldName, tableApiName: currentQueryNode.id, fieldType: 'measurement' }))
      ];
      
      vscode.postMessage({ command: 'runSemanticQuery', nodeId: currentQueryNode.id, nodeLabel: currentQueryNode.label, nodeType: currentQueryNode.type, dataObjectName: currentQueryNode.dataObjectName || currentQueryNode.id, fields });
      
      root.querySelector('#resultsBody').innerHTML = '<div class="results-loading">Running query...</div>';
      root.querySelector('#resultsPanel').classList.add('open');
    }
    
    function handleQueryResult(message) {
      const btn = root.querySelector('#queryBtn');
      btn.disabled = false; btn.textContent = 'Query Sample Data';
      
      if (!message.success) {
        root.querySelector('#resultsBody').innerHTML = '<div class="results-error">' + message.error + '</div>';
        root.querySelector('#rowCount').textContent = 'Error';
        return;
      }
      const data = message.data;
      if (data.status !== 'SUCCESS' || !data.queryResults) {
        root.querySelector('#resultsBody').innerHTML = '<div class="results-error">Query failed: ' + (data.message || 'Unknown') + '</div>';
        return;
      }
      const metadata = data.queryResults.queryMetadata?.fields || {};
      const rows = data.queryResults.queryData?.rows || [];
      const fieldLabels = message.fieldLabels || {};
      
      const columns = Object.entries(metadata).sort((a, b) => a[1].placeInOrder - b[1].placeInOrder).map(([name, info]) => ({ name, type: info.type, label: fieldLabels[name] || name }));
      
      if (columns.length === 0 || rows.length === 0) {
        root.querySelector('#resultsBody').innerHTML = '<div class="results-loading">No data returned</div>';
        root.querySelector('#rowCount').textContent = '0 rows';
        return;
      }
      
      let t = '<table class="results-table"><thead><tr>';
      columns.forEach(c => { t += '<th>' + c.label + '</th>'; });
      t += '</tr></thead><tbody>';
      rows.forEach(r => { t += '<tr>'; r.values.forEach(v => { t += '<td>' + (v === null ? '<em style="color:#706e6b">null</em>' : v) + '</td>'; }); t += '</tr>'; });
      t += '</tbody></table>';
      root.querySelector('#resultsBody').innerHTML = t;
      root.querySelector('#rowCount').textContent = rows.length + ' rows';
    }
    
    function closeResults() { root.querySelector('#resultsPanel').classList.remove('open'); }
    

    // --- Embedded mode: floating "Back to ERD" button inside the canvas ---
    if (embeddedMode) {
      var floatingBackBtn = document.createElement('button');
      floatingBackBtn.id = 'floatingBackBtn';
      floatingBackBtn.textContent = '← Back to ERD';
      floatingBackBtn.style.cssText = [
        'position:absolute',
        'top:12px',
        'left:12px',
        'z-index:200',
        'display:none',
        'padding:6px 14px',
        'background:#fff',
        'border:1px solid #dddbda',
        'border-radius:4px',
        'font-size:13px',
        'font-weight:500',
        'color:#0070d2',
        'cursor:pointer',
        'box-shadow:0 2px 4px rgba(0,0,0,0.12)',
        'transition:left 0.2s ease'
      ].join(';');
      floatingBackBtn.addEventListener('click', function() { exitDrillDown(); });
      erdContainer.appendChild(floatingBackBtn);
    }

    function showEmbeddedBackBtn() {
      if (!embeddedMode) return;
      var btn = root.querySelector('#floatingBackBtn');
      if (btn) btn.style.display = 'block';
      updateEmbeddedBackBtnPosition();
    }

    function hideEmbeddedBackBtn() {
      if (!embeddedMode) return;
      var btn = root.querySelector('#floatingBackBtn');
      if (btn) btn.style.display = 'none';
    }

    function updateEmbeddedBackBtnPosition() {
      if (!embeddedMode) return;
      var btn = root.querySelector('#floatingBackBtn');
      if (!btn) return;
      var sidebarOpen = sidebar && sidebar.classList.contains('open');
      var leftPanelEl = root.querySelector('#leftPanel');
      var lpWidth = leftPanelEl ? leftPanelEl.offsetWidth : 48;
      btn.style.left = (lpWidth + 12) + 'px';
    }

        // --- Pan/Zoom ---
    function updateView() { viewport.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')'; }
    
    erdContainer.addEventListener('mousedown', (e) => {
      if (e.target === erdContainer || e.target === viewport || e.target === svg) {
        isPanning = true;
        panStartX = e.clientX - panX; panStartY = e.clientY - panY;
        erdContainer.style.cursor = 'grabbing';
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      var cRect = erdContainer.getBoundingClientRect();
      if (draggingNode && currentView === 'grouped') {
        var newX = (e.clientX - cRect.left - panX) / scale - dragOffsetX;
        var newY = (e.clientY - cRect.top - panY) / scale - dragOffsetY;
        if (draggingNode.startsWith('grp_')) {
          var gName = draggingNode.substring(4);
          var oldCenter = getGroupCenter(gName);
          groupNodePositions[gName] = { x: newX, y: newY };
          var gEl = groupNodeElements[gName];
          if (gEl) { gEl.style.left = newX + 'px'; gEl.style.top = newY + 'px'; }
          if (expandedGroups.has(gName)) {
            var newCenter = getGroupCenter(gName);
            var deltaX = newCenter.x - oldCenter.x;
            var deltaY = newCenter.y - oldCenter.y;
            var gg = groupNodesList.find(function(g) { return g.name === gName; });
            if (gg) {
              gg.objects.forEach(function(objId) {
                var ep = groupEntityPositions[objId];
                if (ep) {
                  ep.x += deltaX;
                  ep.y += deltaY;
                  var eEl = groupEntityElements[objId];
                  if (eEl) { eEl.style.left = ep.x + 'px'; eEl.style.top = ep.y + 'px'; }
                }
              });
            }
            positionGroupRect(gName);
          }
          redrawGroupEdges();
        } else if (draggingNode.startsWith('gent_')) {
          var entId = draggingNode.substring(5);
          groupEntityPositions[entId] = { x: newX, y: newY };
          var entEl = groupEntityElements[entId];
          if (entEl) { entEl.style.left = newX + 'px'; entEl.style.top = newY + 'px'; }
          redrawGroupEdges();
        }
      } else if (draggingNode && currentView === 'top') {
        const pos = nodePositions[draggingNode];
        const el = nodeElements[draggingNode];
        pos.x = (e.clientX - cRect.left - panX) / scale - dragOffsetX;
        pos.y = (e.clientY - cRect.top - panY) / scale - dragOffsetY;
        el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
        drawEdges();
      } else if (draggingNode && currentView === 'drilldown') {
        const pos = ddPositions[draggingNode];
        const el = ddElements[draggingNode];
        if (pos && el) {
          const newX = (e.clientX - panX) / scale - dragOffsetX;
          const newY = (e.clientY - cRect.top - panY) / scale - dragOffsetY;
          let halfSize = ENTITY_SIZE / 2;
          if (draggingNode === '__center__') halfSize = 60;
          else if (draggingNode.startsWith('eobj_')) halfSize = EDGE_OBJ_SIZE / 2;
          pos.x = newX + halfSize;
          pos.y = newY + halfSize;
          el.style.left = (pos.x - halfSize) + 'px';
          el.style.top = (pos.y - halfSize) + 'px';
          if (draggingNode === '__center__') {
            ddCenterPos = pos;
          }
          drawDrillEdges();
        }
      } else if (isPanning) {
        panX = e.clientX - panStartX; panY = e.clientY - panStartY;
        updateView();
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (draggingNode && currentView === 'grouped') {
        if (draggingNode.startsWith('grp_')) {
          var gName = draggingNode.substring(4);
          if (isGridMode && groupNodePositions[gName]) {
            snapDraggedNode(groupNodePositions, gName, getGridCellSize('groupCircle'), groupNodeElements);
            if (expandedGroups.has(gName)) { positionGroupRect(gName); }
            redrawGroupEdges();
          }
          var gp = groupNodePositions[gName];
          if (gp) saveCachedPosition('grp_' + gName, gp.x, gp.y);
        } else if (draggingNode.startsWith('gent_')) {
          var entId = draggingNode.substring(5);
          if (isGridMode && groupEntityPositions[entId]) {
            snapDraggedNode(groupEntityPositions, entId, getGridCellSize('groupEntity'), groupEntityElements);
            redrawGroupEdges();
          }
          var ep = groupEntityPositions[entId];
          if (ep) saveCachedPosition(entId, ep.x, ep.y);
        }
      } else if (draggingNode && currentView === 'top' && nodePositions[draggingNode]) {
        if (isGridMode) {
          snapDraggedNode(nodePositions, draggingNode, getGridCellSize('top'), nodeElements);
          drawEdges();
        }
        const pos = nodePositions[draggingNode];
        saveCachedPosition(draggingNode, pos.x, pos.y);
      } else if (draggingNode && currentView === 'drilldown' && ddPositions[draggingNode]) {
        if (isGridMode) {
          var ddCs = getGridCellSize('drilldown');
          var ddOcc = buildOccupancyMap(ddPositions, ddCs, draggingNode);
          var ddTarget = posToCell(ddPositions[draggingNode].x, ddPositions[draggingNode].y, ddCs);
          var ddFree = findNearestFreeCell(ddTarget.col, ddTarget.row, ddOcc);
          var ddSnap = cellToPos(ddFree.col, ddFree.row, ddCs);
          ddPositions[draggingNode].x = ddSnap.x;
          ddPositions[draggingNode].y = ddSnap.y;
          var ddEl = ddElements[draggingNode];
          if (ddEl) {
            var hs = ENTITY_SIZE / 2;
            if (draggingNode === '__center__') hs = 60;
            else if (draggingNode.startsWith('eobj_')) hs = EDGE_OBJ_SIZE / 2;
            ddEl.style.transition = 'left 0.15s ease, top 0.15s ease';
            ddEl.style.left = (ddSnap.x - hs) + 'px';
            ddEl.style.top = (ddSnap.y - hs) + 'px';
            setTimeout(function() { ddEl.style.transition = ''; }, 160);
          }
          if (draggingNode === '__center__') ddCenterPos = ddPositions[draggingNode];
          drawDrillEdges();
        }
        const pos = ddPositions[draggingNode];
        saveCachedPosition(draggingNode, pos.x, pos.y);
      }
      draggingNode = null; isPanning = false;
      erdContainer.style.cursor = 'grab';
    });
    
    var wheelAccum = 0;
    var wheelActive = false;
    var wheelTimer = null;
    var WHEEL_THRESHOLD = 40;
    var WHEEL_IDLE_MS = 200;
    var ZOOM_SPEED = 0.002;

    erdContainer.addEventListener('wheel', (e) => {
      var lp = root.querySelector('#leftPanel');
      if (lp && lp.contains(e.target)) return;
      e.preventDefault();

      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function() { wheelActive = false; wheelAccum = 0; }, WHEEL_IDLE_MS);

      if (!wheelActive) {
        wheelAccum += e.deltaY;
        if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
        wheelActive = true;
      }

      const delta = 1 - e.deltaY * ZOOM_SPEED;
      const newScale = Math.max(0.2, Math.min(3, scale * delta));
      const rect = erdContainer.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      panX = mx - (mx - panX) * (newScale / scale);
      panY = my - (my - panY) * (newScale / scale);
      scale = newScale;
      updateView();
    });
    
    function zoomIn() { scale = Math.min(3, scale * 1.2); updateView(); }
    function zoomOut() { scale = Math.max(0.2, scale / 1.2); updateView(); }
    function resetView() { if (currentView === 'grouped') { fitGroupedViewport(); } else if (currentView === 'listGrouped') { fitListGroupedViewport(listGroupTotalH); } else { fitToViewport(); } }

    function toggleGridMode() {
      isGridMode = !isGridMode;
      var btn = root.querySelector('#gridToggleBtn');
      if (isGridMode) {
        btn.classList.add('route-active');
        btn.title = 'Grid Snap: ON';
        if (currentView === 'top') {
          snapAllToGrid(nodePositions, getGridCellSize('top'));
          Object.keys(nodePositions).forEach(function(id) {
            var el = nodeElements[id];
            if (el) { el.style.left = nodePositions[id].x + 'px'; el.style.top = nodePositions[id].y + 'px'; }
          });
          drawEdges();
          saveAllCachedPositions(nodePositions);
        } else if (currentView === 'grouped') {
          snapAllToGrid(groupNodePositions, getGridCellSize('groupCircle'));
          Object.keys(groupNodePositions).forEach(function(gn) {
            var gEl = groupNodeElements[gn];
            if (gEl) { gEl.style.left = groupNodePositions[gn].x + 'px'; gEl.style.top = groupNodePositions[gn].y + 'px'; }
            if (expandedGroups.has(gn)) { positionGroupRect(gn); }
          });
          redrawGroupEdges();
        } else if (currentView === 'drilldown') {
          snapAllToGrid(ddPositions, getGridCellSize('drilldown'));
          Object.keys(ddPositions).forEach(function(id) {
            var el = ddElements[id];
            if (!el) return;
            var hs = ENTITY_SIZE / 2;
            if (id === '__center__') hs = 60;
            else if (id.startsWith('eobj_')) hs = EDGE_OBJ_SIZE / 2;
            el.style.left = (ddPositions[id].x - hs) + 'px';
            el.style.top = (ddPositions[id].y - hs) + 'px';
          });
          drawDrillEdges();
          saveAllCachedPositions(ddPositions);
        }
      } else {
        btn.classList.remove('route-active');
        btn.title = 'Grid Snap: OFF';
      }
    }

    function runAutoLayout() {
      if (currentView === 'top') {
        cachedPositions = {};
        clearCachedPositions('topLevel');
        var visibleNodes = showUnmapped ? nodes : nodes.filter(function(n) { return !n.unmapped; });
        var visibleEdges = edges.filter(function(e) {
          var fromV = visibleNodes.some(function(n) { return n.id === e.from; });
          var toV = visibleNodes.some(function(n) { return n.id === e.to; });
          return fromV && toV;
        });
        nodePositions = {};
        if (layoutMode === 'grid') {
          layoutGrid(visibleNodes);
        } else {
          layoutForceAtlas2(visibleNodes, visibleEdges, true);
        }
        Object.keys(nodePositions).forEach(function(id) {
          var el = nodeElements[id];
          if (el) {
            el.style.transition = 'left 0.3s ease, top 0.3s ease';
            el.style.left = nodePositions[id].x + 'px';
            el.style.top = nodePositions[id].y + 'px';
          }
        });
        setTimeout(function() {
          Object.keys(nodeElements).forEach(function(id) { nodeElements[id].style.transition = ''; });
        }, 320);
        if (!hideRelationships) {
          drawEdges();
        }
        fitToViewport();
        if (layoutMode !== 'grid') {
          saveAllCachedPositions(nodePositions);
        }
      } else if (currentView === 'grouped') {
        clearCachedPositions('topLevel');
        groupNodePositions = {};
        layoutGroupForce();
        Object.keys(groupNodePositions).forEach(function(gn) {
          var gEl = groupNodeElements[gn];
          if (gEl) {
            gEl.style.transition = 'left 0.3s ease, top 0.3s ease';
            gEl.style.left = groupNodePositions[gn].x + 'px';
            gEl.style.top = groupNodePositions[gn].y + 'px';
          }
          if (expandedGroups.has(gn)) {
            layoutEntitiesForceDirected(gn);
            positionGroupRect(gn);
            var gg = groupNodesList.find(function(g) { return g.name === gn; });
            if (gg) {
              gg.objects.forEach(function(objId) {
                var ePos = groupEntityPositions[objId];
                var eEl = groupEntityElements[objId];
                if (ePos && eEl) {
                  eEl.style.transition = 'left 0.3s ease, top 0.3s ease';
                  eEl.style.left = ePos.x + 'px';
                  eEl.style.top = ePos.y + 'px';
                }
              });
            }
          }
        });
        setTimeout(function() {
          Object.keys(groupNodeElements).forEach(function(gn) { groupNodeElements[gn].style.transition = ''; });
          Object.keys(groupEntityElements).forEach(function(id) { groupEntityElements[id].style.transition = ''; });
        }, 320);
        redrawGroupEdges();
        fitGroupedViewport();
        var allPos = {};
        Object.keys(groupNodePositions).forEach(function(gn) {
          allPos['grp_' + gn] = groupNodePositions[gn];
        });
        Object.keys(groupEntityPositions).forEach(function(id) {
          allPos[id] = groupEntityPositions[id];
        });
        saveAllCachedPositions(allPos);
      } else if (currentView === 'drilldown') {
        clearCachedPositions('drilldown:' + ddCenterId);
        var drillNodes2 = [{ id: '__center__', type: 'center' }];
        var drillEdges2 = [];
        var entApiNames2 = {};
        ddEntities.forEach(function(e) { entApiNames2[e.apiName] = true; });

        ddEntities.forEach(function(ent) {
          drillNodes2.push({ id: 'ent_' + ent.apiName, type: 'entity' });
          var lookup = calcFieldsLookup[ent.apiName];
          var directRefs = lookup ? lookup.directReferences || [] : [];
          var refsOtherCalcs = false;
          var addedCalcEdges2 = {};

          directRefs.forEach(function(ref) {
            if (!ref.objectApiName && ref.fieldApiName && entApiNames2[ref.fieldApiName]) {
              var edgeKey = 'ent_' + ent.apiName + '>' + 'ent_' + ref.fieldApiName;
              if (addedCalcEdges2[edgeKey]) return;
              addedCalcEdges2[edgeKey] = true;
              drillEdges2.push({ from: 'ent_' + ent.apiName, to: 'ent_' + ref.fieldApiName });
              refsOtherCalcs = true;
            }
          });

          var refsCenter2 = false;
          directRefs.forEach(function(ref) {
            if (ref.objectApiName === ddCenterId) refsCenter2 = true;
          });

          var referencesCenter2 = (ent.referencedObjects || []).indexOf(ddCenterId) >= 0;
          if (refsCenter2 || (!refsOtherCalcs && referencesCenter2)) {
            drillEdges2.push({ from: '__center__', to: 'ent_' + ent.apiName });
          }
        });

        Array.from(ddEdgeObjectIds).forEach(function(objId) { drillNodes2.push({ id: 'eobj_' + objId, type: 'edgeObj' }); });
        ddEntities.forEach(function(ent) {
          var directObjSet3 = new Set();
          var cl3 = calcFieldsLookup[ent.apiName];
          if (cl3 && cl3.directReferences) {
            cl3.directReferences.forEach(function(r) { if (r.objectApiName) directObjSet3.add(r.objectApiName); });
          } else {
            (ent.referencedObjects || []).forEach(function(o) { directObjSet3.add(o); });
          }
          directObjSet3.forEach(function(o) {
            if (o !== ddCenterId && ddEdgeObjectIds.has(o)) {
              drillEdges2.push({ from: 'ent_' + ent.apiName, to: 'eobj_' + o });
            }
          });
        });

        var newDdPositions = layoutDrillDown(drillNodes2, drillEdges2);
        snapAllToGrid(newDdPositions, getGridCellSize('drilldown'));
        Object.keys(newDdPositions).forEach(function(k) { ddPositions[k] = newDdPositions[k]; });
        ddCenterPos = ddPositions['__center__'];

        Object.keys(ddElements).forEach(function(key) {
          var el = ddElements[key];
          var pos = ddPositions[key];
          if (!el || !pos) return;
          var hs = ENTITY_SIZE / 2;
          if (key === '__center__') hs = 60;
          else if (key.startsWith('eobj_')) hs = EDGE_OBJ_SIZE / 2;
          el.style.transition = 'left 0.3s ease, top 0.3s ease';
          el.style.left = (pos.x - hs) + 'px';
          el.style.top = (pos.y - hs) + 'px';
        });
        setTimeout(function() {
          Object.keys(ddElements).forEach(function(key) { if (ddElements[key]) ddElements[key].style.transition = ''; });
        }, 320);
        drawDrillEdges();
        saveAllCachedPositions(ddPositions);
      }
    }

    function setRoutingMode(mode) {
      routingMode = mode;
      root.querySelectorAll('#routingControls button').forEach(function(b) { b.classList.remove('route-active'); });
      var btnId = mode === 'orthogonal' ? 'routeOrthBtn' : mode === 'curved' ? 'routeCurvedBtn' : mode === 'classic' ? 'routeClassicBtn' : 'routeStraightBtn';
      root.querySelector('#' + btnId).classList.add('route-active');
      root.querySelectorAll('.edge-label').forEach(function(el) {
        if (mode === 'classic') el.classList.add('edge-label-classic');
        else el.classList.remove('edge-label-classic');
      });
      if (currentView === 'drilldown') { drawDrillEdges(); }
      else if (currentView === 'grouped') { redrawGroupEdges(); }
      else { drawEdges(); }
    }

    function setUnmappedVisibility(visible) {
      if (showUnmapped === visible) return;
      showUnmapped = visible;
      var btn = root.querySelector('#unmappedToggleBtn');
      if (btn) {
        btn.classList.toggle('route-active', showUnmapped);
        btn.title = showUnmapped ? 'Unmapped: Visible' : 'Unmapped: Hidden';
        var lbl = btn.querySelector('.lp-btn-label');
        if (lbl) lbl.textContent = showUnmapped ? 'Unmapped: Visible' : 'Unmapped: Hidden';
        var slash = btn.querySelector('.lp-slash');
        if (slash) slash.style.display = showUnmapped ? 'none' : '';
      }
      if (currentView === 'top') { renderTopLevel(true); }
      else if (currentView === 'grouped') { renderGroupedView(); }
      else if (currentView === 'listGrouped') { renderListGroupedView(); }
    }

    function toggleUnmapped() {
      setUnmappedVisibility(!showUnmapped);
    }
    
    function getLeftPanelWidth() {
      var lp = root.querySelector('#leftPanel');
      return lp ? lp.offsetWidth : 48;
    }

    function getAvailableWidth() {
      var w = erdContainer.clientWidth;
      w -= getLeftPanelWidth();
      var sb = root.querySelector('#sidebar');
      if (sb && sb.classList.contains('open')) w -= 350;
      var hp = root.querySelector('#historyPanel');
      if (hp && hp.classList.contains('visible')) w -= 350;
      return Math.max(w, 200);
    }

    function fitToViewport() {
      var isDrill = currentView === 'drilldown';
      var posMap = isDrill ? ddPositions : nodePositions;
      if (Object.keys(posMap).length === 0) return;
      var positions = Object.values(posMap);
      var xs = positions.map(function(p) { return p.x; });
      var ys = positions.map(function(p) { return p.y; });
      var itemSize = isDrill ? ENTITY_SIZE : NODE_SIZE;
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs) + itemSize + 40;
      var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys) + itemSize + 40;
      var w = maxX - minX, h = maxY - minY;
      var lpw = getLeftPanelWidth();
      var availW = getAvailableWidth();
      var availH = erdContainer.clientHeight;
      var sw = availW / (w + 100);
      var sh = availH / (h + 100);
      scale = Math.min(sw, sh, 1);
      panX = lpw + (availW - w * scale) / 2 - minX * scale;
      panY = (availH - h * scale) / 2 - minY * scale;
      updateView();
    }
    
    // --- Initial render (wait for cached positions, fallback after 500ms) ---
    setTimeout(() => {
      if (!initialRenderDone) {
        initialRenderDone = true;
        if (initialViewMode === 'listGrouped' && hasGroups) {
          renderListGroupedView();
        } else if (initialViewMode === 'grouped' && hasGroups) {
          renderGroupedView();
        } else {
          renderTopLevel();
          saveAllCachedPositions(nodePositions);
        }
      }
      if (hasUnmappedNodes) {
        var unmLegend = root.querySelector('#unmappedLegendItem');
        if (unmLegend) unmLegend.style.display = '';
        var indSec2 = root.querySelector('#indicatorsLegendSection');
        if (indSec2) indSec2.style.display = 'block';
      }
    }, 500);
    
    window.addEventListener('resize', () => {
      if (currentView === 'grouped') { redrawGroupEdges(); updateView(); }
      else if (currentView === 'top') { drawEdges(); updateView(); }
    });

    // --- Static DOM initialization (values previously injected via template literals) ---
    // Header title
    var viewSuffixInit = isCompareMode ? ' - Compare (Local vs Remote)' : ' - ERD V2';
    var headerTitleEl = root.querySelector('#headerTitle');
    if (headerTitleEl) headerTitleEl.textContent = modelLabel + viewSuffixInit;

    // History button visibility
    var historyBtnEl = root.querySelector('#historyBtn');
    if (historyBtnEl && isHistoryMode) historyBtnEl.style.display = '';

    // Group controls section
    var groupCtrl = root.querySelector('#groupControls');
    if (groupCtrl && hasGroups) groupCtrl.classList.add('visible');

    // Changes group section (compare mode)
    var changesGrpInit = root.querySelector('#changesGroup');
    if (changesGrpInit && isCompareMode) changesGrpInit.classList.add('visible');

    // Drill hint text
    var drillHintEl = root.querySelector('#drillHint');
    if (drillHintEl) drillHintEl.textContent = hasGroups ? 'Double-click a group to expand it' : 'Double-click an object to drill down';

    // Legend counts (previously injected via template literals in the shell HTML)
    updateLegendCounts();

    // Embedded mode (e.g. Salesforce core): hide the title header and remove the
    // 56px top offset from erdContainer/sidebar that compensates for the fixed header.
    if (embeddedMode) {
      var headerEl = root.querySelector('#header');
      if (headerEl) headerEl.style.display = 'none';

      var erdContainerEl = root.querySelector('#erdContainer');
      if (erdContainerEl) erdContainerEl.style.top = '0';

      var sidebarEl = root.querySelector('#sidebar');
      if (sidebarEl) { sidebarEl.style.top = '0'; sidebarEl.style.height = '100%'; }

      var historyPanelEl = root.querySelector('#historyPanel');
      if (historyPanelEl) { historyPanelEl.style.top = '0'; historyPanelEl.style.height = '100%'; }
    }

    // Unmapped nodes section visibility
    if (hasUnmappedNodes) {
      var unmGrpInit = root.querySelector('#unmappedGroup');
      if (unmGrpInit) unmGrpInit.classList.add('visible');
    }

    // --- History panel logic (only active when isHistoryMode) ---
    var historyCommits = commits;
    var historyViewMode = 'view';
    var selectedCommitHash = 'CURRENT';
    var baseCommitHash = null;
    var historyLoading = false;

    if (isHistoryMode) {
      var countEl = root.querySelector('#historyCommitCount');
      if (countEl) countEl.textContent = String(historyCommits.length);
      // Execute immediately — initErd is called after DOM is ready
      (function() {
        var autoPanel = root.querySelector('#historyPanel');
        if (autoPanel) {
          closeSidebar();
          autoPanel.classList.add('visible');
          renderHistoryPanel();
        }
      })();
    }

    function toggleHistoryPanel() {
      var panel = root.querySelector('#historyPanel');
      if (!panel) return;
      if (panel.classList.contains('visible')) {
        closeHistoryPanel();
      } else {
        closeSidebar();
        panel.classList.add('visible');
        renderHistoryPanel();
      }
    }

    function closeHistoryPanel() {
      var panel = root.querySelector('#historyPanel');
      if (panel) panel.classList.remove('visible');
    }

    function setHistoryMode(mode) {
      historyViewMode = mode;
      baseCommitHash = null;
      renderHistoryPanel();
    }

    function formatCommitDate(isoStr) {
      var d = new Date(isoStr);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }

    function truncateStr(str, len) {
      return str.length > len ? str.substring(0, len) + '...' : str;
    }

    function renderHistoryPanel() {
      var body = root.querySelector('#historyPanelBody');
      if (!body) return;
      var panel = root.querySelector('#historyPanel');
      var savedScroll = panel ? panel.scrollTop : 0;
      var html = '';

      html += '<div class="history-mode-toggle">';
      html += '<button class="history-mode-btn ' + (historyViewMode === 'view' ? 'active' : '') + '" data-action="setHistoryMode" data-arg="view">View</button>';
      html += '<button class="history-mode-btn ' + (historyViewMode === 'compare' ? 'active' : '') + '" data-action="setHistoryMode" data-arg="compare">Compare</button>';
      html += '</div>';

      html += '<div id="compareHintContainer">';
      if (historyViewMode === 'compare') {
        if (!baseCommitHash) {
          html += '<div class="compare-hint">Click a commit to set it as the <strong>base</strong> for comparison.</div>';
        } else {
          var baseLabel = baseCommitHash === 'CURRENT' ? 'CURRENT' : baseCommitHash.substring(0, 7);
          html += '<div class="compare-hint">Base: <strong>' + baseLabel + '</strong>. Click another commit to compare. Right-click any commit to change the base.</div>';
        }
      }
      html += '</div>';

      var currentClass = selectedCommitHash === 'CURRENT' ? ' selected' : '';
      var currentBaseClass = baseCommitHash === 'CURRENT' ? ' base-commit' : '';
      html += '<div class="commit-card' + currentClass + currentBaseClass + '" data-hash="CURRENT" data-action="commitClick">';
      html += '<span class="commit-hash">CURRENT</span><span class="commit-badge current-badge">Working Directory</span>';
      html += '<span class="commit-badge base-badge" style="display:' + (baseCommitHash === 'CURRENT' ? 'inline-block' : 'none') + '">BASE</span>';
      html += '<div class="commit-msg">Local working directory</div>';
      html += '</div>';

      for (var ci = 0; ci < historyCommits.length; ci++) {
        var c = historyCommits[ci];
        var isSelected = selectedCommitHash === c.hash;
        var isBase = baseCommitHash === c.hash;
        var cls = 'commit-card';
        if (isSelected) cls += ' selected';
        if (isBase) cls += ' base-commit';
        html += '<div class="' + cls + '" data-hash="' + c.hash + '" data-action="commitClick">';
        html += '<span class="commit-hash">' + c.shortHash + '</span>';
        html += '<span class="commit-badge base-badge" style="display:' + (isBase ? 'inline-block' : 'none') + '">BASE</span>';
        html += '<div class="commit-msg" title="' + c.message.replace(/"/g, '&quot;') + '">' + truncateStr(c.message, 60) + '</div>';
        html += '<div class="commit-meta">' + c.author + ' &middot; ' + formatCommitDate(c.date) + '</div>';
        if (c.filesChanged && c.filesChanged.length > 0) {
          html += '<div class="commit-files">' + c.filesChanged.join(', ') + '</div>';
        }
        html += '</div>';
      }

      body.innerHTML = html;

    }

    function updateCommitCardStates() {
      var body = root.querySelector('#historyPanelBody');
      if (!body) return;
      var cards = body.querySelectorAll('.commit-card');
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var h = card.getAttribute('data-hash');
        card.classList.toggle('selected', h === selectedCommitHash);
        card.classList.toggle('base-commit', h === baseCommitHash);
        var baseBadge = card.querySelector('.base-badge');
        if (baseBadge) baseBadge.style.display = (h === baseCommitHash) ? 'inline-block' : 'none';
      }
      var hintContainer = root.querySelector('#compareHintContainer');
      if (hintContainer) {
        if (historyViewMode !== 'compare') {
          hintContainer.innerHTML = '';
        } else if (!baseCommitHash) {
          hintContainer.innerHTML = '<div class="compare-hint">Click a commit to set it as the <strong>base</strong> for comparison.</div>';
        } else {
          var bl = baseCommitHash === 'CURRENT' ? 'CURRENT' : baseCommitHash.substring(0, 7);
          hintContainer.innerHTML = '<div class="compare-hint">Base: <strong>' + bl + '</strong>. Click another commit to compare. Right-click any commit to change the base.</div>';
        }
      }
    }

    function showErdLoading(show) {
      var overlay = root.querySelector('#erdLoadingOverlay');
      if (overlay) {
        if (show) overlay.classList.add('visible');
        else overlay.classList.remove('visible');
      }
    }

    function onCommitClick(hash) {
      if (historyLoading) return;

      if (historyViewMode === 'view') {
        selectedCommitHash = hash;
        historyLoading = true;
        updateCommitCardStates();
        showErdLoading(true);
        vscode.postMessage({ command: 'loadCommit', commitHash: hash });
      } else {
        if (!baseCommitHash) {
          baseCommitHash = hash;
          updateCommitCardStates();
        } else if (hash !== baseCommitHash) {
          selectedCommitHash = hash;
          historyLoading = true;
          updateCommitCardStates();
          showErdLoading(true);
          vscode.postMessage({
            command: 'compareCommits',
            baseCommitHash: baseCommitHash,
            selectedCommitHash: hash
          });
        }
      }
    }

    function onCommitRightClick(e, hash) {
      if (historyViewMode !== 'compare') return;
      e.preventDefault();
      baseCommitHash = hash;
      updateCommitCardStates();
    }

    function buildNodesFromModelUI(data) {
      var result = [];
      (data.dataObjects || []).forEach(function(obj) {
        var dims = (obj.semanticDimensions || []).map(function(d) {
          return { apiName: d.apiName, label: d.label, dataType: d.dataType || 'Text', dataObjectFieldName: d.dataObjectFieldName || d.apiName };
        });
        var meas = (obj.semanticMeasurements || []).map(function(m) {
          return { apiName: m.apiName, label: m.label, dataType: m.dataType || 'Number', aggregationType: m.aggregationType || 'Sum' };
        });
        var relCalcDims = (obj.relatedCalculatedDimensions || []).map(function(c) {
          return { apiName: c.apiName, label: c.label, expression: c.expression, placement: c.placement, isSystemDefinition: c.isSystemDefinition || false, referencedObjects: c.referencedObjects || [], diffStatus: c.diffStatus || null };
        });
        var relCalcMeas = (obj.relatedCalculatedMeasurements || []).map(function(c) {
          return { apiName: c.apiName, label: c.label, expression: c.expression, placement: c.placement, isSystemDefinition: c.isSystemDefinition || false, referencedObjects: c.referencedObjects || [], diffStatus: c.diffStatus || null };
        });
        var relHier = (obj.relatedDimensionHierarchies || []).map(function(h) {
          return { apiName: h.apiName, label: h.label, levels: h.levels, placement: h.placement, diffStatus: h.diffStatus || null };
        });
        var relMetrics = (obj.relatedMetrics || []).map(function(m) {
          return { apiName: m.apiName, label: m.label, diffStatus: m.diffStatus || null };
        });
        var relGroupings = (obj.relatedGroupings || []).map(function(g) {
          return { apiName: g.apiName, label: g.label, type: g.type, diffStatus: g.diffStatus || null };
        });
        result.push({
          id: obj.apiName,
          label: obj.label,
          type: 'dataObject',
          dataObjectType: obj.dataObjectType || 'Dmo',
          dataObjectName: obj.dataObjectName || obj.apiName,
          diffStatus: obj.diffStatus || null,
          dimCount: dims.length,
          measCount: meas.length,
          dimensions: dims,
          measurements: meas,
          relatedCalcDims: relCalcDims,
          relatedCalcMeas: relCalcMeas,
          relatedHierarchies: relHier,
          relatedMetrics: relMetrics,
          relatedGroupings: relGroupings,
        });
      });
      (data.logicalViews || []).forEach(function(lv) {
        result.push({
          id: lv.apiName,
          label: lv.label,
          type: 'logicalView',
          diffStatus: lv.diffStatus || null,
          dimCount: 0,
          measCount: 0,
          dimensions: [],
          measurements: [],
          relatedCalcDims: (lv.relatedCalculatedDimensions || []).map(function(c) {
            return { apiName: c.apiName, label: c.label, expression: c.expression, placement: c.placement, isSystemDefinition: c.isSystemDefinition || false, referencedObjects: c.referencedObjects || [], diffStatus: c.diffStatus || null };
          }),
          relatedCalcMeas: (lv.relatedCalculatedMeasurements || []).map(function(c) {
            return { apiName: c.apiName, label: c.label, expression: c.expression, placement: c.placement, isSystemDefinition: c.isSystemDefinition || false, referencedObjects: c.referencedObjects || [], diffStatus: c.diffStatus || null };
          }),
          relatedHierarchies: [],
          relatedMetrics: [],
          relatedGroupings: [],
        });
      });
      return result;
    }

    function buildEdgesFromModelUI(data) {
      return (data.relationships || []).map(function(r) {
        var criteria = r.criteria || [];
        var firstCrit = criteria[0] || {};
        return {
          id: r.apiName,
          label: r.label,
          from: r.leftSemanticDefinitionApiName,
          to: r.rightSemanticDefinitionApiName,
          cardinality: r.cardinality,
          joinType: r.joinType,
          isEnabled: r.isEnabled,
          fromField: firstCrit.leftSemanticFieldApiName || '',
          toField: firstCrit.rightSemanticFieldApiName || '',
          joinOperator: firstCrit.joinOperator || 'Equals',
          diffStatus: r.diffStatus || null,
          suggestions: [],
        };
      });
    }

    var diffLabels = { added: 'NEW', modified: 'MODIFIED', removed: 'REMOTE ONLY' };

    function setDiffLegendLabels(isGitCompare) {
      var title = root.querySelector('#diffLegendTitle');
      var labelAdded = root.querySelector('#diffLabelAdded');
      var labelModified = root.querySelector('#diffLabelModified');
      var labelRemoved = root.querySelector('#diffLabelRemoved');
      var ringAdded = root.querySelector('#diffRingAdded');
      var ringModified = root.querySelector('#diffRingModified');
      var ringRemoved = root.querySelector('#diffRingRemoved');
      var root = document.documentElement;
      if (isGitCompare) {
        diffLabels = { added: 'Added', modified: 'Modified', removed: 'Removed' };
        root.style.setProperty('--diff-label-added', "'Added'");
        root.style.setProperty('--diff-label-modified', "'Modified'");
        root.style.setProperty('--diff-label-removed', "'Removed'");
        if (title) title.textContent = 'Changes (Between Commits)';
        if (labelAdded) labelAdded.textContent = 'Added';
        if (labelModified) labelModified.textContent = 'Modified';
        if (labelRemoved) labelRemoved.textContent = 'Removed';
        if (ringAdded) ringAdded.title = 'Added';
        if (ringModified) ringModified.title = 'Modified';
        if (ringRemoved) ringRemoved.title = 'Removed';
      } else {
        diffLabels = { added: 'New', modified: 'Modified', removed: 'Remote Only' };
        root.style.setProperty('--diff-label-added', "'New'");
        root.style.setProperty('--diff-label-modified', "'Modified'");
        root.style.setProperty('--diff-label-removed', "'Remote Only'");
        if (title) title.textContent = 'Changes (Local vs Remote)';
        if (labelAdded) labelAdded.textContent = 'New';
        if (labelModified) labelModified.textContent = 'Modified';
        if (labelRemoved) labelRemoved.textContent = 'Remote Only';
        if (ringAdded) ringAdded.title = 'New';
        if (ringModified) ringModified.title = 'Modified';
        if (ringRemoved) ringRemoved.title = 'Remote Only';
      }
    }

    function applyNewModelData(modelData, compareMode) {
      nodes.length = 0;
      edges.length = 0;
      crossObjectEntities.length = 0;

      var newNodes = buildNodesFromModelUI(modelData);
      var newEdges = buildEdgesFromModelUI(modelData);
      var newCross = modelData.crossObjectEntities || [];

      for (var ni = 0; ni < newNodes.length; ni++) nodes.push(newNodes[ni]);
      for (var ei = 0; ei < newEdges.length; ei++) edges.push(newEdges[ei]);
      for (var xi = 0; xi < newCross.length; xi++) crossObjectEntities.push(newCross[xi]);

      isCompareMode = compareMode;
      highlightChangesActive = false;

      var changesGrp = root.querySelector('#changesGroup');
      if (compareMode) {
        root.querySelector('#diffLegendSection').style.display = 'block';
        if (changesGrp) changesGrp.classList.add('visible');
        var addedCount = 0, modifiedCount = 0, removedCount = 0;
        var allItems = nodes.concat(edges);
        allItems.forEach(function(item) {
          if (item.diffStatus === 'added') addedCount++;
          else if (item.diffStatus === 'modified') modifiedCount++;
          else if (item.diffStatus === 'removed') removedCount++;
        });
        var summaryEl = root.querySelector('#diffSummary');
        if (summaryEl) summaryEl.textContent = addedCount + ' added, ' + modifiedCount + ' modified, ' + removedCount + ' removed';
        updateChangesButtons();
      } else {
        root.querySelector('#diffLegendSection').style.display = 'none';
        if (changesGrp) changesGrp.classList.remove('visible');
      }

      updateLegendCounts();

      closeSidebar();

      if (currentView === 'drilldown') {
        exitDrillDown();
      }

      cachedPositionsForModel = {};
      nodePositions = {};
      nodeElements = {};
      renderTopLevel();
    }

    window.addEventListener('message', function(event) {
      var msg = event.data;
      if (msg.command === 'commitLoaded') {
        historyLoading = false;
        showErdLoading(false);
        applyNewModelData(msg.modelUI, false);
        updateCommitCardStates();
        root.querySelector('#headerTitle').textContent = modelLabel + (msg.commitHash === 'CURRENT' ? ' - ERD V2' : ' @ ' + msg.commitHash.substring(0, 7));
      } else if (msg.command === 'compareLoaded') {
        historyLoading = false;
        showErdLoading(false);
        applyNewModelData(msg.modelUI, true);
        setDiffLegendLabels(true);
        updateCommitCardStates();
        var baseLabel = msg.baseCommitHash === 'CURRENT' ? 'CURRENT' : msg.baseCommitHash.substring(0, 7);
        var selLabel = msg.selectedCommitHash === 'CURRENT' ? 'CURRENT' : msg.selectedCommitHash.substring(0, 7);
        root.querySelector('#headerTitle').textContent = modelLabel + ' - Compare (' + baseLabel + ' vs ' + selLabel + ')';
      }
    });
    // =====================================================================
    // --- Delegated action listener (replaces inline onclick= attributes) ---
    // =====================================================================
    // Buttons use data-action="actionName" and optionally data-arg="value"
    // instead of onclick="..." — required for Salesforce CSP compliance.
    root.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.getAttribute('data-action');
      var arg = target.getAttribute('data-arg');
      switch (action) {
        case 'exitDrillDown':          exitDrillDown(); break;
        case 'toggleHistoryPanel':     toggleHistoryPanel(); break;
        case 'zoomIn':                 zoomIn(); break;
        case 'zoomOut':                zoomOut(); break;
        case 'resetView':              resetView(); break;
        case 'toggleGridMode':         toggleGridMode(); break;
        case 'runAutoLayout':          runAutoLayout(); break;
        case 'expandAllGroups':        expandAllGroups(); break;
        case 'collapseAllGroups':      collapseAllGroups(); break;
        case 'toggleRelationships':    toggleRelationships(); break;
        case 'toggleUnmapped':         toggleUnmapped(); break;
        case 'toggleHighlightChanges': toggleHighlightChanges(); break;
        case 'toggleLeftPanel':        toggleLeftPanel(); break;
        case 'closeSidebar':           closeSidebar(); break;
        case 'runQuery':               runQuery(); break;
        case 'closeResults':           closeResults(); break;
        case 'closeHistoryPanel':      closeHistoryPanel(); break;
        case 'setLayoutMode':          if (arg) setLayoutMode(arg); break;
        case 'setRoutingMode':         if (arg) setRoutingMode(arg); break;
        case 'setHistoryMode':         if (arg) setHistoryMode(arg); break;
        case 'commitClick': {
          var hash = target.getAttribute('data-hash');
          if (hash) onCommitClick(hash);
          break;
        }
      }
    });

    // Contextmenu for history panel commit cards
    root.addEventListener('contextmenu', function(e) {
      var card = e.target.closest('[data-action="commitClick"]');
      if (card) { e.preventDefault(); onCommitRightClick(e, card.getAttribute('data-hash')); }
    });

}

if (typeof window !== 'undefined') {
  window.initErd = initErd;
}
