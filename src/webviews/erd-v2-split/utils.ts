/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import type { ErdContext, ErdNode, DiffStatus } from './types';

export function escapeHtmlStr(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getDiffClassFromStatus(ds: DiffStatus | null | undefined): string {
  if (!ds || ds === 'unchanged') return '';
  if (ds === 'added') return ' diff-added';
  if (ds === 'modified') return ' diff-modified';
  if (ds === 'removed') return ' diff-removed';
  return '';
}

export function getDiffClass(ctx: ErdContext, nodeOrApiName: ErdNode | string): string {
  if (!ctx.isCompareMode) return '';
  if (typeof nodeOrApiName === 'object' && nodeOrApiName !== null) {
    return getDiffClassFromStatus(nodeOrApiName.diffStatus);
  }
  const n = ctx.nodes.find(nn => nn.id === nodeOrApiName);
  return n ? getDiffClassFromStatus(n.diffStatus) : '';
}

export function getDiffStatus(ctx: ErdContext, nodeOrApiName: ErdNode | string): DiffStatus | null {
  if (!ctx.isCompareMode) return null;
  if (typeof nodeOrApiName === 'object' && nodeOrApiName !== null) {
    const ds = nodeOrApiName.diffStatus;
    return (ds && ds !== 'unchanged') ? ds : null;
  }
  const n = ctx.nodes.find(nn => nn.id === nodeOrApiName);
  if (n) { const ds = n.diffStatus; return (ds && ds !== 'unchanged') ? ds : null; }
  return null;
}

export function diffBadgeHtml(ctx: ErdContext, nodeOrApiNameOrDs: ErdNode | string): string {
  let s: DiffStatus | null = null;
  if (typeof nodeOrApiNameOrDs === 'string' && ['added', 'modified', 'removed'].includes(nodeOrApiNameOrDs)) {
    s = nodeOrApiNameOrDs as DiffStatus;
  } else {
    s = getDiffStatus(ctx, nodeOrApiNameOrDs);
  }
  if (!s || s === 'unchanged') return '';
  return '<span class="sidebar-diff-badge ' + s + '">' + ctx.diffLabels[s as 'added' | 'modified' | 'removed'] + '</span>';
}

export function getNodeClass(n: ErdNode): string {
  if (n.type === 'logicalView') return 'logical-view';
  if (n.dataObjectType === 'Cio') return 'calc-insight';
  if (n.dataObjectType === 'Dlo') return 'data-lake-object';
  return 'data-object';
}

export function getNodeIcon(ctx: ErdContext, n: ErdNode): string {
  if (n.type === 'logicalView') return ctx.tableSvg;
  if (n.dataObjectType === 'Cio') return ctx.calcInsightSvg;
  if (n.dataObjectType === 'Dlo') return ctx.dataLakeSvg;
  return ctx.dataModelSvg;
}

export function isClassicMode(ctx: ErdContext): boolean {
  return ctx.routingMode === 'classic';
}

export function formatCommitDate(isoStr: string): string {
  const d = new Date(isoStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function truncateStr(str: string, len: number): string {
  return str.length > len ? str.substring(0, len) + '...' : str;
}