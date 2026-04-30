/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root
 */

interface DCDimensionField {
  name: string;
  displayName: string;
  dataType: string;
  isPrimaryIndex?: boolean;
  keyQualifierName?: string;
  required?: boolean;
}

interface DCMeasurementField {
  name: string;
  displayName: string;
  dataType: string;
  aggregationType?: string;
  isPrimaryIndex?: boolean;
  required?: boolean;
}

interface DCDataObject {
  name: string;
  displayName: string;
  description?: string;
  dataSpaceName: string;
  dataObjectType: 'Dmo' | 'Dlo' | 'Cio';
  shouldIncludeAllFields: boolean;
  category: string;
  creationType: string;
  semanticDimensions: DCDimensionField[];
  semanticMeasurements: DCMeasurementField[];
}

type PickerMode = 'add' | 'create';
type TabType = 'Dmo' | 'Dlo' | 'Cio';

interface SelectedObject {
  dcObject: DCDataObject;
  selectedDimensions: Set<string>;
  selectedMeasurements: Set<string>;
}

interface VscodeApi {
  postMessage(msg: Record<string, unknown>): void;
}

const CHECK_MARK = '\u2713';
const TYPE_LABELS: Record<string, string> = { Dmo: 'DMO', Dlo: 'DLO', Cio: 'CI' };
const ALL_TABS: TabType[] = ['Dmo', 'Dlo', 'Cio'];

// ─── State ───────────────────────────────────────────────────────────────────

let vscode: VscodeApi;
let mode: PickerMode = 'add';
let existingObjectNames: Set<string> = new Set();
let activeTab: TabType = 'Dmo';
let searchTerm = '';
let selectedObjects: Map<string, SelectedObject> = new Map();
let focusedObjectName: string | null = null;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SEARCH_DEBOUNCE_MS = 500;
let generation = 0;

// Per-tab cache: null = not loaded, array = loaded
const tabCache: Record<TabType, DCDataObject[] | null> = { Dmo: null, Dlo: null, Cio: null };
const tabLoading: Record<TabType, boolean> = { Dmo: false, Dlo: false, Cio: false };
const tabHasMore: Record<TabType, boolean> = { Dmo: true, Dlo: true, Cio: true };
const tabLoadingMore: Record<TabType, boolean> = { Dmo: false, Dlo: false, Cio: false };

// ─── DOM refs ────────────────────────────────────────────────────────────────

let objectsListEl: HTMLElement;
let fieldsPanelEl: HTMLElement;
let searchInput: HTMLInputElement;
let confirmBtn: HTMLButtonElement;
let selectionCountEl: HTMLElement;
let tabDmo: HTMLElement;
let tabDlo: HTMLElement;
let tabCio: HTMLElement;
let badgeDmo: HTMLElement;
let badgeDlo: HTMLElement;
let badgeCio: HTMLElement;

// Metadata form (create mode)
let metadataFormEl: HTMLElement;
let metaLabelInput: HTMLInputElement;
let metaApiNameInput: HTMLInputElement;
let metaDataspaceInput: HTMLSelectElement;
let metaLabelError: HTMLElement;
let metaApiNameError: HTMLElement;
let metaDataspaceError: HTMLElement;
let userEditedApiName = false;

// ─── Init ────────────────────────────────────────────────────────────────────

