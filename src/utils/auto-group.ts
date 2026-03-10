import { RawSemanticModel, DataObject, LogicalView } from '../v2/types';
import {
  WELL_KNOWN_MAPPINGS,
  CLOUD_CATEGORIES,
  CategoryDefinition,
} from './cloud-keywords';

export interface GroupEntry {
  name: string;
  objects: string[];
}

export interface GroupsConfig {
  groups: GroupEntry[];
  ungrouped: string[];
}

interface EntitySignals {
  apiName: string;
  tokens: string[];
  label: string;
  description: string;
  dataObjectName: string;
  unionMemberTokens: string[];
}

const ENTITY_KEYWORD_WEIGHT = 3;
const LABEL_KEYWORD_WEIGHT = 2;
const UNION_MEMBER_WEIGHT = 2;
const DESCRIPTION_KEYWORD_WEIGHT = 1;
const DATA_OBJECT_NAME_WEIGHT = 1;
const MIN_SCORE_THRESHOLD = 2;

/**
 * Tokenize a name by splitting on underscores, camelCase boundaries,
 * and numeric suffixes, then lowercasing.
 */
function tokenize(name: string): string[] {
  if (!name) { return []; }
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(t => t.length > 1 && !/^\d+$/.test(t));
}

/**
 * Strip common suffixes/prefixes from an apiName for cleaner matching.
 * Removes trailing numeric IDs (e.g., Products50 -> Products),
 * _lv suffix, _LV/LV1 suffixes.
 */
function normalizeApiName(apiName: string): string {
  return apiName
    .replace(/\d+$/, '')
    .replace(/_lv$/i, '')
    .replace(/_LV\d*$/i, '');
}

/**
 * Extract the core name from a dataObjectName like "ssot__Account__dlm" -> "account"
 */
function extractFromDataObjectName(name: string): string[] {
  if (!name) { return []; }
  const match = name.match(/^ssot__(.+?)__dlm$/);
  if (match) {
    return tokenize(match[1]);
  }
  const dlmMatch = name.match(/^(.+?)__dlm$/);
  if (dlmMatch) {
    return tokenize(dlmMatch[1]);
  }
  return tokenize(name);
}

function getDescription(obj: unknown): string {
  if (obj && typeof obj === 'object' && 'description' in obj && typeof (obj as { description: unknown }).description === 'string') {
    return (obj as { description: string }).description;
  }
  return '';
}

function collectDataObjectSignals(obj: DataObject): EntitySignals {
  const normalized = normalizeApiName(obj.apiName);
  return {
    apiName: obj.apiName,
    tokens: tokenize(normalized),
    label: (obj.label || '').toLowerCase(),
    description: getDescription(obj).toLowerCase(),
    dataObjectName: (obj.dataObjectName || '').toLowerCase(),
    unionMemberTokens: [],
  };
}

function collectLogicalViewSignals(lv: LogicalView): EntitySignals {
  const normalized = normalizeApiName(lv.apiName);

  const unionMemberTokens: string[] = [];
  for (const union of lv.semanticUnions || []) {
    for (const sdo of union.semanticDataObjects || []) {
      const sdoNormalized = normalizeApiName(sdo.apiName);
      unionMemberTokens.push(...tokenize(sdoNormalized));
      if (sdo.dataObjectName) {
        unionMemberTokens.push(...extractFromDataObjectName(sdo.dataObjectName));
      }
    }
  }
  for (const sdo of lv.semanticDataObjects || []) {
    if (sdo.dataObjectName) {
      unionMemberTokens.push(...extractFromDataObjectName(sdo.dataObjectName));
    }
  }

  return {
    apiName: lv.apiName,
    tokens: tokenize(normalized),
    label: (lv.label || '').toLowerCase(),
    description: getDescription(lv).toLowerCase(),
    dataObjectName: '',
    unionMemberTokens,
  };
}

