# Tableau Next MCP — Agent Rules

You have access to a **Tableau Next MCP server** that lets you interact with Salesforce Data Cloud Semantic Models and Tableau Next assets. Follow these rules when the user asks you to work with semantic models, dashboards, visualizations, or analytics data.

## Local Model File Structure

Semantic models retrieved by the **Salesforce Semantic DX** extension are stored as a folder of split JSON files under `Semantic Models/<Model Label>/`:

| File | Contents | Wrapper key |
|---|---|---|
| `model.json` | Model metadata (apiName, label, dataspace, businessPreferences, baseModels, etc.) | _(root object)_ |
| `dataObjects.json` | Data objects / entities | `{ "items": [...] }` |
| `relationships.json` | Relationships between objects | `{ "items": [...] }` |
| `calculatedDimensions.json` | Calculated dimension fields | `{ "items": [...] }` |
| `calculatedMeasurements.json` | Calculated measure fields | `{ "items": [...] }` |
| `groupings.json` | Groupings | `{ "groupings": [...] }` |
| `logicalViews.json` | Logical views | `{ "items": [...] }` |
| `parameters.json` | Parameters | `{ "items": [...] }` |
| `dimensionHierarchies.json` | Dimension hierarchies | `{ "items": [...] }` |
| `metrics.json` | Metrics / KPIs | `{ "items": [...] }` |
| `fieldsOverrides.json` | Field overrides | `{ "items": [...] }` |
| `modelFilters.json` | Model-level filters | `{ "items": [...] }` |
| `modelInfo.json` | Definition counts and hierarchy depth | _(root object)_ |

If the model extends base models, base entity files live under `base/<Base Label>/` with the same file names.

## Assembling the Full Model Object

Before calling `refine_semantic_model`, you **must** assemble the full model from the split files:

1. Read `model.json` — this is the base object.
2. Attach each entity array onto the base using the API key names:
   - `dataObjects.json` → `semanticDataObjects`
   - `relationships.json` → `semanticRelationships`
   - `calculatedDimensions.json` → `semanticCalculatedDimensions`
   - `calculatedMeasurements.json` → `semanticCalculatedMeasurements`
   - `groupings.json` → `semanticGroupings`
   - `logicalViews.json` → `semanticLogicalViews`
   - `parameters.json` → `semanticParameters`
   - `dimensionHierarchies.json` → `semanticDimensionHierarchies`
   - `metrics.json` → `semanticMetrics`
   - `modelInfo.json` → `semanticModelInfo`
   - `fieldsOverrides.json` → `fieldsOverrides`
   - `modelFilters.json` → `semanticModelFilters`
3. For each entity file, unwrap the array from its wrapper key (`items` or `groupings`).
4. If `model.json` has `baseModels`, also read entity files from `base/<label>/` and merge them into the same arrays.

## Identifying the Target Model and Org

There may be **multiple models** in the workspace under `Semantic Models/`, potentially from **different Salesforce orgs**. Before doing any work:

1. List the subdirectories of `Semantic Models/` to discover available local models.
2. If the user's request clearly names or implies a specific model, use that one.
3. If there is **only one** model folder, use it automatically.
4. If there are **multiple models** and it's ambiguous which one the user means, **ask the user** to choose before proceeding.
5. When calling MCP tools that require `idOrApiName`, use the model's `apiName` from its `model.json`.

### Setting the Correct Org

Each model folder contains `metadata/orgInfo.json` with the org it was retrieved from:
```json
{ "orgId": "00D...", "instanceUrl": "https://...", "username": "user@org.com", "alias": "myorg" }
```

**Before calling any MCP tools** for a model, you must:
1. Read `metadata/orgInfo.json` from the model's folder.
2. Call `set_org` with the `username` from that file.
3. This ensures the MCP server targets the correct Salesforce org.

If the model has no `metadata/orgInfo.json`, skip `set_org` — the MCP server will use the default org.

## Using `refine_semantic_model`

This is the **primary tool** for making AI-driven changes to semantic models.

### Input
- `semanticModel` — the **full** assembled model object (see above).
- `utterance` — a natural-language description of the change (e.g., "Add a profit margin calculated field").
- `additionalInstructions` _(optional)_ — extra constraints to guide the AI.

### Output
- `semanticModel` — the **complete updated** model object with changes applied.
- `explanation` — a human-readable summary of what changed.

### Applying Changes — Always Ask First

**Do NOT automatically write changes back to the local files.** After receiving the refined model:

1. Present the `explanation` to the user so they understand what the AI changed.
2. Summarize the key differences (new fields, modified expressions, removed items, etc.).
3. **Ask the user for confirmation** before applying — e.g., "Would you like me to apply these changes to your local model files?"
4. Only after the user confirms, split the returned model back into the local files:
   - Separate metadata from entity arrays using the same key mapping above.
   - Wrap each entity array back into its file format (`{ "items": [...] }` or `{ "groupings": [...] }`).
   - Write each file to the model folder, preserving pretty-printed JSON (`JSON.stringify(data, null, 2)`).
   - If there are base models, partition entities by `baseModelApiName` and write to the appropriate `base/<label>/` subfolder.
5. If the user rejects the changes, do not write anything. Offer to try a different refinement or adjust the request.

## Available MCP Tools

### Org Management
- `set_org` — switch the active Salesforce org for all subsequent tool calls. Pass the `username` from the model's `metadata/orgInfo.json`.

### Semantic Model Tools (read-only exploration)
- `list_semantic_models` — list all available models
- `get_semantic_model` — get model profile and business preferences
- `list_semantic_model_data_objects` — list entities/tables in a model
- `list_semantic_model_measures` — list measures for a data object
- `list_semantic_model_dimensions` — list dimensions for a data object
- `list_semantic_model_metrics` — list KPIs/metrics
- `get_semantic_model_metric` — get full metric definition
- `list_semantic_model_calculated_dimensions` — list calculated dimensions
- `list_semantic_model_calculated_measures` — list calculated measures
- `list_semantic_model_logical_views` — list logical views
- `get_semantic_model_logical_view` — get full logical view structure
- `refine_semantic_model` — **AI-driven model editing** (see above)

### Analytics / Query Tool
- `analyze_data` — ask a natural-language question against a semantic model. If a complex question fails, break it into simpler sub-questions and synthesize the answers yourself.

### Dashboard & Visualization Tools
- `list_dashboards` / `get_dashboard` — browse and inspect dashboards
- `list_visualizations` / `get_visualization` — browse and inspect visualizations
- `get_visualization_image` — retrieve a rendered visualization image

### Workspace & Asset Tools
- `list_workspaces` / `list_workspace_assets` — browse workspaces and their contents
- `search_assets` — keyword search across all asset types

## Workflow Tips

1. **Identify the model first** — if multiple models exist locally, confirm which one the user wants to work with before proceeding.
2. **Set the org first** — read `metadata/orgInfo.json` from the model folder and call `set_org` before making any MCP tool calls.
3. **Always read local files first** — assemble the full model from the split files in the workspace before calling `refine_semantic_model`.
4. **Never auto-apply changes** — after refinement, show the explanation and proposed changes, then ask the user for confirmation before writing files.
5. **Use read-only tools for context** — before refining, use `get_semantic_model`, `list_semantic_model_data_objects`, etc. to understand the remote model structure if needed.
6. **Respect the file structure** — never merge all entity files into `model.json`; always keep the split structure.
