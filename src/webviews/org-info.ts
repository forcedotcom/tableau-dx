import { OrgInfo } from '../types';
import { escapeHtml, formatLimitName } from '../utils/formatting';
import { sldsHead } from '../utils/webview-utils';

export function getOrgInfoWebviewContent(orgInfo: OrgInfo, apiResult: unknown, sldsUri: string): string {
  const org = orgInfo.result;
  
  const limits = apiResult as Record<string, { Max: number; Remaining: number }>;
  const interestingLimits = [
    'DailyApiRequests',
    'DailyAsyncApexExecutions',
    'DailyBulkApiRequests',
    'DataStorageMB',
    'FileStorageMB',
  ];

  const limitsHtml = interestingLimits
    .filter((key) => limits[key])
    .map((key) => {
      const limit = limits[key];
      const used = limit.Max - limit.Remaining;
      const percentage = Math.round((used / limit.Max) * 100);
      const barDescriptor = percentage > 80 ? 'expired' : percentage > 50 ? 'warning' : 'complete';

      return `
        <div class="slds-m-bottom_medium">
          <div class="slds-grid slds-grid_align-spread slds-m-bottom_xx-small">
            <span class="slds-text-body_regular slds-text-font_monospace">${formatLimitName(key)}</span>
            <span class="slds-text-color_weak">${used.toLocaleString()} / ${limit.Max.toLocaleString()}</span>
          </div>
          <div class="slds-progress-bar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" role="progressbar">
            <span class="slds-progress-bar__value slds-progress-bar__value_${barDescriptor}" style="width: ${percentage}%;">
              <span class="slds-assistive-text">${percentage}%</span>
            </span>
          </div>
        </div>
      `;
    })
    .join('');

  const customStyles = `
    .slds-scope { padding: 2rem; }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${sldsHead(sldsUri, customStyles)}
  <title>Salesforce Org Info</title>
</head>
<body>
  <div class="slds-scope">
    <div style="max-width:800px;margin:0 auto;">

      <div class="slds-page-header slds-m-bottom_large">
        <div class="slds-page-header__row">
          <div class="slds-page-header__col-title">
            <div class="slds-media">
              <div class="slds-media__figure">
                <span class="slds-icon_container slds-icon-standard-account">
                  <svg class="slds-icon" aria-hidden="true">
                    <use xlink:href="#"></use>
                  </svg>
                </span>
              </div>
              <div class="slds-media__body">
                <div class="slds-page-header__name">
                  <div class="slds-page-header__name-title">
                    <h1>
                      <span class="slds-page-header__title slds-truncate" title="Salesforce Org">Salesforce Org</span>
                    </h1>
                  </div>
                </div>
                <p class="slds-page-header__name-meta">Connected and ready &bull; API v59.0</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <article class="slds-card slds-m-bottom_large">
        <div class="slds-card__header slds-grid">
          <header class="slds-media slds-media_center slds-has-flexi-truncate">
            <div class="slds-media__body">
              <h2 class="slds-card__header-title">
                <span>Organization Details</span>
              </h2>
            </div>
          </header>
        </div>
        <div class="slds-card__body slds-card__body_inner">
          <div class="slds-grid slds-wrap slds-gutters">
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_medium">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">Username</dt>
                <dd class="slds-text-body_regular slds-text-color_default">${escapeHtml(org.username)}</dd>
              </dl>
            </div>
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_medium">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">Status</dt>
                <dd><span class="slds-badge slds-badge_success">${escapeHtml(org.connectedStatus)}</span></dd>
              </dl>
            </div>
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_medium">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">Instance URL</dt>
                <dd class="slds-text-body_regular">${escapeHtml(org.instanceUrl)}</dd>
              </dl>
            </div>
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_medium">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">Org ID</dt>
                <dd class="slds-text-body_regular slds-text-font_monospace">${escapeHtml(org.id)}</dd>
              </dl>
            </div>
            ${org.alias ? `
            <div class="slds-col slds-size_1-of-2 slds-m-bottom_medium">
              <dl>
                <dt class="slds-text-title_caps slds-m-bottom_xx-small">Alias</dt>
                <dd class="slds-text-body_regular">${escapeHtml(org.alias)}</dd>
              </dl>
            </div>
            ` : ''}
          </div>
        </div>
      </article>

      <article class="slds-card">
        <div class="slds-card__header slds-grid">
          <header class="slds-media slds-media_center slds-has-flexi-truncate">
            <div class="slds-media__body">
              <h2 class="slds-card__header-title">
                <span>API Limits</span>
              </h2>
            </div>
          </header>
        </div>
        <div class="slds-card__body slds-card__body_inner">
          ${limitsHtml}
        </div>
      </article>

    </div>
  </div>
</body>
</html>`;
}
