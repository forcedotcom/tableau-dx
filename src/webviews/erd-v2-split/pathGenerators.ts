import type { ErdContext, ErdEdge, Position } from './types';

export interface PathResult {
  d: string;
  mx: number;
  my: number;
}

export interface PortMap {
  [key: string]: string[];
}

// ─── Path generators ──────────────────────────────────────────────────────────

export function generateOrthogonalPath(
  sx: number, sy: number, tx: number, ty: number,
  allPositions?: Record<string, Position>, nodeSize?: number
): string {
  const dx = tx - sx, dy = ty - sy;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  const margin = 30;
  const r = 8;
  const points: Position[] = [{ x: sx, y: sy }];

  if (absDx < 1 && absDy < 1) return 'M ' + sx + ' ' + sy + ' L ' + tx + ' ' + ty;

  const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
  const horizontal = absDx >= absDy;

  if (horizontal) {
    let needsDetour = false;
    if (allPositions && nodeSize) {
      const keys = Object.keys(allPositions);
      for (let ki = 0; ki < keys.length; ki++) {
        const np = allPositions[keys[ki]];
        const ncx = np.x + nodeSize / 2, ncy = np.y + nodeSize / 2;
        const halfH = nodeSize / 2 + margin;
        const checkY = sy;
        const minCheckX = Math.min(sx, tx), maxCheckX = Math.max(sx, tx);
        if (checkY > ncy - halfH && checkY < ncy + halfH &&
          ncx > minCheckX + 10 && ncx < maxCheckX - 10) {
          needsDetour = true;
          break;
        }
      }
    }
    if (needsDetour) {
      const detourY = sy + (dy > 0 ? -1 : 1) * ((nodeSize || 0) + margin);
      points.push({ x: sx, y: detourY });
      points.push({ x: tx, y: detourY });
    } else {
      points.push({ x: midX, y: sy });
      points.push({ x: midX, y: ty });
    }
  } else {
    let needsDetour = false;
    if (allPositions && nodeSize) {
      const keys = Object.keys(allPositions);
      for (let ki = 0; ki < keys.length; ki++) {
        const np = allPositions[keys[ki]];
        const ncx = np.x + nodeSize / 2, ncy = np.y + nodeSize / 2;
        const halfW = nodeSize / 2 + margin;
        const checkX = sx;
        const minCheckY = Math.min(sy, ty), maxCheckY = Math.max(sy, ty);
        if (checkX > ncx - halfW && checkX < ncx + halfW &&
          ncy > minCheckY + 10 && ncy < maxCheckY - 10) {
          needsDetour = true;
          break;
        }
      }
    }
    if (needsDetour) {
      const detourX = sx + (dx > 0 ? -1 : 1) * ((nodeSize || 0) + margin);
      points.push({ x: detourX, y: sy });
      points.push({ x: detourX, y: ty });
    } else {
      points.push({ x: sx, y: midY });
      points.push({ x: tx, y: midY });
    }
  }
  points.push({ x: tx, y: ty });

  let d = 'M ' + points[0].x + ' ' + points[0].y;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i], next = points[i + 1];
    if (next) {
      const dxIn = curr.x - prev.x, dyIn = curr.y - prev.y;
      const dxOut = next.x - curr.x, dyOut = next.y - curr.y;
      if ((Math.abs(dxIn) > 0.5 || Math.abs(dyIn) > 0.5) &&
        (Math.abs(dxOut) > 0.5 || Math.abs(dyOut) > 0.5) &&
        (Math.abs(dxIn * dyOut - dyIn * dxOut) > 0.1)) {
        const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
        const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut);
        const rr = Math.min(r, lenIn / 2, lenOut / 2);
        const bx = curr.x - (dxIn / lenIn) * rr;
        const by = curr.y - (dyIn / lenIn) * rr;
        const ax = curr.x + (dxOut / lenOut) * rr;
        const ay = curr.y + (dyOut / lenOut) * rr;
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

export function generateCurvedPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const tension = Math.min(dist * 0.4, 150);
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;
  if (absDx >= absDy) {
    const dir = dx > 0 ? 1 : -1;
    cp1x = sx + dir * tension; cp1y = sy;
    cp2x = tx - dir * tension; cp2y = ty;
  } else {
    const dir = dy > 0 ? 1 : -1;
    cp1x = sx; cp1y = sy + dir * tension;
    cp2x = tx; cp2y = ty - dir * tension;
  }
  return 'M ' + sx + ' ' + sy + ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + tx + ' ' + ty;
}

