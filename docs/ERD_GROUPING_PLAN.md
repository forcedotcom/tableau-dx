# ERD Auto-Grouping Feature

## Problem

When a semantic model has 20+ data objects and logical views, the ERD becomes unreadable. We need a way to automatically group/cluster objects into logical categories so the ERD can show collapsed groups instead of individual nodes.

## Approach: Salesforce Cloud Category Grouping

Entities are classified into Salesforce Cloud categories using a two-layer keyword-based algorithm. No LLM required.

### Categories

- **Sales Cloud** -- Leads, opportunities, sales orders, forecasts, territories
- **Service Cloud** -- Cases, entitlements, knowledge, SLAs, operating hours
- **Marketing Cloud** -- Campaigns, engagements, messages, segments, digital content
- **Commerce Cloud** -- Products, catalogs, carts, stores, promotions
- **Experience Cloud** -- Communities, portals, sites
- **Field Service** -- Work orders, service appointments, technicians
- **Revenue Cloud** -- Billing, subscriptions, invoices, contracts, payments
- **Data Cloud** -- Individuals, accounts, contacts, contact points, identity resolution
- **Industry Clouds** -- Financial, healthcare, manufacturing-specific objects
- **Platform** -- Flows, date dimensions, utility/system objects

Only categories with at least one entity appear in the output.

### Classification Algorithm

**Layer 1 -- Static mapping (~80% of entities)**

A curated dictionary in `src/utils/cloud-keywords.ts` maps ~100 well-known Salesforce DMO `apiName` patterns directly to categories. This handles standard objects like `Opportunity` -> Sales Cloud, `Case` -> Service Cloud, etc.

**Layer 2 -- Weighted keyword scoring (~20% of entities)**

For entities not matched by the static map, the algorithm scores them against each category's keyword list using signals from:

- **apiName tokens** (weight 3) -- e.g., `Sales_Order` -> "sales", "order"
- **label tokens** (weight 2) -- e.g., "Bulk Email Message"
- **union member names** for logical views (weight 2) -- e.g., `Email_Engagement_LV`
- **description text** (weight 1) -- e.g., "...outbound marketing program..."
- **dataObjectName** (weight 1) -- e.g., `ssot__Lead__dlm` -> "lead"

The entity goes to the highest-scoring category. If no category scores above the minimum threshold, the entity goes to `ungrouped`.

### Why This Approach

- **No LLM required** -- works offline, no API keys
- **Deterministic** -- same input always produces the same output
- **Fast** -- pure string parsing, no network calls
- **User stays in control** -- can manually edit the output JSON file
- **Scalable** -- works from 10 to 1000+ objects

## Output: `metadata/groups.json`

```json
{
  "groups": [
    {
      "name": "Sales Cloud",
      "objects": ["Lead", "Opportunity", "Opportunity_Product", "Sales_Order", "Sales_Order_Product"]
    },
    {
      "name": "Service Cloud",
      "objects": ["Case", "Case_Update", "Operating_Hours"]
    },
    {
      "name": "Marketing Cloud",
      "objects": ["Bulk_Email_Message", "Campaign", "Campaign_Member", "Email_Engagement"]
    }
  ],
  "ungrouped": []
}
```

- `objects` arrays contain entity `apiName` values (matching `DataObject.apiName` and `LogicalView.apiName`)
- Groups are ordered by category (Sales, Service, Marketing, Commerce, Experience, Field Service, Revenue, Data, Industry, Platform)
- Objects within each group are sorted alphabetically

## Commands

| Command | Description |
| --- | --- |
| `Auto-Generate Groups` | Runs the classification algorithm, writes `metadata/groups.json`, opens it in the editor |

Right-click on `model.json` in the Explorer to access the command.

## Implementation Files

| File | Purpose |
| --- | --- |
| `src/utils/cloud-keywords.ts` | Static DMO mappings and keyword dictionaries per category |
| `src/utils/auto-group.ts` | Classification algorithm: tokenizer, scorer, `autoGroupEntities()` |
| `src/commands/auto-generate-groups.ts` | VS Code command handler |

## Validated Against C360 Model

The C360 model (36 data objects + 8 logical views = 44 entities) produces:

- **Sales Cloud (8)**: Opportunity, Opportunity_Product, Sales_Order, Sales_Order_Product, Lead, Leads78, sales_data17, OpportunitywithLead_lv
- **Service Cloud (3)**: Case, Case_Update, Operating_Hours
- **Marketing Cloud (16)**: Campaign, Campaign_Member, all engagement/message entities, marketing logical views
- **Commerce Cloud (3)**: Product, Products50, Goods_Product
- **Data Cloud (10)**: Individual, Account, Account_Contact, Contact Points, User, User_Group, identity-mapping LVs
- **Platform (4)**: Flow, Flow_Version, Flow_Element, DateDimSQL

0 ungrouped entities.

## ERD Rendering (Implemented)

Progressive disclosure view with no mode toggle -- one continuous view:

- **All collapsed (start)**: Group circles (160px) with aggregated edges and count badges between them
- **Expand a group**: Double-click a group circle -> morphs into a container rectangle showing its entities inside
- **Multiple groups open**: Any combination of expanded/collapsed groups is valid
- **Automatic edges**: Aggregated between collapsed groups; entity-to-entity between expanded groups; entity-to-collapsed-group for mixed state
- **All expanded**: Equivalent to the flat ERD with colored group containers as visual context
- **Expand All / Collapse All**: Convenience buttons in the controls bar
- **Drill-down**: Double-click an entity inside an expanded group to enter the existing entity drill-down (calc fields, metrics, etc.). Back button restores the grouped view with expand state preserved
- **Draggable**: Both group circles and entity nodes can be dragged with position caching
- **Category colors**: Each Salesforce Cloud has a distinct color (Sales=pink, Service=blue, Marketing=orange, Commerce=teal, Data=cyan, Platform=gray, etc.)

Implementation in [src/webviews/erd-v2.ts](src/webviews/erd-v2.ts) adds ~600 lines of JS for grouped rendering, reusing the existing DOM+SVG rendering and force-directed layout approach.
