# Semantic Model UI Representation Rules

Local-first dependency analysis and placement rules for ERD V2.

## Entity Inventory

### Entities with placement logic (shown in drill-down)

| Entity Type | Source File | Reference Mechanism | Can be Cross-Object? |
|---|---|---|---|
| Calculated Dimensions | `calculatedDimensions.json` | Expression parsing: `[Object].[Field]`, `[CalcRef]` | Yes |
| Calculated Measurements | `calculatedMeasurements.json` | Expression parsing: same as above | Yes |
| Dimension Hierarchies | `dimensionHierarchies.json` | `levels[].definitionApiName` | Yes |
| Metrics | `metrics.json` | `measurementReference.tableFieldReference.tableApiName` + `timeDimensionReference.tableFieldReference.tableApiName` | Yes |
| Groupings | `groupings.json` | `fieldReference.tableFieldReference.tableApiName` | No (always single-object) |

### Structural entities (ERD topology)

| Entity Type | Source File | Role |
|---|---|---|
| Data Objects | `dataObjects.json` | Primary tables (DMOs) with dimensions + measurements |
| Logical Views | `logicalViews.json` | Virtual tables: HardJoin (inner objects + relationships) or Union |
| Relationships | `relationships.json` | Joins between data objects |
| Parameters | `parameters.json` | User input variables, referenced in expressions but not dependencies |

### Metadata entities (no visual placement)

| Entity Type | Source File |
|---|---|
| Model Info | `modelInfo.json` |
| Fields Overrides | `fieldsOverrides.json` |
| Model Filters | `modelFilters.json` |

## Unified Placement Rule

One rule applies to ALL placeable entity types:

- **Exclusive** (1 referenced object): entity references exactly 1 data object or logical view. Placed inside that object's related entities in the drill-down view.
- **Cross-Object** (2+ referenced objects): entity references 2 or more data objects/logical views. Shown as a bridge connecting those objects.
- **Orphan** (0 referenced objects): entity references no resolvable data objects. Shown in a separate section.

## Expression Parsing Rules (Calculated Fields)

Calculated field expressions are strings containing references in bracket notation.

### Patterns

| Pattern | Example | Meaning |
|---|---|---|
| `[Object].[Field]` | `[Account1613].[Account_Id1185]` | Direct reference to a data object's field |
| `[StandaloneRef]` | `[CalcFieldApiName]` | Reference to another calc field, parameter, or data object |
| `function([Ref])` | `count([Account1613])` | Function wrapping a reference (reference is still extracted) |
| `"string literal"` | `"hello"` | Ignored entirely |

### Classification of standalone `[X]` references

When a standalone `[X]` token is found (not part of `[X].[Y]`), it is classified by checking against known entity registries in this order:

1. Is `X` a known data object or logical view API name? → data object dependency
2. Is `X` a known calculated field API name? → calc-to-calc dependency (triggers transitive resolution)
3. Otherwise → ignored (likely a parameter or unknown)

## Transitive Dependency Resolution

Only calculated fields can reference other calculated fields. When CalcA's expression contains `[CalcB]`:

1. CalcA has a direct calc reference to CalcB
2. CalcB is resolved to find its own referenced objects
3. CalcB's resolved objects are added to CalcA's resolved objects
4. This is recursive: if CalcB references CalcC, CalcC's objects also flow up to CalcA

Circular references are detected and broken (visited set prevents infinite loops).

### Example chain

```
CalcA expression: [CalcB] + [Account1613].[Name]
CalcB expression: [Account_Contact916].[Data_Source1849]

Direct refs for CalcA:  CalcB (calc), Account1613 (object)
Direct refs for CalcB:  Account_Contact916 (object)

Resolved objects for CalcB: { Account_Contact916 }
Resolved objects for CalcA: { Account1613, Account_Contact916 }  ← transitive!

CalcA placement: crossObject (2 objects)
CalcB placement: exclusive to Account_Contact916
```

## Reference Extraction for Non-Expression Entities

### Dimension Hierarchies

Each hierarchy has `levels[]` where each level specifies:
- `definitionApiName`: the data object API name
- `definitionFieldName`: the field within that object
- `definitionType`: always "DataObject"

Referenced objects = unique set of `definitionApiName` values from all levels.

### Metrics

Each metric can have:
- `measurementReference.tableFieldReference.tableApiName` → a data object
- `timeDimensionReference.tableFieldReference.tableApiName` → a data object (may be different)

Referenced objects = unique set of both table API names.

### Groupings

Each grouping has:
- `fieldReference.tableFieldReference.tableApiName` → a single data object

Referenced objects = always exactly 1 object (exclusive).

## UI Representation Structure

### DataObjectUI

Each data object in the UI model carries ALL entities that touch it:
- `relatedCalculatedDimensions` / `relatedCalculatedMeasurements`
- `relatedDimensionHierarchies`
- `relatedMetrics`
- `relatedGroupings`

Each related entity has:
- `placement`: 'exclusive' | 'crossObject' | 'orphan'
- `referencedObjects`: array of all data object API names it depends on

The UI uses these to determine visualization:
- `placement === 'exclusive'` → show as belonging only to this object
- `placement === 'crossObject'` → show as bridging to other objects in `referencedObjects`

### CalculatedFieldUI (additional properties)

Calc fields also carry:
- `directReferences`: the raw parsed expression references (before transitive resolution)

Combined with `SemanticModelUI.calculatedFieldsByApiName`, this enables walking dependency chains in the UI (e.g., CalcA → CalcB → Object).

## ERD Two-Level View

### Level 1: Top-Level ERD

- Data Objects and Logical Views as boxes
- Relationships as join lines
- Single-click → right panel details
- Double-click → drill down to Level 2

### Level 2: Object Drill-Down

When drilling into an object:
1. Center: the object with its native fields (dimensions + measurements)
2. Around it: exclusive entities (calcs, hierarchies, metrics, groupings)
3. Connected outward: cross-object entities bridging to other objects (shown at edges)
4. Calc chains: recursive CalcA → CalcB → Object shown with direction
5. Edge objects: other data objects connected via cross-object entities