export function initPicker(root: HTMLElement): void {
  vscode = typeof (globalThis as any).acquireVsCodeApi !== 'undefined'
    ? (globalThis as any).acquireVsCodeApi()
    : { postMessage: () => undefined };

  objectsListEl = root.querySelector('#objectsList') as HTMLElement;
  fieldsPanelEl = root.querySelector('#fieldsPanel') as HTMLElement;
  searchInput = root.querySelector('#searchInput') as HTMLInputElement;
  confirmBtn = root.querySelector('#confirmBtn') as HTMLButtonElement;
  selectionCountEl = root.querySelector('#selectionCount') as HTMLElement;
  tabDmo = root.querySelector('#tabDmo') as HTMLElement;
  tabDlo = root.querySelector('#tabDlo') as HTMLElement;
  tabCio = root.querySelector('#tabCio') as HTMLElement;
  badgeDmo = root.querySelector('#badgeDmo') as HTMLElement;
  badgeDlo = root.querySelector('#badgeDlo') as HTMLElement;
  badgeCio = root.querySelector('#badgeCio') as HTMLElement;

  // Metadata form refs
  metadataFormEl = root.querySelector('#metadataForm') as HTMLElement;
  metaLabelInput = root.querySelector('#metaLabel') as HTMLInputElement;
  metaApiNameInput = root.querySelector('#metaApiName') as HTMLInputElement;
  metaDataspaceInput = root.querySelector('#metaDataspace') as HTMLSelectElement;
  metaLabelError = root.querySelector('#metaLabelError') as HTMLElement;
  metaApiNameError = root.querySelector('#metaApiNameError') as HTMLElement;
  metaDataspaceError = root.querySelector('#metaDataspaceError') as HTMLElement;

  metaLabelInput.addEventListener('input', () => {
    if (!userEditedApiName) {
      metaApiNameInput.value = toCamelCase(metaLabelInput.value);
    }
    validateMetadata();
    updateFooter();
  });
  metaApiNameInput.addEventListener('input', () => {
    userEditedApiName = metaApiNameInput.value.length > 0;
    validateMetadata();
    updateFooter();
  });
  metaDataspaceInput.addEventListener('change', () => {
    generation++;
    selectedObjects.clear();
    focusedObjectName = null;
    searchTerm = '';
    searchInput.value = '';
    for (const t of ALL_TABS) {
      tabCache[t] = null; tabLoading[t] = false;
      tabHasMore[t] = true; tabLoadingMore[t] = false;
    }
    updateAllBadges();
    renderObjectsList();
    renderFieldsPanel();
    validateMetadata();
    updateFooter();

    vscode.postMessage({ command: 'dataspaceChanged', dataspace: metaDataspaceInput.value });
    requestTabIfNeeded(activeTab);
  });

  searchInput.addEventListener('input', () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const newTerm = searchInput.value.trim();
      if (newTerm === searchTerm) return;
      searchTerm = newTerm;
      generation++;

      for (const t of ALL_TABS) {
        tabCache[t] = null;
        tabLoading[t] = false;
        tabHasMore[t] = true;
        tabLoadingMore[t] = false;
      }
      updateAllBadges();
      vscode.postMessage({ command: 'searchChanged', search: searchTerm });
      requestTabIfNeeded(activeTab);
    }, SEARCH_DEBOUNCE_MS);
  });

  tabDmo.addEventListener('click', () => setTab('Dmo'));
  tabDlo.addEventListener('click', () => setTab('Dlo'));
  tabCio.addEventListener('click', () => setTab('Cio'));

  objectsListEl.addEventListener('scroll', handleObjectsScroll);

  confirmBtn.addEventListener('click', handleConfirm);

  root.querySelector('#cancelBtn')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'cancel' });
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;

    if (msg.command === 'ready') {
      mode = msg.mode || 'add';
      existingObjectNames = new Set(msg.existingObjectNames || []);
      selectedObjects.clear();
      focusedObjectName = null;
      userEditedApiName = false;

      searchTerm = '';
      searchInput.value = '';
      for (const t of ALL_TABS) {
        tabCache[t] = null; tabLoading[t] = false;
        tabHasMore[t] = true; tabLoadingMore[t] = false;
      }

      const headerEl = root.querySelector('#pickerTitle') as HTMLElement;
      if (headerEl) {
        headerEl.textContent = mode === 'create'
          ? 'Create New Semantic Model'
          : 'Add Data Objects to Model';
      }
      if (confirmBtn) {
        confirmBtn.textContent = mode === 'create' ? 'Create Model' : 'Add Selected';
      }
      if (metadataFormEl) {
        metadataFormEl.style.display = mode === 'create' ? 'flex' : 'none';
      }

      updateAllBadges();
      updateFooter();

      if (mode === 'create') {
        metaLabelInput.focus();
      } else {
        requestTabIfNeeded(activeTab);
      }
    }

    if (msg.command === 'tabDataLoaded') {
      if (msg.generation !== undefined && msg.generation !== generation) return;
      const tab = msg.tab as TabType;
      tabCache[tab] = msg.dcObjects || [];
      tabLoading[tab] = false;
      tabHasMore[tab] = !!msg.hasMore;
      updateBadge(tab);

      if (tab === activeTab) {
        renderObjectsList();
        renderFieldsPanel();
      }
    }

    if (msg.command === 'tabDataAppended') {
      if (msg.generation !== undefined && msg.generation !== generation) return;
      const tab = msg.tab as TabType;
      const newItems = (msg.dcObjects || []) as DCDataObject[];
      tabLoadingMore[tab] = false;
      tabHasMore[tab] = !!msg.hasMore;
      if (tabCache[tab]) {
        tabCache[tab]!.push(...newItems);
      }
      updateBadge(tab);

      if (tab === activeTab) {
        appendObjectRows(newItems);
      }
    }

    if (msg.command === 'tabDataError') {
      if (msg.generation !== undefined && msg.generation !== generation) return;
      const tab = msg.tab as TabType;
      tabLoading[tab] = false;
      tabLoadingMore[tab] = false;
      tabCache[tab] = tabCache[tab] ?? [];
      tabHasMore[tab] = false;
      updateBadge(tab);

      if (tab === activeTab) {
        renderObjectsList();
      }
    }

    if (msg.command === 'dataspaceListLoaded') {
      const dataspaces = (msg.dataspaces || []) as Array<{ name: string; label: string }>;
      while (metaDataspaceInput.firstChild) metaDataspaceInput.removeChild(metaDataspaceInput.firstChild);

      for (const ds of dataspaces) {
        const opt = document.createElement('option');
        opt.value = ds.name;
        opt.textContent = ds.label;
        metaDataspaceInput.appendChild(opt);
      }

      const defaultOpt = dataspaces.find(ds => ds.name === 'default');
      if (defaultOpt) {
        metaDataspaceInput.value = 'default';
      } else if (dataspaces.length > 0) {
        metaDataspaceInput.value = dataspaces[0].name;
      }

      validateMetadata();
      updateFooter();
      requestTabIfNeeded(activeTab);
    }
  });
}

