# Salesforce Semantic DX

> Retrieve, edit, visualize, compare, test, and deploy **Salesforce Data Cloud Semantic Layer** models — directly from VS Code.

---

## Authorize Your Org First

This extension requires a connection to a Salesforce org with **Data Cloud** enabled. You must authorize your org before any commands will work.

1. Install the [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`).
2. Install the [Salesforce CLI Integration](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core) extension in VS Code.
3. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run **SFDX: Authorize an Org**.
4. Complete the browser-based login and you're ready to go.

> Without an authorized org, the extension cannot retrieve or deploy models. If you see an error about `sf org display`, it means no org is connected — run the authorize command above.

---

## What You Can Do

| | Action | How |
|---|--------|-----|
| **Retrieve** | Pull a semantic model from your org into structured JSON files. | Right-click a folder → *Retrieve Model to Folder* |
| **Deploy** | Push local changes back to the org with a full payload review. | Right-click `model.json` → *Deploy Model* |
| **Visualize** | Interactive ERD of data objects, logical views, and joins. Click nodes for details. | Right-click `model.json` → *Visualize Local ERD* |
| **Compare** | See additions, deletions, and modifications between local and remote. | Right-click `model.json` → *Visualize and Compare* |
| **Test** | Run semantic queries using local model definitions before deploying. | Right-click `model.json` → *Test Model* |
| **History** | Git-powered version timeline — compare any two commits side by side. | Right-click `model.json` → *View Model History* |
| **Clone** | Clone a local or remote model with a new name and API name. | Right-click `model.json` or a `Semantic Models` folder |
| **Extend** | Create a new model extending a remote base model. | Right-click a `Semantic Models` folder → *Extend and Retrieve* |
| **Custom SQL** | Edit logical view SQL in a formatted editor with auto-sync. | CodeLens button in `logicalViews.json` |
| **Field Visibility** | Dim system-managed fields to reduce noise in entity JSON files. | CodeLens toggle in entity JSON files |
| **Org Info** | View connected org details, username, org ID, and API limits. | Command Palette → *Show Org Info* |

---

## Quick Start

1. **Authorize your org** — Command Palette → `SFDX: Authorize an Org` (one-time setup).
2. **List models** — Command Palette → `Tableau Semantic: List Models`.
3. **Retrieve** — right-click a workspace folder → `Tableau Semantic: Retrieve Model to Folder`.
4. **Edit** — modify the JSON files with VS Code's built-in IntelliSense.
5. **Visualize** — right-click `model.json` → `Visualize Local ERD`.
6. **Deploy** — right-click `model.json` → `Deploy Model`.

---

## Workflow

```
  Authorize Org ──► List Models ──► Retrieve to Folder ──► Edit JSON Files
                                                                │
                     Deploy ◄── Review Changes ◄── Visualize ERD ┘
```

1. **Authorize an org** — `SFDX: Authorize an Org` (one-time setup).
2. **List models** — `Tableau Semantic: List Models` shows all semantic models in the connected org.
3. **Retrieve a model** — right-click a workspace folder → **Retrieve Model to Folder**. The model is exported as a set of JSON files.
4. **Edit locally** — modify any of the JSON entity files (data objects, calculated fields, relationships, etc.) using VS Code's built-in JSON editing, IntelliSense, and formatting.
5. **Visualize** — right-click `model.json` → **Visualize Local ERD** to see an interactive entity-relationship diagram.
6. **Compare** — right-click `model.json` → **Visualize and Compare Local to Remote** to see what changed between your local files and the remote org.
7. **Test** — right-click `model.json` → **Test Model** to run semantic queries against the org using your local model definition (including un-deployed changes).
8. **Deploy** — right-click `model.json` → **Deploy Model** to push your local changes to the org. The extension shows the full payload for review before sending.
9. **Track history** — right-click `model.json` → **View Model History** to browse previous versions via Git commits and compare any two snapshots.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **VS Code** | 1.85.0 or higher |
| **Salesforce CLI** (`sf`) | [Install guide](https://developer.salesforce.com/tools/salesforcecli) |
| **Salesforce CLI Integration extension** | [`salesforce.salesforcedx-vscode-core`](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core) |
| **Salesforce org with Data Cloud** | The org must have Semantic Layer / Data Cloud enabled |

---

## Authentication (SFDX)

This extension does not manage credentials on its own. It delegates authentication to the **Salesforce CLI**, which means you must authorize an org before using any extension commands.

### Step-by-step

1. **Install the Salesforce CLI** if you haven't already:

   ```bash
   npm install -g @salesforce/cli
   ```

2. **Install the Salesforce CLI Integration** extension in VS Code (search for `Salesforce CLI Integration` in the Extensions panel).

3. **Authorize your org** — open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

   ```
   SFDX: Authorize an Org
   ```

   Choose a login method (typically **Web Login**), complete the browser-based OAuth flow, and give the org an alias (e.g. `my-data-cloud-org`).

4. **Verify the connection:**

   ```bash
   sf org display
   ```

   You should see your org's Instance URL, Username, and Access Token.

Once authorized, the extension automatically reads credentials from the CLI whenever it needs to talk to Salesforce — no extra configuration required.

### Switching orgs

If you work with multiple orgs, set the default target org:

```bash
sf config set target-org=my-other-org
```

The extension always uses the current default org. When deploying, it also checks whether the local model was originally retrieved from a different org and prompts you to switch if there's a mismatch.

---

## Commands Reference

All commands are available from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`). Many are also available from the Explorer context menu when right-clicking the appropriate file or folder.

