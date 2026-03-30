/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext, ErdNode, Position, GroupNode } from './types';
import {
  generateClassicPath, generateRoutedPath, getSide, buildPortMap,
  getPortOffset, getPortPoint,
} from './pathGenerators';
import { getNodeClass, getNodeIcon, isClassicMode } from './utils';

export interface GroupsModule {
  buildGroupData(): void;
  renderGroupedView(): void;
  renderListGroupedView(): void;
  redrawGroupEdges(): void;
  fitGroupedViewport(): void;
  animateFitGroupedViewport(): void;
  fitListGroupedViewport(totalH: number): void;
  updateGroupButtons(): void;
  expandGroup(groupName: string): void;
  collapseGroup(groupName: string): void;
  expandAllGroups(): void;
  collapseAllGroups(): void;
  createGroupCircle(g: GroupNode): void;
  createGroupRect(g: GroupNode): void;
  createEntityNode(n: ErdNode, groupName: string): HTMLElement;
  createArrowMarkers(svgEl: SVGSVGElement, colors: Record<string, string>, prefix: string): SVGDefsElement;
}

const GROUP_COLOR_MAP: Record<string, string> = {
  'Sales Cloud': 'sales', 'Service Cloud': 'service', 'Marketing Cloud': 'marketing',
  'Commerce Cloud': 'commerce', 'Experience Cloud': 'experience', 'Field Service': 'fieldservice',
  'Revenue Cloud': 'revenue', 'Data Cloud': 'datacloud', 'Industry Clouds': 'industry',
  'Platform': 'platform', 'Other': 'other',
};

function getGroupColorClass(name: string): string {
  return 'group-color-' + (GROUP_COLOR_MAP[name] || 'other');
}