// ─── Tab data fetching ───────────────────────────────────────────────────────

function requestTabIfNeeded(tab: TabType): void {
  if (tabCache[tab] !== null) {
    renderObjectsList();
    renderFieldsPanel();
    return;
  }
  if (tabLoading[tab]) return;

  tabLoading[tab] = true;
  showTabLoading();
  vscode.postMessage({ command: 'requestTabData', tab, generation });
}

function showTabLoading(): void {
  while (objectsListEl.firstChild) objectsListEl.removeChild(objectsListEl.firstChild);
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  overlay.appendChild(spinner);
  overlay.appendChild(document.createTextNode(' Loading ' + (TYPE_LABELS[activeTab] || '') + ' objects...'));
  objectsListEl.appendChild(overlay);
}

// ─── Tab switching ───────────────────────────────────────────────────────────

function setTab(tab: TabType): void {
  activeTab = tab;
  [tabDmo, tabDlo, tabCio].forEach(t => t.classList.remove('active'));
  const tabEl = tab === 'Dmo' ? tabDmo : tab === 'Dlo' ? tabDlo : tabCio;
  tabEl.classList.add('active');
  focusedObjectName = null;
  requestTabIfNeeded(tab);
  renderFieldsPanel();
}

function updateBadge(tab: TabType): void {
  const count = tabCache[tab]?.length ?? 0;
  const el = tab === 'Dmo' ? badgeDmo : tab === 'Dlo' ? badgeDlo : badgeCio;
  while (el.firstChild) el.removeChild(el.firstChild);

  if (tabCache[tab] === null) {
    el.textContent = '...';
  } else {
    el.appendChild(document.createTextNode(String(count) + (tabHasMore[tab] ? '+' : '')));
    if (tabLoadingMore[tab]) {
      const dot = document.createElement('span');
      dot.className = 'badge-spinner';
      el.appendChild(dot);
    }
  }
}