| Command | Context Menu Trigger | Description |
|---------|---------------------|-------------|
| **Show Org Info** | — | Display details about the connected Salesforce org (username, org ID, instance URL, API limits). |
| **List Models** | — | Fetch and display all semantic models in the org. Supports a default filter via settings. |
| **Retrieve Model to Folder** | Right-click a `Semantic Models` folder | Export a semantic model from the org into structured JSON files in the selected folder. |
| **Deploy Model** | Right-click `model.json` | Push local model changes back to the org. Shows a confirmation dialog and payload preview. |
| **Visualize Local ERD** | Right-click `model.json` | Open an interactive entity-relationship diagram of the local model. Click nodes to see field details, click edges to see relationship info. |
| **Visualize and Compare Local to Remote** | Right-click `model.json` | Side-by-side ERD comparison highlighting differences between local files and the remote org. |
| **View Model History** | Right-click `model.json` or a folder | Browse Git commit history for the model and compare any two versions. |
| **Test Model** | Right-click `model.json` | Run semantic queries against the org using the local model definition. Useful for testing un-deployed changes. |
| **Clone and Deploy Local Model** | Right-click `model.json` | Create a server-side copy of the local model with a new label and API name, then retrieve it. |
| **Clone and Retrieve Remote Model** | Right-click a `Semantic Models` folder | Pick a remote model, clone it on the server with a new name, and retrieve it locally. |
| **Extend and Retrieve Remote Model** | Right-click a `Semantic Models` folder | Create a new model that extends a remote base model, and retrieve it locally. |
| **Toggle Optional Fields** | Command Palette only | Dim or show system-managed fields (`createdBy`, `createdDate`, etc.) in entity JSON files. |
| **Edit Custom SQL** | CodeLens in `logicalViews.json` | Open a logical view's custom SQL in a formatted `.sql` editor with auto-sync on save. |

---

## Model Folder Structure

When you retrieve a model, the extension creates a folder named after the model's label. Inside it, each aspect of the model is stored in its own JSON file:

```
My Sales Model/
├── model.json                     # Model metadata (apiName, label, dataspace, description)
├── dataObjects.json               # Data objects (DMOs/DLOs) with dimensions and measurements
├── relationships.json             # Relationships (joins) between data objects
├── calculatedDimensions.json      # Calculated dimension definitions with expressions
├── calculatedMeasurements.json    # Calculated measurement definitions with expressions
├── logicalViews.json              # Logical views (HardJoin, Union)
├── dimensionHierarchies.json      # Dimension hierarchy definitions
├── metrics.json                   # Metric definitions
├── parameters.json                # Parameter definitions
├── modelInfo.json                 # Model permissions and settings
├── fieldsOverrides.json           # Field-level overrides
├── modelFilters.json              # Model filter definitions
│
├── metadata/
│   ├── orgInfo.json               # Org this model was retrieved from (for deploy matching)
│   ├── positions.json             # Saved ERD node positions
│   └── viewConfig.json            # Display preferences (e.g. field visibility toggle)
│
├── base/                          # Present only if the model extends a base model
│   └── BaseModelLabel/
│       ├── dataObjects.json
│       ├── relationships.json
│       └── ...                    # Same entity files as the root
```

### File format

- Most entity files wrap their content in `{ "items": [...] }`.
- `modelInfo.json` is a bare object (no wrapper).
- `model.json` contains the model-level metadata and is the entry point for all context-menu actions.
- Missing files are treated as empty — only `model.json` is required.

