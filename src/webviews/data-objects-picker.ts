/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import * as fs from 'fs';
import * as path from 'path';
import { sldsHead } from '../utils/webview-utils';

function resolveFile(name: string, ...searchDirs: string[]): string {
  for (const dir of searchDirs) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8');
  }
  return '';
}

export function getDataObjectsPickerContent(
  sldsUri: string,
  cspSource: string
): string {
  const staticDir = path.join(__dirname, 'webview-static');
  const devDir = path.join(__dirname, '..', '..', 'src', 'webviews', 'data-objects-picker-split');

  const css = resolveFile('data-objects-picker.css', staticDir, devDir);
  const js = resolveFile('data-objects-picker.js', __dirname);

  return `<!DOCTYPE html>
<html>
<head>
  ${sldsHead(sldsUri, undefined, cspSource)}
  <style>${css}</style>
</head>
<body>
  <div class="picker-root">
    <div class="picker-header">
      <h2 id="pickerTitle">Add Data Objects to Model</h2>
    </div>

    <div class="metadata-form" id="metadataForm" style="display:none;">
      <div class="meta-field">
        <label class="meta-label" for="metaLabel">Model Name</label>
        <input class="meta-input" type="text" id="metaLabel" placeholder="e.g. My Sales Model" />
        <span class="meta-error" id="metaLabelError"></span>
      </div>
      <div class="meta-field">
        <label class="meta-label" for="metaApiName">API Name</label>
        <input class="meta-input" type="text" id="metaApiName" placeholder="e.g. mySalesModel" />
        <span class="meta-error" id="metaApiNameError"></span>
      </div>
      <div class="meta-field">
        <label class="meta-label" for="metaDataspace">Dataspace</label>
        <select class="meta-input" id="metaDataspace">
          <option value="" disabled selected>Loading dataspaces...</option>
        </select>
        <span class="meta-error" id="metaDataspaceError"></span>
      </div>
    </div>

    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="Search objects..." />
    </div>

    <div class="type-tabs">
      <button class="type-tab active" id="tabDmo">DMO <span class="badge" id="badgeDmo">0</span></button>
      <button class="type-tab" id="tabDlo">DLO <span class="badge" id="badgeDlo">0</span></button>
      <button class="type-tab" id="tabCio">CI <span class="badge" id="badgeCio">0</span></button>
    </div>

    <div class="split-panel">
      <div class="objects-list" id="objectsList">
        <div class="loading-overlay"><div class="spinner"></div> Loading data objects...</div>
      </div>
      <div class="fields-panel" id="fieldsPanel">
        <div class="empty-state">Click an object to view its fields</div>
      </div>
    </div>

    <div class="picker-footer">
      <span class="selection-count" id="selectionCount">No objects selected</span>
      <div class="btn-group">
        <button class="btn-secondary" id="cancelBtn">Cancel</button>
        <button class="btn-primary" id="confirmBtn" disabled>Add Selected</button>
      </div>
    </div>
  </div>

  <script>
    ${js}
    var _init = (typeof PickerApp !== 'undefined' && PickerApp.initPicker) || (typeof initPicker === 'function' ? initPicker : null);
    if (_init) _init(document.body);
  </script>
</body>
</html>`;
}