function updateAllBadges(): void {
  for (const t of ALL_TABS) updateBadge(t);
}

// ─── Objects list rendering ──────────────────────────────────────────────────

function getTabObjects(): DCDataObject[] {
  return tabCache[activeTab] ?? [];
}

function requestMoreIfNeeded(): void {
  const tab = activeTab;
  if (!tabHasMore[tab] || tabLoadingMore[tab] || tabLoading[tab]) return;
  tabLoadingMore[tab] = true;
  const offset = tabCache[tab]?.length ?? 0;

  updateBadge(tab);

  const loaderEl = objectsListEl.querySelector('.loading-more-row');
  if (loaderEl) {
    loaderEl.textContent = '';
    const spinner = document.createElement('div');
    spinner.className = 'spinner spinner-small';
    loaderEl.appendChild(spinner);
    loaderEl.appendChild(document.createTextNode(' Loading more...'));
  }

  vscode.postMessage({ command: 'requestMoreTabData', tab, offset, generation });
}

function buildObjectRow(obj: DCDataObject): HTMLElement {
  const inModel = existingObjectNames.has(obj.name);
  const isSelected = selectedObjects.has(obj.name);
  const isFocused = focusedObjectName === obj.name;

  const row = document.createElement('div');
  row.className = 'object-row' + (isFocused ? ' selected' : '') + (inModel ? ' in-model' : '');

  const cb = document.createElement('span');
  cb.className = 'obj-cb' + ((inModel || isSelected) ? ' checked' : '') + (inModel ? ' disabled' : '');
  cb.textContent = (inModel || isSelected) ? CHECK_MARK : '';

  if (!inModel) {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleObject(obj, !selectedObjects.has(obj.name));
    });
  }

  const icon = document.createElement('span');
  icon.className = 'obj-type-icon ' + obj.dataObjectType;
  icon.textContent = TYPE_LABELS[obj.dataObjectType] || obj.dataObjectType;

  const nameDiv = document.createElement('div');
  nameDiv.className = 'obj-name';
  nameDiv.setAttribute('title', obj.name);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'obj-label';
  labelSpan.textContent = obj.displayName;

  const apiSpan = document.createElement('span');
  apiSpan.className = 'obj-api';
  apiSpan.textContent = obj.name;

  nameDiv.appendChild(labelSpan);
  nameDiv.appendChild(apiSpan);

  row.appendChild(cb);
  row.appendChild(icon);
  row.appendChild(nameDiv);

  if (inModel) {
    const badge = document.createElement('span');
    badge.className = 'in-model-label';
    badge.textContent = 'In Model';
    row.appendChild(badge);
  }

  row.addEventListener('click', () => {
    focusedObjectName = obj.name;
    renderObjectsList();
    renderFieldsPanel();
  });

  return row;
}

let renderedCount = 0;

function renderObjectsList(): void {
  if (tabLoading[activeTab]) {
    renderedCount = 0;
    showTabLoading();
    return;
  }

  const objects = getTabObjects();
  const savedScroll = objectsListEl.scrollTop;

  while (objectsListEl.firstChild) objectsListEl.removeChild(objectsListEl.firstChild);

  if (objects.length === 0 && !tabLoadingMore[activeTab]) {
    renderedCount = 0;
    const empty = document.createElement('div');
    empty.className = 'empty-list';
    empty.textContent = 'No ' + (TYPE_LABELS[activeTab] || activeTab) + ' objects found';
    objectsListEl.appendChild(empty);
    return;
  }

  for (const obj of objects) {
    objectsListEl.appendChild(buildObjectRow(obj));
  }

  if (tabLoadingMore[activeTab] || tabHasMore[activeTab]) {
    const loader = document.createElement('div');
    loader.className = 'loading-more-row';
    if (tabLoadingMore[activeTab]) {
      const spinner = document.createElement('div');
      spinner.className = 'spinner spinner-small';
      loader.appendChild(spinner);
      loader.appendChild(document.createTextNode(' Loading more...'));
    }
    objectsListEl.appendChild(loader);
  }

  renderedCount = objects.length;
  objectsListEl.scrollTop = savedScroll;
  scheduleAutoLoad();
}

