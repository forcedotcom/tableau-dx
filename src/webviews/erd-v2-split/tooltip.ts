/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

/**
 * Global tooltip system — replaces native browser title tooltips with
 * instant, styled tooltips that appear on hover with no delay.
 *
 * Handles two cases:
 *  1. Any element with a `title` attribute (buttons, legend swatches, etc.)
 *  2. Truncated `.cell-text` spans in the data preview table
 */
export function initTooltip(root: HTMLElement): void {
  const tip = root.querySelector('#uiTooltip') as HTMLElement | null;
  if (!tip) return;

  let activeEl: HTMLElement | null = null;

  function show(anchor: HTMLElement, text: string): void {
    tip!.textContent = text;
    tip!.classList.add('visible');
    const r = anchor.getBoundingClientRect();
    const rootR = root.getBoundingClientRect();

    tip!.style.left = (r.left - rootR.left) + 'px';
    tip!.style.top = (r.top - rootR.top - 6) + 'px';
    tip!.style.transform = 'translateY(-100%)';

    requestAnimationFrame(() => {
      const tipR = tip!.getBoundingClientRect();
      if (tipR.top < rootR.top) {
        tip!.style.top = (r.bottom - rootR.top + 6) + 'px';
        tip!.style.transform = 'translateY(0)';
      }
      if (tipR.right > rootR.right) {
        tip!.style.left = Math.max(0, (r.right - rootR.left - tipR.width)) + 'px';
      }
    });
  }

  function hide(): void {
    tip!.classList.remove('visible');
    if (activeEl) {
      const saved = activeEl.getAttribute('data-original-title');
      if (saved) {
        activeEl.setAttribute('title', saved);
        activeEl.removeAttribute('data-original-title');
      }
      activeEl = null;
    }
  }

  root.addEventListener('mouseover', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    const titled = target.closest('[title]') as HTMLElement | null;
    if (titled && titled.getAttribute('title')) {
      if (titled.closest('#leftPanel.expanded')) return;
      if (titled === activeEl) return;
      hide();
      activeEl = titled;
      const text = titled.getAttribute('title')!;
      titled.setAttribute('data-original-title', text);
      titled.removeAttribute('title');
      show(titled, text);
      return;
    }

    const cell = target.closest('.cell-text') as HTMLElement | null;
    if (cell && cell.scrollWidth > cell.clientWidth) {
      if (cell === activeEl) return;
      hide();
      activeEl = cell;
      show(cell, cell.textContent || '');
      return;
    }
  }, true);

  root.addEventListener('mouseout', (e: MouseEvent) => {
    if (!activeEl) return;
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (activeEl.contains(related) || activeEl === related)) return;
    hide();
  }, true);
}