function tryStaticMapping(signals: EntitySignals): string | null {
  const normalized = normalizeApiName(signals.apiName).toLowerCase();
  if (WELL_KNOWN_MAPPINGS[normalized]) {
    return WELL_KNOWN_MAPPINGS[normalized];
  }

  const joined = signals.tokens.join('_');
  if (WELL_KNOWN_MAPPINGS[joined]) {
    return WELL_KNOWN_MAPPINGS[joined];
  }

  const dmoTokens = extractFromDataObjectName(
    signals.dataObjectName || ''
  ).join('_');
  if (dmoTokens && WELL_KNOWN_MAPPINGS[dmoTokens]) {
    return WELL_KNOWN_MAPPINGS[dmoTokens];
  }

  return null;
}

function scoreEntityAgainstCategory(
  signals: EntitySignals,
  category: CategoryDefinition
): number {
  let score = 0;

  for (const keyword of category.entityKeywords) {
    const kwTokens = keyword.split('_');
    if (signals.tokens.some(t => kwTokens.includes(t))) {
      score += ENTITY_KEYWORD_WEIGHT;
    }
    if (signals.label.includes(keyword.replace(/_/g, ' '))) {
      score += LABEL_KEYWORD_WEIGHT;
    }
  }

  for (const keyword of category.entityKeywords) {
    const kwTokens = keyword.split('_');
    if (signals.unionMemberTokens.some(t => kwTokens.includes(t))) {
      score += UNION_MEMBER_WEIGHT;
    }
  }

  for (const keyword of category.descriptionKeywords) {
    if (signals.description.includes(keyword)) {
      score += DESCRIPTION_KEYWORD_WEIGHT;
    }
  }

  if (signals.dataObjectName) {
    const dmoTokens = extractFromDataObjectName(signals.dataObjectName);
    for (const keyword of category.entityKeywords) {
      const kwTokens = keyword.split('_');
      if (dmoTokens.some(t => kwTokens.includes(t))) {
        score += DATA_OBJECT_NAME_WEIGHT;
      }
    }
  }

  return score;
}

function classifyEntity(signals: EntitySignals): string {
  const staticResult = tryStaticMapping(signals);
  if (staticResult) {
    return staticResult;
  }

  let bestCategory = '';
  let bestScore = 0;

  for (const category of CLOUD_CATEGORIES) {
    const score = scoreEntityAgainstCategory(signals, category);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category.name;
    }
  }

  if (bestScore >= MIN_SCORE_THRESHOLD) {
    return bestCategory;
  }

  return '';
}

/**
 * Auto-group all data objects and logical views in a semantic model
 * into Salesforce Cloud categories. Returns a GroupsConfig ready
 * to be written to metadata/groups.json.
 */
export function autoGroupEntities(rawModel: RawSemanticModel): GroupsConfig {
  const categoryMap = new Map<string, string[]>();
  const ungrouped: string[] = [];

  for (const obj of rawModel.dataObjects) {
    const signals = collectDataObjectSignals(obj);
    const category = classifyEntity(signals);
    if (category) {
      const list = categoryMap.get(category) || [];
      list.push(obj.apiName);
      categoryMap.set(category, list);
    } else {
      ungrouped.push(obj.apiName);
    }
  }

  for (const lv of rawModel.logicalViews) {
    const signals = collectLogicalViewSignals(lv);
    const category = classifyEntity(signals);
    if (category) {
      const list = categoryMap.get(category) || [];
      list.push(lv.apiName);
      categoryMap.set(category, list);
    } else {
      ungrouped.push(lv.apiName);
    }
  }

  const categoryOrder = CLOUD_CATEGORIES.map(c => c.name);
  const groups: GroupEntry[] = [];
  for (const name of categoryOrder) {
    const objects = categoryMap.get(name);
    if (objects && objects.length > 0) {
      groups.push({ name, objects: objects.sort() });
    }
  }

  return { groups, ungrouped: ungrouped.sort() };
}