function appendObjectRows(newItems: DCDataObject[]): void {
  const loaderEl = objectsListEl.querySelector('.loading-more-row');
  if (loaderEl) loaderEl.remove();

  for (const obj of newItems) {
    objectsListEl.appendChild(buildObjectRow(obj));
  }

  if (tabLoadingMore[activeTab] || tabHasMore[activeTab]) {
    const loader = document.createElement('div');
    loader.className = 'loading-more-row';
    if (tabLoadingMore[activeTab]) {
      const spinner = document.createElement('div');
      spinner.className = 'spinner spinner-small';
      loader.appendChild(spinner);
      loader.appendChild(document.createTextNode(' Loading more...'));
    }
    objectsListEl.appendChild(loader);
  }

  renderedCount = tabCache[activeTab]?.length ?? 0;
  scheduleAutoLoad();
}

function scheduleAutoLoad(): void {
  setTimeout(() => {
    const el = objectsListEl;
    if (el.scrollHeight <= el.clientHeight || el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      requestMoreIfNeeded();
    }
  }, 50);
}

function handleObjectsScroll(): void {
  const el = objectsListEl;
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 60;
  if (nearBottom) {
    requestMoreIfNeeded();
  }
}

// ─── Object selection toggle ─────────────────────────────────────────────────

function toggleObject(obj: DCDataObject, checked: boolean): void {
  if (checked) {
    const dims = new Set<string>(obj.semanticDimensions.map(d => d.name));
    const meas = new Set<string>(obj.semanticMeasurements.map(m => m.name));
    selectedObjects.set(obj.name, { dcObject: obj, selectedDimensions: dims, selectedMeasurements: meas });
    focusedObjectName = obj.name;
  } else {
    selectedObjects.delete(obj.name);
    if (focusedObjectName === obj.name) focusedObjectName = null;
  }
  renderObjectsList();
  renderFieldsPanel();
  updateFooter();
}

// ─── Fields panel rendering ──────────────────────────────────────────────────

function renderFieldsPanel(): void {
  while (fieldsPanelEl.firstChild) fieldsPanelEl.removeChild(fieldsPanelEl.firstChild);

  if (!focusedObjectName) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const title = document.createElement('div');
    title.className = 'empty-state-title';
    title.textContent = 'Select an object';
    const desc = document.createElement('div');
    desc.className = 'empty-state-desc';
    desc.textContent = 'Click on an object to view and select its fields';
    empty.appendChild(title);
    empty.appendChild(desc);
    fieldsPanelEl.appendChild(empty);
    return;
  }

  // Find the focused object across all cached tabs
  let obj: DCDataObject | undefined;
  for (const t of ALL_TABS) {
    obj = tabCache[t]?.find(o => o.name === focusedObjectName);
    if (obj) break;
  }
  if (!obj) return;

  const inModel = existingObjectNames.has(obj.name);
  const sel = selectedObjects.get(obj.name);
  const isCio = obj.dataObjectType === 'Cio';

  if (!inModel && sel && !isCio) {
    const toggleableDimNames = obj.semanticDimensions
      .filter(d => !d.isPrimaryIndex && !d.keyQualifierName && !d.required)
      .map(d => d.name);
    const toggleableMeasNames = obj.semanticMeasurements.map(m => m.name);
    const allToggleable = [...toggleableDimNames, ...toggleableMeasNames];

    if (allToggleable.length > 0) {
      fieldsPanelEl.appendChild(createSelectAllRow(toggleableDimNames, toggleableMeasNames, sel));
    }
  }

  if (obj.semanticDimensions.length > 0) {
    const header = document.createElement('div');
    header.className = 'category-header';
    const dot = document.createElement('span');
    dot.className = 'cat-dot dim';
    header.appendChild(dot);
    header.appendChild(document.createTextNode('Dimensions (' + obj.semanticDimensions.length + ')'));
    fieldsPanelEl.appendChild(header);

    for (const d of obj.semanticDimensions) {
      fieldsPanelEl.appendChild(createFieldRow(
        'dim', d.name, d.displayName, d.dataType,
        !!d.isPrimaryIndex, !!d.keyQualifierName,
        inModel, sel, isCio
      ));
    }
  }

  if (obj.semanticMeasurements.length > 0) {
    const header = document.createElement('div');
    header.className = 'category-header';
    const dot = document.createElement('span');
    dot.className = 'cat-dot meas';
    header.appendChild(dot);
    header.appendChild(document.createTextNode('Measurements (' + obj.semanticMeasurements.length + ')'));
    fieldsPanelEl.appendChild(header);

    for (const m of obj.semanticMeasurements) {
      const typeText = m.dataType + (m.aggregationType ? ' / ' + m.aggregationType : '');
      fieldsPanelEl.appendChild(createFieldRow(
        'meas', m.name, m.displayName, typeText,
        false, false,
        inModel, sel, isCio
      ));
    }
  }

  if (obj.semanticDimensions.length === 0 && obj.semanticMeasurements.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const title = document.createElement('div');
    title.className = 'empty-state-title';
    title.textContent = 'No fields available';
    empty.appendChild(title);
    fieldsPanelEl.appendChild(empty);
  }
}

