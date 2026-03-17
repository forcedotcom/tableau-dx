/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

import { OrgInfo, SemanticModelsResponse } from '../types';
import { escapeHtml, formatJsonWithSyntaxHighlighting } from '../utils/formatting';
import { sldsHead } from '../utils/webview-utils';

export function getModelsWebviewContent(
  orgInfo: OrgInfo,
  modelsResponse: SemanticModelsResponse,
  searchTerm?: string,
  sldsUri?: string
): string {
  const org = orgInfo.result;
  const models = modelsResponse?.items ?? [];
  const totalCount = modelsResponse?.total ?? 0;

  const emptyStateHtml = `
    <div class="slds-illustration slds-illustration_small slds-p-around_large slds-text-align_center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="slds-m-bottom_medium">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
      <h3 class="slds-text-heading_medium slds-m-bottom_x-small">No Semantic Models Found</h3>
      <p class="slds-text-body_regular slds-text-color_weak">
        ${searchTerm
          ? 'No models match your search term "' + escapeHtml(searchTerm) + '".<br>Try a different search or clear the filter.'
          : 'This org doesn\'t have any semantic models yet.<br>Create one in Data Cloud to see it here.'}
      </p>
    </div>`;

  const modelCardsHtml = models.map((model) => {
    const createdDate = new Date(model.createdDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const modifiedDate = new Date(model.lastModifiedDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    return `
      <article class="slds-card slds-m-bottom_medium">
        <div class="slds-card__header slds-grid">
          <header class="slds-media slds-media_center slds-has-flexi-truncate">
            <div class="slds-media__figure">
              <span class="slds-icon_container slds-icon-standard-dataset">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="slds-icon slds-icon_small">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </span>
            </div>
            <div class="slds-media__body">
              <h2 class="slds-card__header-title">
                <span class="slds-truncate">${escapeHtml(model.label)}</span>
              </h2>
              <p class="slds-text-body_small slds-text-color_weak">${escapeHtml(model.apiName)}</p>
            </div>
            <div class="slds-no-flex">
              ${model.isLocked ? '<span class="slds-badge slds-badge_warning slds-m-right_xx-small">Locked</span>' : ''}
              <span class="slds-badge">${escapeHtml(model.sourceCreation)}</span>
            </div>
          </header>
        </div>
        <div class="slds-card__body slds-card__body_inner">
          <div class="slds-grid slds-wrap slds-gutters_small">
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_small">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">ID</dt>
                <dd class="slds-text-body_small slds-text-font_monospace slds-text-color_weak">${escapeHtml(model.id)}</dd>
              </dl>
            </div>
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_small">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">Dataspace</dt>
                <dd class="slds-text-body_small">${escapeHtml(model.dataspace)}</dd>
              </dl>
            </div>
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_small">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">Created</dt>
                <dd class="slds-text-body_small">${createdDate}</dd>
              </dl>
            </div>
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_small">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">Last Modified</dt>
                <dd class="slds-text-body_small">${modifiedDate}</dd>
              </dl>
            </div>
          </div>
        </div>
        <footer class="slds-card__footer">
          <span class="slds-text-title_caps slds-m-right_small">Related Resources:</span>
          <span class="slds-badge slds-m-right_xx-small">Data Objects</span>
          <span class="slds-badge slds-m-right_xx-small">Relationships</span>
          <span class="slds-badge slds-m-right_xx-small">Calc Dimensions</span>
          <span class="slds-badge slds-m-right_xx-small">Calc Measurements</span>
          <span class="slds-badge slds-m-right_xx-small">Groupings</span>
          <span class="slds-badge">Parameters</span>
        </footer>
      </article>`;
  }).join('');

  const modelsHtml = models.length === 0 ? emptyStateHtml : modelCardsHtml;

  const searchIndicator = searchTerm
    ? `<span class="slds-badge slds-m-left_small">Filtered by: <strong>${escapeHtml(searchTerm)}</strong></span>`
    : '';

  const customStyles = `
    .slds-scope { padding: 2rem; }
    .json-content pre { margin: 0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .json-content .string { color: #0070d2; }
    .json-content .number { color: #0b827c; }
    .json-content .boolean { color: #c23934; }
    .json-content .null { color: #706e6b; }
    .json-content .key { color: #080707; }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${sldsHead(sldsUri || '', customStyles)}
  <title>Semantic Models</title>
</head>
<body>
  <div class="slds-scope">
    <div style="max-width:900px;margin:0 auto;">

      <div class="slds-page-header slds-m-bottom_large">
        <div class="slds-page-header__row">
          <div class="slds-page-header__col-title">
            <div class="slds-media">
              <div class="slds-media__body">
                <div class="slds-page-header__name">
                  <div class="slds-page-header__name-title">
                    <h1>
                      <span class="slds-page-header__title slds-truncate">Semantic Models</span>
                    </h1>
                  </div>
                </div>
                <p class="slds-page-header__name-meta">
                  Data Cloud Semantic Layer &bull; API v65.0
                  ${searchIndicator}
                </p>
              </div>
            </div>
          </div>
          <div class="slds-page-header__col-actions">
            <div class="slds-page-header__controls">
              <span class="slds-badge">${escapeHtml(org.username)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="slds-grid slds-m-bottom_large">
        <div class="slds-col">
          <div class="slds-text-heading_large slds-m-right_small" style="display:inline;">${totalCount}</div>
          <span class="slds-text-title_caps">${searchTerm ? 'Matching Models' : 'Total Models'}</span>
        </div>
      </div>

      <div>
        ${modelsHtml}
      </div>

      <div class="slds-m-top_large slds-border_top slds-p-top_large">
        <div class="slds-grid slds-grid_align-spread slds-m-bottom_small">
          <span class="slds-text-title_caps">Raw API Response</span>
          <button class="slds-button slds-button_neutral slds-button_small" onclick="toggleJson()">Show/Hide</button>
        </div>
        <div class="slds-box json-content" id="jsonContainer">
          <pre>${formatJsonWithSyntaxHighlighting(modelsResponse)}</pre>
        </div>
      </div>

    </div>
  </div>
  <script>
    function toggleJson() {
      const container = document.getElementById('jsonContainer');
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
    }
  </script>
</body>
</html>`;
}