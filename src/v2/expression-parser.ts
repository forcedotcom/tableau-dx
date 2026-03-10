/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import { ExpressionReference } from './types';

/**
 * Parses a calculated field expression and extracts all entity references.
 *
 * Patterns:
 *   [ObjectApiName].[FieldApiName]  → { objectApiName: "ObjectApiName", fieldApiName: "FieldApiName" }
 *   [StandaloneRef]                 → { objectApiName: null, fieldApiName: "StandaloneRef" }
 *
 * Skips content inside double-quoted string literals ("...").
 */
export function parseExpressionReferences(expression: string): ExpressionReference[] {
  if (!expression) {
    return [];
  }

  const refs: ExpressionReference[] = [];
  const cleaned = stripStringLiterals(expression);

  const dotPattern = /\[([^\]]+)\]\.\[([^\]]+)\]/g;
  const dotMatches = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = dotPattern.exec(cleaned)) !== null) {
    refs.push({
      objectApiName: match[1],
      fieldApiName: match[2],
      raw: match[0],
    });
    dotMatches.add(match.index + ':' + match[0].length);
  }

  const standalonePattern = /\[([^\]]+)\]/g;
  while ((match = standalonePattern.exec(cleaned)) !== null) {
    const isPartOfDotRef = Array.from(dotMatches).some((key) => {
      const [startStr, lenStr] = key.split(':');
      const start = parseInt(startStr, 10);
      const end = start + parseInt(lenStr, 10);
      return match!.index >= start && match!.index < end;
    });

    if (!isPartOfDotRef) {
      refs.push({
        objectApiName: null,
        fieldApiName: match[1],
        raw: match[0],
      });
    }
  }

  return refs;
}

/**
 * Replaces double-quoted string literal content with spaces,
 * preserving character positions so regex indices remain valid.
 */
function stripStringLiterals(expr: string): string {
  const chars = expr.split('');
  let inString = false;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '"') {
      if (inString) {
        chars[i] = ' ';
        inString = false;
      } else {
        chars[i] = ' ';
        inString = true;
      }
    } else if (inString) {
      chars[i] = ' ';
    }
  }
  return chars.join('');
}