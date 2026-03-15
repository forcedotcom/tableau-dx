# Metric Dependency Analysis — ERD Drilldown

## Problem

Metrics can reference **calculated fields** (not just table fields), but the current code only captures table references. This means the ERD drilldown shows a metric connected directly to an object, but misses the intermediate calc chain.

## Example: `Win_Rate_mtc`

### Current ERD (wrong)
```
Win_Rate_mtc ──→ Opportunity (center)
```

### Correct dependency tree
```
Win_Rate_mtc (metric)
├── MEASURE: Win_Rate_clc (calc)
│   ├── Closed_Won_Opportunities_clc (calc) → Opportunity
│   └── Opportunities_Closed_clc (calc) → Opportunity
├── TIME DIM: Opportunity.Close_Date
└── INSIGHTS DIMS: Contact_Point_Address, Account, User, Opportunity
```

### What should the ERD show?
```
Win_Rate_mtc ──→ Win_Rate_clc ──→ Closed_Won_Opportunities_clc ──→ Opportunity (center)
                                └→ Opportunities_Closed_clc ──→ Opportunity (center)
          also → Opportunity (time dimension: Close_Date)
```

## Metric Structure (from API)

A metric has these reference types:

| Reference Type | Field in JSON | Can be a calc? | Currently captured? |
|---|---|---|---|
| **measurementReference** | `calculatedFieldApiName` OR `tableFieldReference` | YES | Only `tableFieldReference` |
| **timeDimensionReference** | `tableFieldReference` | Probably not | YES |
| **additionalDimensions** | `tableFieldReference` | TBD — check | NO |
| **filters** | `fieldName` | TBD — check | NO |
| **insightsDimensionsReferences** | `tableFieldReference` | Probably not | NO (insights only) |

## What Needs to Change

### 1. Type system (`src/v2/types.ts`)
- `Metric.measurementReference` currently typed as `{ tableFieldReference?: TableFieldReference }`
- Need to add `calculatedFieldApiName?: string`

### 2. Reference extractor (`src/v2/reference-extractors.ts`)
- `extractMetricReferencedObjects()` currently only reads `tableFieldReference`
- If `measurementReference.calculatedFieldApiName` exists, resolve that calc's objects transitively

### 3. Dependency resolver (`src/v2/dependency-resolver.ts`)
- Metrics with calc refs need the same transitive resolution as calc→calc chains

### 4. UI builder / ERD webview
- Store the `calculatedFieldApiName` on the metric entity
- In drilldown, treat metric→calc like a calc→calc edge
- Pull in intermediate calcs using the same injection logic we built for calc chains

## Questions to Decide

1. **Should the metric show ALL its references in the ERD?** (measure + time dim + additional dims) Or just the measurement reference?
2. **For additional dimensions** — can they reference calc fields too? Need to check real data.
3. **For filters** — can they reference calc fields? Need to check real data.
4. **Should metrics that reference calcs show the full chain?** Or just one level (metric → calc)?

## Also Check Tomorrow

- Dimension hierarchies — do they ever reference calc fields instead of objects?
- Groupings — same question
- Any other entity types with indirect references
