/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function formatLimitName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function formatJsonWithSyntaxHighlighting(obj: unknown): string {
  const jsonString = JSON.stringify(obj, null, 2);
  
  // Escape HTML first
  const escaped = jsonString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Add syntax highlighting
  return escaped
    // Strings (but not keys)
    .replace(/: "(.*?)"/g, ': <span class="string">"$1"</span>')
    // Keys
    .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
    // Numbers
    .replace(/: (\d+\.?\d*)/g, ': <span class="number">$1</span>')
    // Booleans
    .replace(/: (true|false)/g, ': <span class="boolean">$1</span>')
    // Null
    .replace(/: (null)/g, ': <span class="null">$1</span>');
}