export function createGroupsModule(ctx: ErdContext): GroupsModule {
  // List-grouped state (local, only used by list view)
  let listGroupNodePositions: Record<string, Position> = {};
  let listGroupNodeElements: Record<string, HTMLElement> = {};
  let listGroupTotalH = 0;
  let listHoverActive = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getGroupCenter(groupName: string): Position {
    const p = ctx.groupNodePositions[groupName];
    if (!p) return { x: 0, y: 0 };
    return { x: p.x + ctx.GROUP_CLOUD_W / 2, y: p.y + ctx.GROUP_CLOUD_H / 2 };
  }

  function getGroupBoundingBox(groupName: string): { x: number; y: number; w: number; h: number } {
    const g = ctx.groupNodesList.find(gg => gg.name === groupName);
    const center = getGroupCenter(groupName);
    if (!g) return { x: center.x - ctx.GROUP_CLOUD_W / 2, y: center.y - ctx.GROUP_CLOUD_H / 2, w: ctx.GROUP_CLOUD_W, h: ctx.GROUP_CLOUD_H };

    if (ctx.expandedGroups.has(groupName)) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasPositions = false;
      g.objects.forEach(objId => {
        const ep = ctx.groupEntityPositions[objId];
        if (ep) {
          hasPositions = true;
          if (ep.x < minX) minX = ep.x;
          if (ep.y < minY) minY = ep.y;
          if (ep.x + ctx.NODE_SIZE > maxX) maxX = ep.x + ctx.NODE_SIZE;
          if (ep.y + ctx.NODE_SIZE + 60 > maxY) maxY = ep.y + ctx.NODE_SIZE + 60;
        }
      });
      if (!hasPositions) {
        const est = estimateExpandedSize(g.objects.length);
        return { x: center.x - est.w / 2, y: center.y - est.h / 2, w: est.w, h: est.h };
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    } else {
      return { x: center.x - ctx.GROUP_CLOUD_W / 2, y: center.y - ctx.GROUP_CLOUD_H / 2, w: ctx.GROUP_CLOUD_W, h: ctx.GROUP_CLOUD_H };
    }
  }

  function estimateExpandedSize(count: number): { w: number; h: number } {
    if (ctx.isGridMode && count > 0) {
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const w = cols * ctx.GRID_CELL.w + ctx.NODE_SIZE;
      const h = rows * ctx.GRID_CELL.h + 60;
      return { w, h };
    }
    const w = Math.max(200, count * 65) + ctx.NODE_SIZE;
    const h = Math.max(160, count * 50) + ctx.NODE_SIZE + 60;
    return { w, h };
  }

  function getGroupBoundingBoxForExpansion(groupName: string): { x: number; y: number; w: number; h: number } {
    const g = ctx.groupNodesList.find(gg => gg.name === groupName);
    const center = getGroupCenter(groupName);
    if (!g) return { x: center.x - ctx.GROUP_CLOUD_W / 2, y: center.y - ctx.GROUP_CLOUD_H / 2, w: ctx.GROUP_CLOUD_W, h: ctx.GROUP_CLOUD_H };
    const est = estimateExpandedSize(g.objects.length);
    return { x: center.x - est.w / 2, y: center.y - est.h / 2, w: est.w, h: est.h };
  }

  function rectsOverlap(a: any, b: any, pad: number): boolean {
    return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
  }

  function getGroupBox(gName: string, expandingGroupName: string | null): any {
    if (gName === expandingGroupName || ctx.expandedGroups.has(gName)) {
      return getGroupBoundingBoxForExpansion(gName);
    }
    return getGroupBoundingBox(gName);
  }

  function ensureNoOverlap(expandingGroupName: string | null): void {
    const PAD = Math.max(ctx.GRID_CELL.w, ctx.GRID_CELL.h);
    const MAX_ITER = 80;
    for (let iter = 0; iter < MAX_ITER; iter++) {
      let anyPush = false;
      for (let i = 0; i < ctx.groupNodesList.length; i++) {
        for (let j = i + 1; j < ctx.groupNodesList.length; j++) {
          const gA = ctx.groupNodesList[i].name, gB = ctx.groupNodesList[j].name;
          const boxA = getGroupBox(gA, expandingGroupName);
          const boxB = getGroupBox(gB, expandingGroupName);
          if (!rectsOverlap(boxA, boxB, PAD)) continue;
          anyPush = true;
          const cAx = boxA.x + boxA.w / 2, cAy = boxA.y + boxA.h / 2;
          const cBx = boxB.x + boxB.w / 2, cBy = boxB.y + boxB.h / 2;
          const dx = cBx - cAx, dy = cBy - cAy;
          const overlapX = (boxA.w / 2 + boxB.w / 2 + PAD) - Math.abs(dx);
          const overlapY = (boxA.h / 2 + boxB.h / 2 + PAD) - Math.abs(dy);
          if (overlapX <= 0 && overlapY <= 0) continue;
          const pA = ctx.groupNodePositions[gA], pB = ctx.groupNodePositions[gB];
          if (overlapX > 0 && (overlapX <= overlapY || overlapY <= 0)) {
            const signX = dx >= 0 ? 1 : -1;
            const halfPush = (overlapX / 2) + 1;
            if (pA) pA.x -= signX * halfPush;
            if (pB) pB.x += signX * halfPush;
          } else if (overlapY > 0) {
            const signY = dy >= 0 ? 1 : -1;
            const halfPush = (overlapY / 2) + 1;
            if (pA) pA.y -= signY * halfPush;
            if (pB) pB.y += signY * halfPush;
          }
        }
      }
      if (!anyPush) break;
    }
  }

  function positionGroupRect(gName: string): void {
    const box = getGroupBoundingBox(gName);
    const bEl = ctx.groupRectBorderElements[gName];
    if (bEl) {
      bEl.style.left = (box.x - ctx.GROUP_RECT_PAD) + 'px';
      bEl.style.top = (box.y - ctx.GROUP_RECT_PAD) + 'px';
      bEl.style.width = (box.w + ctx.GROUP_RECT_PAD * 2) + 'px';
      bEl.style.height = (box.h + ctx.GROUP_RECT_PAD * 2) + 'px';
    }
    const lEl = ctx.groupCenterMarkerElements[gName];
    if (lEl) {
      lEl.style.left = (box.x - ctx.GROUP_RECT_PAD + 16) + 'px';
      lEl.style.top = (box.y - ctx.GROUP_RECT_PAD) + 'px';
    }
  }

  function repositionGroupElements(): void {
    ctx.groupNodesList.forEach(g => {
      if (ctx.expandedGroups.has(g.name)) {
        const pos = ctx.groupNodePositions[g.name];
        if (pos) {
          const gEl = ctx.groupNodeElements[g.name];
          if (gEl) { gEl.style.left = pos.x + 'px'; gEl.style.top = pos.y + 'px'; }
        }
        g.objects.forEach(objId => {
          const ep = ctx.groupEntityPositions[objId];
          const eEl = ctx.groupEntityElements[objId];
          if (ep && eEl) { eEl.style.left = ep.x + 'px'; eEl.style.top = ep.y + 'px'; }
        });
        positionGroupRect(g.name);
      } else {
        const pos = ctx.groupNodePositions[g.name];
        const gEl = ctx.groupNodeElements[g.name];
        if (pos && gEl) { gEl.style.left = pos.x + 'px'; gEl.style.top = pos.y + 'px'; }
      }
    });
  }

  function animateRepositionGroupElements(skipGroupName: string | null, callback: () => void): void {
    const startPositions: Record<string, Position> = {};
    const targetPositions: Record<string, Position> = {};
    const startEntityPositions: Record<string, Record<string, Position>> = {};
    let hasMovement = false;

    ctx.groupNodesList.forEach(g => {
      if (g.name === skipGroupName) return;
      const targetPos = ctx.groupNodePositions[g.name];
      if (!targetPos) return;
      const el = ctx.groupNodeElements[g.name];
      let curDataX: number, curDataY: number;
      if (el) {
        curDataX = parseFloat(el.style.left) || 0;
        curDataY = parseFloat(el.style.top) || 0;
      } else {
        const oldPos = ctx.groupNodePositions[g.name];
        if (!oldPos) return;
        curDataX = oldPos.x;
        curDataY = oldPos.y;
      }
      if (Math.abs(curDataX - targetPos.x) > 2 || Math.abs(curDataY - targetPos.y) > 2) {
        startPositions[g.name] = { x: curDataX, y: curDataY };
        targetPositions[g.name] = { x: targetPos.x, y: targetPos.y };
        hasMovement = true;
        if (ctx.expandedGroups.has(g.name)) {
          const snap: Record<string, Position> = {};
          g.objects.forEach(objId => {
            const ep = ctx.groupEntityPositions[objId];
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

    const animStart = performance.now();

    function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function tick(now: number) {
      const elapsed = now - animStart;
      const progress = Math.min(1, elapsed / ctx.REPOSITION_ANIM_MS);
      const eased = easeInOut(progress);

      Object.keys(startPositions).forEach(gName => {
        const sp = startPositions[gName], tp = targetPositions[gName];
        const curX = sp.x + (tp.x - sp.x) * eased;
        const curY = sp.y + (tp.y - sp.y) * eased;
        ctx.groupNodePositions[gName] = { x: curX, y: curY };

        if (ctx.expandedGroups.has(gName) && startEntityPositions[gName]) {
          const deltaX = curX - sp.x, deltaY = curY - sp.y;
          const gg = ctx.groupNodesList.find(g => g.name === gName);
          if (gg) {
            gg.objects.forEach(objId => {
              const origEp = startEntityPositions[gName][objId];
              if (!origEp) return;
              const newEp = { x: origEp.x + deltaX, y: origEp.y + deltaY };
              ctx.groupEntityPositions[objId] = newEp;
              const eEl = ctx.groupEntityElements[objId];
              if (eEl) { eEl.style.left = newEp.x + 'px'; eEl.style.top = newEp.y + 'px'; }
            });
          }
          positionGroupRect(gName);
        } else {
          const gEl = ctx.groupNodeElements[gName];
          if (gEl) { gEl.style.left = curX + 'px'; gEl.style.top = curY + 'px'; }
        }
      });

      redrawGroupEdges();

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        Object.keys(targetPositions).forEach(gName => {
          ctx.groupNodePositions[gName] = { x: targetPositions[gName].x, y: targetPositions[gName].y };
        });
        repositionGroupElements();
        redrawGroupEdges();
        if (callback) callback();
      }
    }
    requestAnimationFrame(tick);
  }

  function layoutGroupForce(): void {
    const padding = 200;
    const canvasW = Math.max(1200, ctx.groupNodesList.length * 300);
    const canvasH = Math.max(800, ctx.groupNodesList.length * 250);
    const positions: Record<string, Position> = {};

    const cachedGroupPos = ctx.cachedPositionsForModel || {};
    let allCached = true;
    ctx.groupNodesList.forEach(g => {
      if (!cachedGroupPos['grp_' + g.name]) allCached = false;
    });

    if (allCached && ctx.groupNodesList.length > 0) {
      ctx.groupNodesList.forEach(g => {
        const cp = cachedGroupPos['grp_' + g.name];
        positions[g.name] = { x: cp.x, y: cp.y };
      });
      ctx.groupNodePositions = positions;
      ctx.getGridCellSize('groupCircle');
      return;
    }

    const degree: Record<string, number> = {};
    ctx.groupNodesList.forEach(g => { degree[g.name] = 0; });
    ctx.groupEdgesList.forEach(e => {
      if (degree[e.groupA] !== undefined) degree[e.groupA]++;
      if (degree[e.groupB] !== undefined) degree[e.groupB]++;
    });

    const velocities: Record<string, Position> = {};
    ctx.groupNodesList.forEach(g => {
      positions[g.name] = { x: padding + Math.random() * (canvasW - 2 * padding), y: padding + Math.random() * (canvasH - 2 * padding) };
      velocities[g.name] = { x: 0, y: 0 };
    });

    const iterations = 500, repulsion = 15000, springLength = 200, springStiffness = 0.04, gravity = 0.008;
    for (let iter = 0; iter < iterations; iter++) {
      const forces: Record<string, Position> = {};
      ctx.groupNodesList.forEach(g => { forces[g.name] = { x: 0, y: 0 }; });
      for (let i = 0; i < ctx.groupNodesList.length; i++) {
        for (let j = i + 1; j < ctx.groupNodesList.length; j++) {
          const a = ctx.groupNodesList[i].name, b = ctx.groupNodesList[j].name;
          const dx = positions[a].x - positions[b].x, dy = positions[a].y - positions[b].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = (repulsion * (1 + degree[a]) * (1 + degree[b])) / (dist * dist);
          const fx = force * dx / dist, fy = force * dy / dist;
          forces[a].x += fx; forces[a].y += fy; forces[b].x -= fx; forces[b].y -= fy;
        }
      }
      ctx.groupEdgesList.forEach(e => {
        const pa = positions[e.groupA], pb = positions[e.groupB];
        if (!pa || !pb) return;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const sf = springStiffness * (dist - springLength);
        const fx = sf * dx / dist, fy = sf * dy / dist;
        forces[e.groupA].x += fx; forces[e.groupA].y += fy; forces[e.groupB].x -= fx; forces[e.groupB].y -= fy;
      });
      ctx.groupNodesList.forEach(g => {
        forces[g.name].x += (canvasW / 2 - positions[g.name].x) * gravity;
        forces[g.name].y += (canvasH / 2 - positions[g.name].y) * gravity;
        velocities[g.name].x = (velocities[g.name].x + forces[g.name].x) * 0.85;
        velocities[g.name].y = (velocities[g.name].y + forces[g.name].y) * 0.85;
        positions[g.name].x += velocities[g.name].x;
        positions[g.name].y += velocities[g.name].y;
      });
    }

    const xs = ctx.groupNodesList.map(g => positions[g.name].x), ys = ctx.groupNodesList.map(g => positions[g.name].y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const rX = maxX - minX || 1, rY = maxY - minY || 1;
    ctx.groupNodesList.forEach(g => {
      const p = positions[g.name];
      positions[g.name] = {
        x: padding + ((p.x - minX) / rX) * (canvasW - 2 * padding - ctx.GROUP_CLOUD_W),
        y: padding + ((p.y - minY) / rY) * (canvasH - 2 * padding - ctx.GROUP_CLOUD_H),
      };
    });
    ctx.groupNodePositions = positions;
  }

  function layoutEntitiesForceDirected(groupName: string): void {
    const g = ctx.groupNodesList.find(gg => gg.name === groupName);
    if (!g) return;
    const center = getGroupCenter(groupName);
    const count = g.objects.length;
    if (count === 0) return;

    if (count === 1) {
      ctx.groupEntityPositions[g.objects[0]] = { x: center.x - ctx.NODE_SIZE / 2, y: center.y - ctx.NODE_SIZE / 2 };
      return;
    }

    const groupNodeList = g.objects.map(objId => ctx.nodes.find(n => n.id === objId)).filter(Boolean) as ErdNode[];
    const intraEdges = ctx.edges.filter(e => ctx.entityToGroup[e.from] === groupName && ctx.entityToGroup[e.to] === groupName);

    const iterations = 400, repulsion = 4000, springLength = 100, springStiffness = 0.08, gravity = 0.025;
    const pad = 60;
    const canvasW = Math.max(400, count * 100), canvasH = Math.max(300, count * 75);

    const degree: Record<string, number> = {};
    groupNodeList.forEach(n => { degree[n.id] = 0; });
    intraEdges.forEach(e => {
      if (degree[e.from] !== undefined) degree[e.from]++;
      if (degree[e.to] !== undefined) degree[e.to]++;
    });

    const positions: Record<string, Position> = {}, velocities: Record<string, Position> = {};
    groupNodeList.forEach(n => {
      positions[n.id] = { x: pad + Math.random() * (canvasW - 2 * pad), y: pad + Math.random() * (canvasH - 2 * pad) };
      velocities[n.id] = { x: 0, y: 0 };
    });

    for (let iter = 0; iter < iterations; iter++) {
      const forces: Record<string, Position> = {};
      groupNodeList.forEach(n => { forces[n.id] = { x: 0, y: 0 }; });
      for (let i = 0; i < groupNodeList.length; i++) {
        for (let j = i + 1; j < groupNodeList.length; j++) {
          const a = groupNodeList[i].id, b = groupNodeList[j].id;
          const dx = positions[a].x - positions[b].x, dy = positions[a].y - positions[b].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = (repulsion * (1 + degree[a]) * (1 + degree[b])) / (dist * dist);
          const fx = force * dx / dist, fy = force * dy / dist;
          forces[a].x += fx; forces[a].y += fy; forces[b].x -= fx; forces[b].y -= fy;
        }
      }
      intraEdges.forEach(e => {
        const pa = positions[e.from], pb = positions[e.to];
        if (!pa || !pb) return;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const sf = springStiffness * (dist - springLength);
        const fx = sf * dx / dist, fy = sf * dy / dist;
        forces[e.from].x += fx; forces[e.from].y += fy; forces[e.to].x -= fx; forces[e.to].y -= fy;
      });
      groupNodeList.forEach(n => {
        forces[n.id].x += (canvasW / 2 - positions[n.id].x) * gravity;
        forces[n.id].y += (canvasH / 2 - positions[n.id].y) * gravity;
        velocities[n.id].x = (velocities[n.id].x + forces[n.id].x) * 0.85;
        velocities[n.id].y = (velocities[n.id].y + forces[n.id].y) * 0.85;
        positions[n.id].x += velocities[n.id].x; positions[n.id].y += velocities[n.id].y;
      });
    }

    const xs = groupNodeList.map(n => positions[n.id].x), ys = groupNodeList.map(n => positions[n.id].y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
    const targetW = Math.max(200, count * 65), targetH = Math.max(160, count * 50);
    groupNodeList.forEach(n => {
      const raw = positions[n.id];
      const normX = ((raw.x - minX) / rangeX) * targetW;
      const normY = ((raw.y - minY) / rangeY) * targetH;
      ctx.groupEntityPositions[n.id] = {
        x: center.x - targetW / 2 + normX - ctx.NODE_SIZE / 2,
        y: center.y - targetH / 2 + normY - ctx.NODE_SIZE / 2,
      };
    });
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  function buildGroupData(): void {
    if (!ctx.groupsData) return;
    ctx.groupNodesList = [];
    ctx.entityToGroup = {};
    const nodeIdSet: Record<string, boolean> = {};
    ctx.nodes.forEach(n => {
      if (!ctx.showUnmapped && n.unmapped) return;
      if (!ctx.showBaseModel && n.baseModelApiName) return;
      nodeIdSet[n.id] = true;
    });

    ctx.groupsData.groups.forEach(g => {
      const validObjects = g.objects.filter(o => nodeIdSet[o]);
      if (validObjects.length > 0) {
        ctx.groupNodesList.push({ name: g.name, objects: validObjects, count: validObjects.length });
        validObjects.forEach(obj => { ctx.entityToGroup[obj] = g.name; });
      }
    });

    if (ctx.groupsData.ungrouped && ctx.groupsData.ungrouped.length > 0) {
      const validUngrouped = ctx.groupsData.ungrouped.filter(o => nodeIdSet[o]);
      if (validUngrouped.length > 0) {
        ctx.groupNodesList.push({ name: 'Other', objects: validUngrouped, count: validUngrouped.length });
        validUngrouped.forEach(obj => { ctx.entityToGroup[obj] = 'Other'; });
      }
    }

    ctx.nodes.forEach(n => {
      if (!ctx.showUnmapped && n.unmapped) return;
      if (!ctx.showBaseModel && n.baseModelApiName) return;
      if (!ctx.entityToGroup[n.id]) {
        ctx.entityToGroup[n.id] = 'Other';
        let otherGroup = ctx.groupNodesList.find(g => g.name === 'Other');
        if (!otherGroup) {
          otherGroup = { name: 'Other', objects: [], count: 0 };
          ctx.groupNodesList.push(otherGroup);
        }
        otherGroup.objects.push(n.id);
        otherGroup.count++;
      }
    });

    const edgeMap: Record<string, any> = {};
    ctx.edges.forEach(e => {
      const fg = ctx.entityToGroup[e.from], tg = ctx.entityToGroup[e.to];
      if (fg && tg && fg !== tg) {
        const key = fg < tg ? fg + '|||' + tg : tg + '|||' + fg;
        if (!edgeMap[key]) edgeMap[key] = { groupA: fg < tg ? fg : tg, groupB: fg < tg ? tg : fg, count: 0, entityEdges: [] };
        edgeMap[key].count++;
        edgeMap[key].entityEdges.push(e);
      }
    });
    ctx.groupEdgesList = Object.values(edgeMap);
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function createArrowMarkers(svgEl: SVGSVGElement, colors: Record<string, string>, prefix: string): SVGDefsElement {
    const isClassic = isClassicMode(ctx);
    const sz = isClassic ? 12 : 8;
    const half = sz / 2;
    const refX = isClassic ? 10 : 7;
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

  function edgeStroke() { return isClassicMode(ctx) ? '3' : '1.5'; }
  function edgeGlowWidth() { return isClassicMode(ctx) ? '8' : '5'; }
  function edgeGlowOpacity() { return isClassicMode(ctx) ? '0.2' : '0.15'; }
  function edgeGroupStroke() { return isClassicMode(ctx) ? '3' : '1.5'; }

  function nearestPointOnRect(rect: any, px: number, py: number): Position {
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const dx = px - cx, dy = py - cy;
    const hw = rect.w / 2, hh = rect.h / 2;
    if (dx === 0 && dy === 0) return { x: cx + hw, y: cy };
    const sx = hw / (Math.abs(dx) || 1), sy = hh / (Math.abs(dy) || 1);
    const s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
  }

  function drawAggregatedGroupEdge(groupA: string, groupB: string, count: number): void {
    const fromC = getGroupCenter(groupA), toC = getGroupCenter(groupB);
    const boxA = getGroupBoundingBox(groupA), boxB = getGroupBoundingBox(groupB);
    const p1 = nearestPointOnRect(boxA, toC.x, toC.y), p2 = nearestPointOnRect(boxB, fromC.x, fromC.y);
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;

    const d = isClassicMode(ctx) ? 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2 : generateRoutedPath(ctx, x1, y1, x2, y2, 0);
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', d); glow.setAttribute('stroke', '#0070d2'); glow.setAttribute('stroke-width', edgeGlowWidth());
    glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', '0.12'); glow.setAttribute('stroke-linecap', 'round');
    ctx.svg.appendChild(glow);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d); path.setAttribute('stroke', '#0070d2'); path.setAttribute('stroke-width', edgeGroupStroke());
    path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#grp-arrow-group)');
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('opacity', '0.6');
    ctx.svg.appendChild(path);

    const badge = document.createElement('div');
    badge.className = 'group-edge-badge';
    badge.textContent = String(count);
    badge.style.left = ((x1 + x2) / 2 - 14) + 'px'; badge.style.top = ((y1 + y2) / 2 - 12) + 'px';
    ctx.nodesLayer.appendChild(badge);
  }

  function drawEntityEdgeInGroup(edge: any, idx: number): void {
    const fp = ctx.groupEntityPositions[edge.from], tp = ctx.groupEntityPositions[edge.to];
    if (!fp || !tp) return;
    const r = ctx.NODE_SIZE / 2;
    const fcx = fp.x + r, fcy = fp.y + r, tcx = tp.x + r, tcy = tp.y + r;
    let d: string;
    if (isClassicMode(ctx)) {
      const angle = Math.atan2(tcy - fcy, tcx - fcx);
      const fex = fcx + Math.cos(angle) * (r + 5), fey = fcy + Math.sin(angle) * (r + 5);
      const tex = tcx - Math.cos(angle) * (r + 15), tey = tcy - Math.sin(angle) * (r + 15);
      const co = 25 * (idx % 2 === 0 ? 1 : -1);
      d = generateClassicPath(fex, fey, tex, tey, co).d;
    } else {
      const fromSide = getSide(fcx, fcy, tcx, tcy), toSide = getSide(tcx, tcy, fcx, fcy);
      const sp = getPortPoint(fcx, fcy, fromSide, 0, r);
      const tp2 = getPortPoint(tcx, tcy, toSide, 0, r);
      const curveOffset = ctx.routingMode === 'straight' ? 20 * (idx % 2 === 0 ? 1 : -1) : 0;
      d = generateRoutedPath(ctx, sp.x, sp.y, tp2.x, tp2.y, curveOffset, ctx.groupEntityPositions, ctx.NODE_SIZE);
    }
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', d); glow.setAttribute('stroke', '#939393'); glow.setAttribute('stroke-width', edgeGlowWidth());
    glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', '0.1'); glow.setAttribute('stroke-linecap', 'round');
    ctx.svg.appendChild(glow);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d); path.setAttribute('stroke', '#939393'); path.setAttribute('stroke-width', isClassicMode(ctx) ? '2' : '1.5');
    path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#grp-arrow-default)');
    path.setAttribute('stroke-linecap', 'round');
    ctx.svg.appendChild(path);
  }

  function redrawGroupEdges(): void {
    ctx.svg.innerHTML = '';
    createArrowMarkers(ctx.svg, { default: '#939393', group: '#0070d2' }, 'grp-arrow-');
    ctx.root.querySelectorAll('.group-edge-badge').forEach(el => el.remove());

    const aggregated: Record<string, any> = {};
    const drawnEntityEdges: any[] = [];

    ctx.edges.forEach(e => {
      const fg = ctx.entityToGroup[e.from], tg = ctx.entityToGroup[e.to];
      if (!fg || !tg) return;
      if (fg === tg) {
        if (ctx.expandedGroups.has(fg)) drawnEntityEdges.push(e);
        return;
      }
      const key = fg < tg ? fg + '|||' + tg : tg + '|||' + fg;
      if (!aggregated[key]) aggregated[key] = { groupA: fg < tg ? fg : tg, groupB: fg < tg ? tg : fg, count: 0 };
      aggregated[key].count++;
    });

    Object.values(aggregated).forEach((ae: any) => { drawAggregatedGroupEdge(ae.groupA, ae.groupB, ae.count); });
    drawnEntityEdges.forEach((e, idx) => { drawEntityEdgeInGroup(e, idx); });
  }

  function computeGroupedFit(): { scale: number; panX: number; panY: number } | null {
    const allPos: Position[] = [];
    ctx.groupNodesList.forEach(g => {
      const p = ctx.groupNodePositions[g.name];
      if (!p) return;
      if (!ctx.expandedGroups.has(g.name)) {
        allPos.push({ x: p.x, y: p.y });
        allPos.push({ x: p.x + ctx.GROUP_CLOUD_W, y: p.y + ctx.GROUP_CLOUD_H + 30 });
      }
    });
    Object.values(ctx.groupEntityPositions).forEach(p => {
      allPos.push({ x: p.x, y: p.y });
      allPos.push({ x: p.x + ctx.NODE_SIZE, y: p.y + ctx.NODE_SIZE + 30 });
    });
    if (allPos.length === 0) return null;
    const xs = allPos.map(p => p.x), ys = allPos.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX + 80, h = maxY - minY + 80;
    const lpw = getLeftPanelWidth(), availW = getAvailableWidth(), availH = ctx.erdContainer.clientHeight;
    const sw = availW / w, sh = availH / h;
    const tScale = Math.min(sw, sh, 1);
    const tPanX = lpw + (availW - (maxX - minX) * tScale) / 2 - minX * tScale;
    const tPanY = (availH - (maxY - minY) * tScale) / 2 - minY * tScale;
    return { scale: tScale, panX: tPanX, panY: tPanY };
  }

  function fitGroupedViewport(): void {
    const fit = computeGroupedFit();
    if (!fit) return;
    ctx.scale = fit.scale; ctx.panX = fit.panX; ctx.panY = fit.panY;
    ctx.updateView();
  }

  function animateFitGroupedViewport(): void {
    const fit = computeGroupedFit();
    if (!fit) return;
    if (Math.abs(ctx.scale - fit.scale) < 0.005 && Math.abs(ctx.panX - fit.panX) < 2 && Math.abs(ctx.panY - fit.panY) < 2) {
      ctx.scale = fit.scale; ctx.panX = fit.panX; ctx.panY = fit.panY;
      ctx.updateView(); return;
    }
    const startScale = ctx.scale, startPanX = ctx.panX, startPanY = ctx.panY;
    const animStart = performance.now();
    const targetScale = fit.scale, targetPanX = fit.panX, targetPanY = fit.panY;
    function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
    function tick(now: number) {
      const progress = Math.min(1, (now - animStart) / 400);
      const e = easeOut(progress);
      ctx.scale = startScale + (targetScale - startScale) * e;
      ctx.panX = startPanX + (targetPanX - startPanX) * e;
      ctx.panY = startPanY + (targetPanY - startPanY) * e;
      ctx.updateView();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

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

  function fitListGroupedViewport(totalH: number): void {
    const allPos = Object.values(listGroupNodePositions);
    if (allPos.length === 0) return;
    const xs = allPos.map(p => p.x), ys = allPos.map(p => p.y);
    const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 180;
    const minY = 0, maxY = totalH + 60;
    const w = maxX - minX, h = maxY - minY;
    const lpw = getLeftPanelWidth(), availW = getAvailableWidth(), availH = ctx.erdContainer.clientHeight;
    const sw = availW / w, sh = availH / h;
    ctx.scale = Math.min(sw, sh, 1);
    ctx.panX = lpw + (availW - w * ctx.scale) / 2 - minX * ctx.scale;
    ctx.panY = (availH - h * ctx.scale) / 2 - minY * ctx.scale;
    ctx.updateView();
  }

  // ── DOM creation ───────────────────────────────────────────────────────────

  function createGroupCircle(g: GroupNode): void {
    const pos = ctx.groupNodePositions[g.name];
    if (!pos) return;
    const colorClass = getGroupColorClass(g.name);
    const div = document.createElement('div');
    div.className = 'group-circle ' + colorClass;
    div.id = 'grp-' + g.name.replace(/\s+/g, '_');
    div.innerHTML = '<div class="group-circle-inner"><div class="group-circle-name">' + g.name + '</div><div class="group-circle-count">' + g.count + ' entities</div></div>';
    div.style.left = pos.x + 'px'; div.style.top = pos.y + 'px';

    let clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
    div.addEventListener('mousedown', e => {
      e.stopPropagation(); clickStartTime = Date.now(); clickStartPos = { x: e.clientX, y: e.clientY };
      ctx.draggingNode = 'grp_' + g.name;
      const rect = div.getBoundingClientRect();
      ctx.dragOffsetX = e.clientX - rect.left; ctx.dragOffsetY = e.clientY - rect.top;
    });
    div.addEventListener('dblclick', e => { e.stopPropagation(); e.preventDefault(); expandGroup(g.name); });
    ctx.nodesLayer.appendChild(div);
    ctx.groupNodeElements[g.name] = div;
  }

  function createGroupRect(g: GroupNode): void {
    const colorClass = getGroupColorClass(g.name);
    const box = getGroupBoundingBox(g.name);
    const border = document.createElement('div');
    border.className = 'group-rect-border ' + colorClass;
    border.id = 'grp-rect-' + g.name.replace(/\s+/g, '_');
    border.style.left = (box.x - ctx.GROUP_RECT_PAD) + 'px'; border.style.top = (box.y - ctx.GROUP_RECT_PAD) + 'px';
    border.style.width = (box.w + ctx.GROUP_RECT_PAD * 2) + 'px'; border.style.height = (box.h + ctx.GROUP_RECT_PAD * 2) + 'px';
    ctx.nodesLayer.appendChild(border);
    ctx.groupRectBorderElements[g.name] = border;

    const label = document.createElement('div');
    label.className = 'group-rect-label ' + colorClass;
    label.id = 'grp-label-' + g.name.replace(/\s+/g, '_');
    label.innerHTML = g.name + '<span class="rect-label-count">' + g.count + '</span>';
    label.style.left = (box.x - ctx.GROUP_RECT_PAD + 16) + 'px'; label.style.top = (box.y - ctx.GROUP_RECT_PAD) + 'px';

    let clickStartTime = 0;
    label.addEventListener('mousedown', e => {
      e.stopPropagation(); clickStartTime = Date.now();
      ctx.draggingNode = 'grp_' + g.name;
      const gp = ctx.groupNodePositions[g.name];
      if (gp) {
        const cursorCanvasX = (e.clientX - ctx.panX) / ctx.scale;
        const cursorCanvasY = (e.clientY - ctx.panY - 56) / ctx.scale;
        ctx.dragOffsetX = cursorCanvasX - gp.x; ctx.dragOffsetY = cursorCanvasY - gp.y;
      } else { ctx.dragOffsetX = 0; ctx.dragOffsetY = 0; }
    });
    label.addEventListener('dblclick', e => { e.stopPropagation(); e.preventDefault(); collapseGroup(g.name); });
    ctx.nodesLayer.appendChild(label);
    ctx.groupCenterMarkerElements[g.name] = label;
  }

  function createEntityNode(n: ErdNode, _groupName: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'node ' + getNodeClass(n) + ' group-entity-appear' + (n.unmapped ? ' node-unmapped' : '');
    div.id = 'grpent-' + n.id;
    const iconSvg = getNodeIcon(ctx, n);
    const isShared = n.tableType === 'Shared', isBase = !!n.baseModelApiName;
    const needsWrap = isShared || isBase;
    const sharedBadge = isShared ? '<div class="shared-badge">' + ctx.sharedSvg + '</div>' : '';
    const baseBadge = isBase ? '<div class="base-model-badge">BASE</div>' : '';
    const circleHtml = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
    div.innerHTML = (needsWrap ? '<div class="node-circle-wrap">' + circleHtml + sharedBadge + baseBadge + '</div>' : circleHtml) + '<div class="node-label"><div class="node-title">' + n.label + '</div></div>';

    let clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
    div.addEventListener('mousedown', e => {
      e.stopPropagation(); clickStartTime = Date.now(); clickStartPos = { x: e.clientX, y: e.clientY };
      ctx.draggingNode = 'gent_' + n.id;
      const rect = div.getBoundingClientRect();
      ctx.dragOffsetX = e.clientX - rect.left; ctx.dragOffsetY = e.clientY - rect.top;
    });
    div.addEventListener('mouseup', e => {
      const dur = Date.now() - clickStartTime;
      const dist = Math.sqrt(Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2));
      if (dur < 300 && dist < 10) ctx.openSidebar(n);
    });
    div.addEventListener('dblclick', e => {
      e.stopPropagation(); e.preventDefault();
      ctx.savedGroupState = { expanded: new Set(ctx.expandedGroups), panX: ctx.panX, panY: ctx.panY, scale: ctx.scale };
      ctx.enterDrillDown(n);
    });
    ctx.nodesLayer.appendChild(div);
    ctx.groupEntityElements[n.id] = div;
    return div;
  }

  // ── Render views ───────────────────────────────────────────────────────────

  function renderGroupedView(): void {
    if (!ctx.groupsData) return;
    ctx.currentView = 'grouped';
    ctx.isGroupedMode = true;
    ctx.nodesLayer.innerHTML = '';
    ctx.groupContainersLayer.innerHTML = '';
    ctx.svg.innerHTML = '';
    ctx.nodeElements = {}; ctx.groupNodeElements = {}; ctx.groupCenterMarkerElements = {};
    ctx.groupRectBorderElements = {}; ctx.groupEntityElements = {}; ctx.groupEntityPositions = {};
    const backBtn = ctx.root.querySelector('#backBtn') as HTMLElement | null;
    if (backBtn) backBtn.style.display = 'none';
    const titleEl = ctx.root.querySelector('#headerTitle') as HTMLElement | null;
    if (titleEl) titleEl.textContent = ctx.modelLabel + ' - Grouped ERD';
    const topStats = ctx.root.querySelector('#topStats') as HTMLElement | null;
    if (topStats) topStats.style.display = 'flex';

    buildGroupData();
    layoutGroupForce();

    ctx.groupNodesList.forEach(g => { if (ctx.expandedGroups.has(g.name)) layoutEntitiesForceDirected(g.name); });
    if (ctx.expandedGroups.size > 0) {
      ensureNoOverlap(null);
      ctx.groupNodesList.forEach(g => { if (ctx.expandedGroups.has(g.name)) layoutEntitiesForceDirected(g.name); });
    }
    ctx.groupNodesList.forEach(g => {
      if (ctx.expandedGroups.has(g.name)) {
        createGroupRect(g);
        g.objects.forEach((objId, idx) => {
          const n = ctx.nodes.find(nn => nn.id === objId);
          if (!n) return;
          const ePos = ctx.groupEntityPositions[objId];
          if (!ePos) return;
          const div = createEntityNode(n, g.name);
          div.style.left = ePos.x + 'px'; div.style.top = ePos.y + 'px';
          setTimeout(() => { div.classList.add('group-entity-visible'); }, 30 + idx * 25);
        });
      } else {
        createGroupCircle(g);
      }
    });

    redrawGroupEdges();
    fitGroupedViewport();
    updateGroupButtons();
  }

  function renderListGroupedView(): void {
    if (!ctx.groupsData) return;
    ctx.currentView = 'listGrouped' as any;
    ctx.nodesLayer.innerHTML = ''; ctx.groupContainersLayer.innerHTML = ''; ctx.svg.innerHTML = '';
    listGroupNodePositions = {}; listGroupNodeElements = {}; ctx.nodeElements = {};
    const backBtn = ctx.root.querySelector('#backBtn') as HTMLElement | null;
    if (backBtn) backBtn.style.display = 'none';
    const titleEl = ctx.root.querySelector('#headerTitle') as HTMLElement | null;
    if (titleEl) titleEl.textContent = ctx.modelLabel + ' - List Grouped ERD';
    const topStats = ctx.root.querySelector('#topStats') as HTMLElement | null;
    if (topStats) topStats.style.display = 'flex';
    const gc = ctx.root.querySelector('#groupControls') as HTMLElement | null;
    if (gc) gc.classList.remove('visible');

    buildGroupData();

    const COLS = 10, CELL_W = 180, CELL_H = 190, HEADER_H = 40, GROUP_GAP = 50, LEFT_PAD = 40;
    let curY = 40;

    ctx.groupNodesList.forEach(g => {
      const header = document.createElement('div');
      header.className = 'list-group-header';
      header.innerHTML = g.name + ' <span class="lg-count">' + g.count + '</span>';
      const rows = Math.ceil(g.objects.length / COLS);
      const headerW = Math.max(400, Math.min(COLS, g.objects.length) * CELL_W);
      header.style.left = LEFT_PAD + 'px'; header.style.top = curY + 'px'; header.style.width = headerW + 'px';
      ctx.groupContainersLayer.appendChild(header);
      curY += HEADER_H;

      g.objects.forEach((objId, idx) => {
        const n = ctx.nodes.find(nn => nn.id === objId);
        if (!n) return;
        const col = idx % COLS, row = Math.floor(idx / COLS);
        const nx = LEFT_PAD + col * CELL_W, ny = curY + row * CELL_H;
        listGroupNodePositions[n.id] = { x: nx, y: ny };
        const div = document.createElement('div');
        div.className = 'node ' + getNodeClass(n) + (n.unmapped ? ' node-unmapped' : '');
        div.id = 'lgn-' + n.id; div.setAttribute('data-node-id', n.id);
        const iconSvg = getNodeIcon(ctx, n);
        const isShared = n.tableType === 'Shared', isBase = !!n.baseModelApiName;
        const needsWrap = isShared || isBase;
        const sharedBadge = isShared ? '<div class="shared-badge">' + ctx.sharedSvg + '</div>' : '';
        const baseBadge = isBase ? '<div class="base-model-badge">BASE</div>' : '';
        const circleHtml = '<div class="node-circle"><div class="node-icon">' + iconSvg + '</div></div>';
        div.innerHTML = (needsWrap ? '<div class="node-circle-wrap">' + circleHtml + sharedBadge + baseBadge + '</div>' : circleHtml) + '<div class="node-label"><div class="node-title">' + n.label + '</div></div>';
        div.style.left = nx + 'px'; div.style.top = ny + 'px';
        div.addEventListener('click', e => { e.stopPropagation(); ctx.openSidebar(n); });
        div.addEventListener('mouseenter', () => { listGroupHoverIn(n.id); });
        div.addEventListener('mouseleave', () => { listGroupHoverOut(); });
        ctx.nodesLayer.appendChild(div);
        listGroupNodeElements[n.id] = div;
      });
      curY += rows * CELL_H + GROUP_GAP;
    });

    listGroupTotalH = curY;
    fitListGroupedViewport(curY);
  }

  function listGroupHoverIn(nodeId: string): void {
    if (listHoverActive) listGroupHoverOut();
    listHoverActive = true;
    const connectedIds = new Set([nodeId]);
    const relEdges: any[] = [];
    ctx.edges.forEach(e => {
      if (e.from === nodeId || e.to === nodeId) { connectedIds.add(e.from); connectedIds.add(e.to); relEdges.push(e); }
    });
    Object.keys(listGroupNodeElements).forEach(id => {
      const el = listGroupNodeElements[id];
      if (connectedIds.has(id)) { el.classList.add('list-hover-related'); el.classList.remove('list-hover-dimmed'); }
      else { el.classList.add('list-hover-dimmed'); el.classList.remove('list-hover-related'); }
    });
    ctx.svg.innerHTML = '';
    if (relEdges.length === 0) return;
    createArrowMarkers(ctx.svg, { default: '#0070d2' }, 'lghover-');
    const portMap = isClassicMode(ctx) ? null : buildPortMap(relEdges, listGroupNodePositions, ctx.NODE_SIZE);
    relEdges.forEach((edge, idx) => {
      const fp = listGroupNodePositions[edge.from], tp = listGroupNodePositions[edge.to];
      if (!fp || !tp) return;
      const r = ctx.NODE_SIZE / 2;
      let d: string;
      if (isClassicMode(ctx)) {
        const fcx = fp.x + r, fcy = fp.y + r, tcx = tp.x + r, tcy = tp.y + r;
        const angle = Math.atan2(tcy - fcy, tcx - fcx);
        const fex = fcx + Math.cos(angle) * (r + 5), fey = fcy + Math.sin(angle) * (r + 5);
        const tex = tcx - Math.cos(angle) * (r + 10), tey = tcy - Math.sin(angle) * (r + 10);
        d = generateClassicPath(fex, fey, tex, tey, 20 * (idx % 2 === 0 ? 1 : -1)).d;
      } else {
        const fcx = fp.x + r, fcy = fp.y + r, tcx = tp.x + r, tcy = tp.y + r;
        const fSide = getSide(fcx, fcy, tcx, tcy), tSide = getSide(tcx, tcy, fcx, fcy);
        const edgeId = edge.from + '>' + edge.to;
        const fOff = getPortOffset(edgeId, edge.from, fSide, portMap!, ctx.NODE_SIZE);
        const tOff = getPortOffset(edgeId, edge.to, tSide, portMap!, ctx.NODE_SIZE);
        const fPt = getPortPoint(fcx, fcy, fSide, fOff, r + 2);
        const tPt = getPortPoint(tcx, tcy, tSide, tOff, r + 8);
        d = generateRoutedPath(ctx, fPt.x, fPt.y, tPt.x, tPt.y, 20 * (idx % 2 === 0 ? 1 : -1), listGroupNodePositions, ctx.NODE_SIZE);
      }
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d); glow.setAttribute('stroke', '#0070d2'); glow.setAttribute('stroke-width', edgeGlowWidth());
      glow.setAttribute('fill', 'none'); glow.setAttribute('opacity', edgeGlowOpacity()); glow.setAttribute('stroke-linecap', 'round');
      ctx.svg.appendChild(glow);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d); path.setAttribute('stroke', '#0070d2'); path.setAttribute('stroke-width', edgeStroke());
      path.setAttribute('fill', 'none'); path.setAttribute('marker-end', 'url(#lghover-default)'); path.setAttribute('stroke-linecap', 'round');
      ctx.svg.appendChild(path);
    });
  }

  function listGroupHoverOut(): void {
    if (!listHoverActive) return;
    listHoverActive = false; ctx.svg.innerHTML = '';
    Object.keys(listGroupNodeElements).forEach(id => { listGroupNodeElements[id].classList.remove('list-hover-dimmed', 'list-hover-related'); });
  }

  // ── Group expand/collapse ──────────────────────────────────────────────────

  function expandGroup(groupName: string): void {
    if (ctx.isTransitioning) return;
    ctx.isTransitioning = true;
    ctx.expandedGroups.add(groupName);
    ensureNoOverlap(groupName);
    animateRepositionGroupElements(groupName, () => { doExpandGroup(groupName); });
  }

  function doExpandGroup(groupName: string): void {
    const circle = ctx.groupNodeElements[groupName];
    if (circle) { const inner = circle.querySelector('.group-circle-inner'); if (inner) inner.classList.add('group-circle-shrink'); }
    const g = ctx.groupNodesList.find(gg => gg.name === groupName);
    if (!g) { ctx.isTransitioning = false; return; }
    layoutEntitiesForceDirected(groupName);
    createGroupRect(g);
    const center = getGroupCenter(groupName);
    g.objects.forEach((objId, idx) => {
      const n = ctx.nodes.find(nn => nn.id === objId);
      if (!n) return;
      const finalPos = ctx.groupEntityPositions[objId];
      if (!finalPos) return;
      const div = createEntityNode(n, groupName);
      div.style.left = (center.x - ctx.NODE_SIZE / 2) + 'px'; div.style.top = (center.y - ctx.NODE_SIZE / 2) + 'px';
      setTimeout(() => { div.style.left = finalPos.x + 'px'; div.style.top = finalPos.y + 'px'; div.classList.add('group-entity-visible'); }, 50 + idx * 35);
    });
    setTimeout(() => {
      if (circle) { circle.remove(); delete ctx.groupNodeElements[groupName]; }
      redrawGroupEdges(); updateGroupButtons(); animateFitGroupedViewport();
      ctx.isTransitioning = false;
    }, 100 + g.count * 35 + 350);
  }

  function collapseGroup(groupName: string): void {
    if (ctx.isTransitioning) return;
    ctx.isTransitioning = true;
    ctx.expandedGroups.delete(groupName);
    const center = getGroupCenter(groupName);
    const g = ctx.groupNodesList.find(gg => gg.name === groupName);
    if (!g) { ctx.isTransitioning = false; return; }
    g.objects.forEach(objId => {
      const el = ctx.groupEntityElements[objId];
      if (el) { el.style.left = (center.x - ctx.NODE_SIZE / 2) + 'px'; el.style.top = (center.y - ctx.NODE_SIZE / 2) + 'px'; el.classList.add('group-entity-collapse'); }
    });
    const marker = ctx.groupCenterMarkerElements[groupName], rectBorder = ctx.groupRectBorderElements[groupName];
    setTimeout(() => {
      g.objects.forEach(objId => {
        const el = ctx.groupEntityElements[objId]; if (el) { el.remove(); delete ctx.groupEntityElements[objId]; } delete ctx.groupEntityPositions[objId];
      });
      if (marker) { marker.remove(); delete ctx.groupCenterMarkerElements[groupName]; }
      if (rectBorder) { rectBorder.remove(); delete ctx.groupRectBorderElements[groupName]; }
      createGroupCircle(g); ensureNoOverlap(null);
      ctx.groupNodesList.forEach(gg => {
        const pos = ctx.groupNodePositions[gg.name], gEl = ctx.groupNodeElements[gg.name];
        if (pos && gEl) { gEl.style.left = pos.x + 'px'; gEl.style.top = pos.y + 'px'; }
      });
      redrawGroupEdges(); updateGroupButtons(); animateFitGroupedViewport();
      ctx.isTransitioning = false;
    }, 350);
  }

  function expandAllGroups(): void {
    if (ctx.isTransitioning) return;
    ctx.isTransitioning = true;
    const toExpand = ctx.groupNodesList.filter(g => !ctx.expandedGroups.has(g.name));
    if (toExpand.length === 0) { ctx.isTransitioning = false; return; }
    toExpand.forEach(g => { ctx.expandedGroups.add(g.name); });
    ensureNoOverlap(null);
    animateRepositionGroupElements(null, () => {
      toExpand.forEach(g => { const circle = ctx.groupNodeElements[g.name]; if (circle) { circle.remove(); delete ctx.groupNodeElements[g.name]; } });
      ctx.groupNodesList.forEach(g => { if (ctx.expandedGroups.has(g.name)) layoutEntitiesForceDirected(g.name); });
      toExpand.forEach(g => {
        createGroupRect(g);
        g.objects.forEach((objId, idx) => {
          const n = ctx.nodes.find(nn => nn.id === objId); if (!n) return;
          const ePos = ctx.groupEntityPositions[objId]; if (!ePos) return;
          const div = createEntityNode(n, g.name);
          div.style.left = ePos.x + 'px'; div.style.top = ePos.y + 'px';
          setTimeout(() => { div.classList.add('group-entity-visible'); }, 30 + idx * 25);
        });
      });
      redrawGroupEdges(); updateGroupButtons(); animateFitGroupedViewport();
      ctx.isTransitioning = false;
    });
  }

  function collapseAllGroups(): void {
    if (ctx.isTransitioning) return;
    const expanded = Array.from(ctx.expandedGroups);
    if (expanded.length === 0) return;
    expanded.forEach(name => {
      ctx.expandedGroups.delete(name);
      const g = ctx.groupNodesList.find(gg => gg.name === name); if (!g) return;
      const center = getGroupCenter(name);
      g.objects.forEach(objId => {
        const el = ctx.groupEntityElements[objId];
        if (el) { el.style.left = (center.x - ctx.NODE_SIZE / 2) + 'px'; el.style.top = (center.y - ctx.NODE_SIZE / 2) + 'px'; el.classList.add('group-entity-collapse'); }
      });
    });
    setTimeout(() => {
      expanded.forEach(name => {
        const g = ctx.groupNodesList.find(gg => gg.name === name); if (!g) return;
        g.objects.forEach(objId => { const el = ctx.groupEntityElements[objId]; if (el) { el.remove(); delete ctx.groupEntityElements[objId]; } delete ctx.groupEntityPositions[objId]; });
        const marker = ctx.groupCenterMarkerElements[name]; if (marker) { marker.remove(); delete ctx.groupCenterMarkerElements[name]; }
        const rb = ctx.groupRectBorderElements[name]; if (rb) { rb.remove(); delete ctx.groupRectBorderElements[name]; }
      });
      let cx = 0, cy = 0, cnt = 0;
      ctx.groupNodesList.forEach(g => { const p = ctx.groupNodePositions[g.name]; if (p) { cx += p.x; cy += p.y; cnt++; } });
      if (cnt > 0) { cx /= cnt; cy /= cnt; }
      ctx.groupNodesList.forEach(g => { const p = ctx.groupNodePositions[g.name]; if (p) { p.x = cx + (p.x - cx) * 0.25; p.y = cy + (p.y - cy) * 0.25; } });
      ensureNoOverlap(null);
      ctx.groupNodesList.forEach(g => { createGroupCircle(g); });
      redrawGroupEdges(); updateGroupButtons(); fitGroupedViewport();
    }, 350);
  }

  function updateGroupButtons(): void {
    const expandBtn = ctx.root.querySelector('#expandAllBtn') as HTMLButtonElement | null;
    const collapseBtn = ctx.root.querySelector('#collapseAllBtn') as HTMLButtonElement | null;
    if (expandBtn) expandBtn.disabled = ctx.expandedGroups.size === ctx.groupNodesList.length;
    if (collapseBtn) collapseBtn.disabled = ctx.expandedGroups.size === 0;
  }

  return {
    buildGroupData, renderGroupedView, renderListGroupedView, redrawGroupEdges,
    fitGroupedViewport, animateFitGroupedViewport, fitListGroupedViewport,
    updateGroupButtons, expandGroup, collapseGroup, expandAllGroups, collapseAllGroups,
    createGroupCircle, createGroupRect, createEntityNode, createArrowMarkers,
  };
}