### Key entity types

| File | What it contains |
|------|-----------------|
| `dataObjects.json` | Data Model Objects (DMOs) and Data Lake Objects (DLOs). Each object has `semanticDimensions` and `semanticMeasurements` arrays defining the available fields. |
| `relationships.json` | Joins between data objects and/or logical views. Defines cardinality, join fields, and relationship type. |
| `calculatedDimensions.json` | Dimension fields computed from expressions (e.g. `[Account].[Name]`). |
| `calculatedMeasurements.json` | Measurement fields computed from expressions with an aggregation type. |
| `logicalViews.json` | Virtual tables created via HardJoin or Union of existing data objects. |
| `metrics.json` | Business metrics built on top of measurements. |
| `dimensionHierarchies.json` | Drill-down hierarchies across dimension fields. |
| `parameters.json` | User-input variables that can be referenced in calculated fields. |

---

## ERD Visualization

The interactive ERD (Entity Relationship Diagram) renders your model as a graph:

- **Nodes** represent data objects and logical views, styled with Salesforce-themed icons.
- **Edges** represent relationships (joins) between entities.
- **Click a node** to open a sidebar with the entity's dimensions, measurements, and calculated fields.
- **Double-click a node** to drill down into it, showing only related entities in a focused view.
- **Click an edge** to see relationship details (cardinality, join fields).
- **Jump to Code** — from the sidebar, navigate directly to the entity's definition in the JSON file.
- **Preview Query** — from the sidebar, send selected fields to the semantic engine to preview query results.
- **Cross-object entities** — the sidebar highlights calculated fields, hierarchies, and metrics that span multiple data objects.
- **Graph controls** — Fit All, Reset Zoom, Re-layout.
- **Layout modes** — force-directed (ForceAtlas2) layout with automatic grid mode for complex models.
- **Unmapped field toggle** — show or hide unmapped fields with a badge indicator; preview query excludes unmapped fields.
- **Base model toggle** — show or hide base model objects and relationships in the left panel.
- **Position persistence** — node positions are saved and restored between sessions.

### Compare mode

The Compare ERD fetches the current remote model and renders both local and remote versions, highlighting:

- Entities or fields that exist only locally (additions).
- Entities or fields that exist only remotely (deletions).
- Entities or fields that differ between local and remote (modifications).

---

## Testing Queries

The **Test Model** command opens an interactive query builder:

- Browse the model's fields in a tree (data objects → dimensions / measurements).
- Select fields to include in the query.
- Run the query against the org's semantic engine.
- Results are displayed inline. This uses the local model definition, so you can test changes before deploying.

---

## Model History

The **View Model History** command uses Git to show a timeline of changes:

- Each commit that modified the model folder is listed with author, date, and message.
- Select any two commits to see a visual diff.
- Useful for tracking who changed what, and for rolling back to a previous state.

> **Note:** The model folder must be inside a Git repository for history to work.

---

## Cloning and Extending Models

The extension supports three ways to create new models from existing ones:

- **Clone and Deploy Local Model** — right-click `model.json` to create a server-side copy with a new label and API name, then retrieve the result locally.
- **Clone and Retrieve Remote Model** — right-click a `Semantic Models` folder, pick any remote model, clone it on the server with a new name, and retrieve it.
- **Extend and Retrieve Remote Model** — right-click a `Semantic Models` folder, pick a remote model to use as a base, and create a new extending model.

After each operation, you're offered quick actions to open the folder, visualize the ERD, or test the model.

---

## Custom SQL Editing

Logical views with a `customSQLV2` property show an **Edit Custom SQL** CodeLens button directly in `logicalViews.json`. Clicking it:

1. Opens the SQL in a temporary `.sql` file, formatted with line breaks at major clauses (SELECT, FROM, WHERE, JOIN, etc.).
2. Auto-syncs changes back into `logicalViews.json` when the `.sql` file is saved.
3. Cleans up the temporary file when the editor tab is closed.

---

## Field Visibility Toggle

Entity JSON files (inside `Semantic Models/`) show a **Hide/Show Optional Fields** CodeLens toggle at the top of the editor. When hidden, system-managed fields (`createdBy`, `createdDate`, `lastModifiedBy`, `lastModifiedDate`) are dimmed to reduce visual noise.

The preference is persisted per model in `metadata/viewConfig.json`.

---

## License

BSD-3-Clause