function createSelectAllRow(
  toggleableDimNames: string[],
  toggleableMeasNames: string[],
  sel: SelectedObject
): HTMLElement {
  const allSelected =
    toggleableDimNames.every(n => sel.selectedDimensions.has(n)) &&
    toggleableMeasNames.every(n => sel.selectedMeasurements.has(n));

  const row = document.createElement('div');
  row.className = 'field-row select-all-row' + (allSelected ? ' checked' : '');
  row.style.cursor = 'pointer';

  const cb = document.createElement('span');
  cb.className = 'field-cb';
  cb.textContent = allSelected ? CHECK_MARK : '';

  const labelEl = document.createElement('span');
  labelEl.className = 'field-name select-all-label';
  labelEl.textContent = allSelected ? 'Deselect All' : 'Select All';

  row.appendChild(cb);
  row.appendChild(labelEl);

  row.addEventListener('click', () => {
    if (allSelected) {
      for (const name of toggleableDimNames) sel.selectedDimensions.delete(name);
      for (const name of toggleableMeasNames) sel.selectedMeasurements.delete(name);
    } else {
      for (const name of toggleableDimNames) sel.selectedDimensions.add(name);
      for (const name of toggleableMeasNames) sel.selectedMeasurements.add(name);
    }
    renderFieldsPanel();
  });

  return row;
}

function createFieldRow(
  fieldType: 'dim' | 'meas',
  fieldName: string,
  displayName: string,
  dataType: string,
  isPK: boolean,
  isKQ: boolean,
  inModel: boolean,
  sel: SelectedObject | undefined,
  isCio: boolean
): HTMLElement {
  const isLocked = isPK || isKQ || isCio;
  const targetSet = sel ? (fieldType === 'dim' ? sel.selectedDimensions : sel.selectedMeasurements) : null;
  const isChecked = targetSet ? targetSet.has(fieldName) : false;
  const disabled = inModel || isLocked || !sel;

  const row = document.createElement('div');
  const effectiveChecked = isChecked || (isLocked && !!sel);
  row.className = 'field-row' + (effectiveChecked ? ' checked' : '');

  const cb = document.createElement('span');
  cb.className = 'field-cb' + (disabled ? ' disabled' : '');
  cb.textContent = effectiveChecked ? CHECK_MARK : '';

  if (!disabled && sel) {
    row.addEventListener('click', () => {
      if (targetSet!.has(fieldName)) {
        targetSet!.delete(fieldName);
      } else {
        targetSet!.add(fieldName);
      }
      renderFieldsPanel();
    });
    row.style.cursor = 'pointer';
  }

  const nameSpan = document.createElement('span');
  nameSpan.className = 'field-name';
  nameSpan.textContent = displayName;
  nameSpan.setAttribute('title', fieldName);

  const typeSpan = document.createElement('span');
  typeSpan.className = 'field-type-tag';
  typeSpan.textContent = dataType;

  row.appendChild(cb);
  row.appendChild(nameSpan);
  row.appendChild(typeSpan);

  if (isPK) {
    const badge = document.createElement('span');
    badge.className = 'field-badge pk';
    badge.textContent = 'PK';
    row.appendChild(badge);
  }
  if (isKQ) {
    const badge = document.createElement('span');
    badge.className = 'field-badge kq';
    badge.textContent = 'KQ';
    row.appendChild(badge);
  }

  return row;
}