export function generateStraightPath(sx: number, sy: number, tx: number, ty: number, curveOffset: number): string {
  if (Math.abs(curveOffset) < 0.5) {
    return 'M ' + sx + ' ' + sy + ' L ' + tx + ' ' + ty;
  }
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const midX = (sx + tx) / 2 + (-dy / dist) * curveOffset;
  const midY = (sy + ty) / 2 + (dx / dist) * curveOffset;
  return 'M ' + sx + ' ' + sy + ' Q ' + midX + ' ' + midY + ' ' + tx + ' ' + ty;
}

export function generateRoutedPath(
  ctx: ErdContext,
  sx: number, sy: number, tx: number, ty: number,
  curveOffset: number,
  allPositions?: Record<string, Position>,
  nodeSize?: number
): string {
  if (ctx.routingMode === 'orthogonal') {
    return generateOrthogonalPath(sx, sy, tx, ty, allPositions, nodeSize);
  } else if (ctx.routingMode === 'curved') {
    return generateCurvedPath(sx, sy, tx, ty);
  } else {
    return generateStraightPath(sx, sy, tx, ty, curveOffset);
  }
}

export function generateClassicPath(sx: number, sy: number, tx: number, ty: number, co: number): PathResult {
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const midX = (sx + tx) / 2 + (-dy / dist) * co;
  const midY = (sy + ty) / 2 + (dx / dist) * co;
  return { d: 'M ' + sx + ' ' + sy + ' Q ' + midX + ' ' + midY + ' ' + tx + ' ' + ty, mx: midX, my: midY };
}

export function getEdgeMidpoint(
  ctx: ErdContext,
  sx: number, sy: number, tx: number, ty: number,
  curveOffset: number
): Position {
  if (ctx.routingMode === 'orthogonal') {
    const dx = tx - sx, dy = ty - sy;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (absDx >= absDy) {
      const midX = (sx + tx) / 2;
      return { x: midX, y: sy + (ty - sy) * 0.5 };
    } else {
      const midY = (sy + ty) / 2;
      return { x: sx + (tx - sx) * 0.5, y: midY };
    }
  } else if (ctx.routingMode === 'curved') {
    return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
  } else {
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: (sx + tx) / 2 + (-dy / dist) * curveOffset,
      y: (sy + ty) / 2 + (dx / dist) * curveOffset
    };
  }
}

// ─── Port distribution ────────────────────────────────────────────────────────

export function getSide(fromCx: number, fromCy: number, toCx: number, toCy: number): string {
  const dx = toCx - fromCx, dy = toCy - fromCy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

export function buildPortMap(edgeList: ErdEdge[], positions: Record<string, Position>, nodeSize: number): PortMap {
  const portCounts: PortMap = {};
  edgeList.forEach(function (e) {
    const fp = positions[e.from], tp = positions[e.to];
    if (!fp || !tp) return;
    const r = nodeSize / 2;
    const fcx = fp.x + r, fcy = fp.y + r, tcx = tp.x + r, tcy = tp.y + r;
    const fromSide = getSide(fcx, fcy, tcx, tcy);
    const toSide = getSide(tcx, tcy, fcx, fcy);
    const fk = e.from + '|' + fromSide;
    const tk = e.to + '|' + toSide;
    if (!portCounts[fk]) portCounts[fk] = [];
    portCounts[fk].push(e.id);
    if (!portCounts[tk]) portCounts[tk] = [];
    portCounts[tk].push(e.id);
  });
  return portCounts;
}

export function getPortOffset(edgeId: string, nodeId: string, side: string, portMap: PortMap, nodeSize: number): number {
  const key = nodeId + '|' + side;
  const list = portMap[key];
  if (!list || list.length <= 1) return 0;
  let idx = list.indexOf(edgeId);
  if (idx < 0) idx = 0;
  const count = list.length;
  const spacing = Math.min(16, (nodeSize * 0.6) / count);
  return (idx - (count - 1) / 2) * spacing;
}

export function getPortPoint(cx: number, cy: number, side: string, offset: number, nodeRadius: number): Position {
  switch (side) {
    case 'right':  return { x: cx + nodeRadius + 5, y: cy + offset };
    case 'left':   return { x: cx - nodeRadius - 5, y: cy + offset };
    case 'bottom': return { x: cx + offset, y: cy + nodeRadius + 5 };
    case 'top':    return { x: cx + offset, y: cy - nodeRadius - 5 };
    default:       return { x: cx, y: cy };
  }
}