// ─── Metadata helpers ────────────────────────────────────────────────────────

function toCamelCase(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9_ ]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map((w, i) => i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function validateMetadata(): boolean {
  if (mode !== 'create') return true;

  let valid = true;

  const label = metaLabelInput.value.trim();
  if (!label) {
    metaLabelError.textContent = 'Model Name is required';
    metaLabelInput.classList.add('invalid');
    valid = false;
  } else {
    metaLabelError.textContent = '';
    metaLabelInput.classList.remove('invalid');
  }

  const apiName = metaApiNameInput.value.trim();
  if (!apiName) {
    metaApiNameError.textContent = 'API Name is required';
    metaApiNameInput.classList.add('invalid');
    valid = false;
  } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(apiName)) {
    metaApiNameError.textContent = 'Must start with a letter, only alphanumeric/underscore';
    metaApiNameInput.classList.add('invalid');
    valid = false;
  } else {
    metaApiNameError.textContent = '';
    metaApiNameInput.classList.remove('invalid');
  }

  const dataspace = metaDataspaceInput.value.trim();
  if (!dataspace) {
    metaDataspaceError.textContent = 'Dataspace is required';
    metaDataspaceInput.classList.add('invalid');
    valid = false;
  } else {
    metaDataspaceError.textContent = '';
    metaDataspaceInput.classList.remove('invalid');
  }

  return valid;
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function updateFooter(): void {
  const count = selectedObjects.size;
  while (selectionCountEl.firstChild) selectionCountEl.removeChild(selectionCountEl.firstChild);

  selectionCountEl.appendChild(document.createTextNode(
    count === 0 ? 'No objects selected' : count + ' object' + (count > 1 ? 's' : '') + ' selected'
  ));

  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'selection-badge';
    badge.textContent = String(count);
    selectionCountEl.appendChild(badge);
  }

  const metadataValid = mode === 'create' ? validateMetadata() : true;
  confirmBtn.disabled = count === 0 || !metadataValid;
}

// ─── Confirm action ──────────────────────────────────────────────────────────

function handleConfirm(): void {
  if (mode === 'create' && !validateMetadata()) return;

  const result: Array<{
    name: string;
    displayName: string;
    dataObjectType: string;
    shouldIncludeAllFields: boolean;
    selectedDimensions: string[];
    selectedMeasurements: string[];
    allDimensions: DCDimensionField[];
    allMeasurements: DCMeasurementField[];
  }> = [];

  for (const [, sel] of selectedObjects) {
    result.push({
      name: sel.dcObject.name,
      displayName: sel.dcObject.displayName,
      dataObjectType: sel.dcObject.dataObjectType,
      shouldIncludeAllFields: sel.dcObject.shouldIncludeAllFields,
      selectedDimensions: Array.from(sel.selectedDimensions),
      selectedMeasurements: Array.from(sel.selectedMeasurements),
      allDimensions: sel.dcObject.semanticDimensions,
      allMeasurements: sel.dcObject.semanticMeasurements,
    });
  }

  const msg: Record<string, unknown> = { command: 'confirm', selectedObjects: result };

  if (mode === 'create') {
    msg.metadata = {
      label: metaLabelInput.value.trim(),
      apiName: metaApiNameInput.value.trim(),
      dataspace: metaDataspaceInput.value.trim(),
    };
  }

  vscode.postMessage(msg);
}

// ─── Expose globally ─────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  (window as any).initPicker = initPicker;
}
