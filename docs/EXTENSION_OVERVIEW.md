# Tableau Semantic Layer — VS Code Extension

## 1. Introduction

The **Tableau Semantic Layer** extension for Visual Studio Code provides a local development workflow for Salesforce Semantic Layer (Tableau Semantic) models. It enables developers and analysts to retrieve semantic models from a Salesforce org, visualize them as interactive Entity Relationship Diagrams (ERDs), compare local changes against the remote org, run semantic queries for testing, and deploy updates — all within VS Code.

The extension is designed for teams working with Data Cloud semantic models who need version control, visual inspection, and a code-first development experience. It integrates with Git for model history tracking and uses the Salesforce Lightning Design System (SLDS) for a consistent Salesforce-branded UI.

---

## 2. Prerequisites

| Requirement | Details |
|---|---|
| **VS Code** | Version 1.85.0 or higher |
| **Salesforce CLI Integration extension** | The [Salesforce CLI Integration](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core) extension (`salesforce.salesforcedx-vscode-core`) must be installed. This extension provides the **"SFDX: Authorize an Org"** command and requires the Salesforce CLI (`sf`) to be installed on the machine. |
| **Data Cloud** | The target org must have Data Cloud with Semantic Layer enabled |
| **Git** | Required for the Model History feature (commit browsing and comparison) |

---

## 3. Authentication

Before using this extension, the user must authorize a Salesforce org using the **Salesforce CLI Integration** extension:

1. Open the VS Code Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **"SFDX: Authorize an Org"**
3. Complete the browser-based login flow

Once the org is authorized, the Tableau Semantic Layer extension can make any public API call to that org. All authentication and credential management is handled by the Salesforce CLI Integration extension — this extension does not implement any authentication logic of its own.

---

## 4. Security

All authentication, credential storage, and session management is handled entirely by the **Salesforce CLI Integration** extension and the underlying Salesforce CLI. The Tableau Semantic Layer extension does not store, manage, or have direct access to any credentials or tokens. It delegates all security responsibilities to the SFDX authorization flow.

---

## 5. Salesforce Public APIs Used

The extension calls only **public, documented Salesforce REST APIs**. No internal or private endpoints are used.

### Semantic Model API (v65.0 — SSOT)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/services/data/v65.0/ssot/semantic/models` | List semantic models in the org (supports `searchTerm` query parameter) |
| GET | `/services/data/v65.0/ssot/semantic/models/{apiName}` | Retrieve the full model definition (supports `allowUnmapped` query parameter) |
| GET | `/services/data/v65.0/ssot/semantic/models/{apiName}/validate` | Run server-side validation on the model as it exists in the org |
| PUT | `/services/data/v65.0/ssot/semantic/models/{apiName}` | Deploy/update a model with local changes |

### Semantic Engine Gateway (v65.0)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/services/data/v65.0/semantic-engine/gateway` | Execute semantic queries against the model (used by Test Model, and query-from-ERD features) |

### Planned: Inline Model Validation

The current validate endpoint (`GET .../validate`) validates the model as it exists on the remote org. A planned enhancement will use an updated validate API that accepts an **inline model definition**, allowing the extension to validate local changes before deployment. This feature will be implemented once the inline validation API is available.

---

## 6. Features

### 6.1 List Models

Browses all semantic models available in the connected org. Displays them in a webview panel with model metadata. Supports an optional default filter via the `semanticLayer.defaultModelFilter` setting.

**Command:** `Tableau Semantic: List Models`

### 6.2 Retrieve Model to Folder

Exports a semantic model from the org into a local folder as split JSON files. This enables version control with Git and local editing of model entities. The user selects a model from a quick pick list and chooses a destination folder.

**Command:** `Tableau Semantic: Retrieve Model to Folder`
**Context menu:** Right-click a folder in the Explorer

**Output files:** See [Section 7 — Local File Structure](#7-local-file-structure).

### 6.3 Deploy Model

Pushes local model changes back to the org. Reads the local JSON files, assembles the full model payload, and sends it via PUT. The user is shown the payload and asked for confirmation before deployment.

**Command:** `Tableau Semantic: Deploy Model`
**Context menu:** Right-click `model.json` or any `.json` file in a model folder

### 6.4 Validate Model

Runs the Salesforce server-side validation endpoint against the model as it exists in the org. Results (errors, warnings) are displayed in the VS Code Output panel. Note: this currently validates the remote model only. Inline (local) model validation is a planned feature (see Section 5).

**Command:** `Tableau Semantic: Validate Model`
**Context menu:** Right-click `model.json`

### 6.5 Visualize Local ERD

Opens an interactive Entity Relationship Diagram built from the local model files. The ERD displays data objects, logical views, and their relationships as a force-directed graph.

**Command:** `Tableau Semantic: Visualize Local ERD`
**Context menu:** Right-click `model.json`

**Capabilities:**
- Pan, zoom, and drag nodes to arrange the layout
- Click a node to view its dimensions, measurements, and metadata in a sidebar
- Double-click a node to **drill down** into its related entities (calculated dimensions, calculated measurements, hierarchies, metrics, groupings)
- Drill-down view shows calc-to-calc dependency chains with directional arrows
- Node positions persist in `metadata/positions.json` (top-level and per drill-down context) — positions are stored in the model folder and can be committed to Git for team sharing
- Select fields on a node and run a **semantic query** directly from the ERD

### 6.6 Compare Local vs Remote ERD

Fetches the remote model from the org and merges it with the local model to produce a visual diff. Entities are color-coded by status: added (green), modified (yellow), removed (red), and unchanged (default). If the remote model cannot be fetched, it falls back to showing the local ERD only.

**Command:** `Tableau Semantic: Visualize and Compare Local to Remote`
**Context menu:** Right-click `model.json`

**Capabilities:**
- All ERD capabilities from Section 6.5 (drill-down, positions, query)
- Highlight toggle to filter and emphasize changed entities
- Diff status badges on each entity node

### 6.7 View Model History (Git Integration)

Displays the Git commit history for a model folder. The user can load the model at any past commit to view the ERD at that point in time, or compare any two commits (or the current working tree vs. a past commit) with the same diff visualization as Compare mode.

**Command:** `Tableau Semantic: View Model History`
**Context menu:** Right-click `model.json` or a model folder

**Capabilities:**
- Scrollable commit history panel with commit hash, author, date, and message
- Click a commit to load and visualize the model at that point in time
- Right-click a commit to set it as a comparison base
- All ERD capabilities (drill-down, positions, query)

**Requires:** The model folder must be inside a Git repository.

### 6.8 Test Model

Opens a test panel where the user can select fields from the local model and run semantic queries against the org. Unlike querying from the ERD, the Test Model command sends the **full local model definition** in the query payload, allowing testing of un-deployed changes before deployment.

**Command:** `Tableau Semantic: Test Model`
**Context menu:** Right-click `model.json`

**Capabilities:**
- Field picker tree with data objects, logical views, dimensions, measurements, and calculated fields
- Supports aggregate queries (with aggregation functions) and detail queries
- Grand total support for aggregate queries
- Results displayed in a formatted table

### 6.9 Clear Position Cache

Utility command for clearing the ERD node position cache stored in `metadata/positions.json` for a selected model folder.

**Command:** `Tableau Semantic: Clear Position Cache`

---

## 7. Local File Structure

When a model is retrieved using "Retrieve Model to Folder", the following structure is created:

```
<model-folder>/
  model.json                    # Model metadata (apiName, label, description)
  dataObjects.json              # Data objects (DMOs/DLOs) with dimensions and measurements
  relationships.json            # Relationships between data objects and logical views
  calculatedDimensions.json     # Calculated dimension definitions with expressions
  calculatedMeasurements.json   # Calculated measurement definitions with expressions
  dimensionHierarchies.json     # Dimension hierarchy definitions
  metrics.json                  # Metric definitions
  groupings.json                # Grouping definitions
  parameters.json               # Parameter definitions
  logicalViews.json             # Logical view definitions
  modelInfo.json                # Additional model info (permissions, settings)
  fieldsOverrides.json          # Field-level overrides
  modelFilters.json             # Model filter definitions
  metadata/
    positions.json              # ERD node positions (top-level and drill-down)
  _raw_api_response/
    fullModel.json              # Unmodified API response for reference
```

Each entity file contains an `{ "items": [...] }` wrapper. Files can be individually edited and committed to Git. The `metadata/positions.json` file stores ERD layout positions so that node arrangements persist across sessions and can be shared with team members via version control.

---

## 8. Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@salesforce-ux/design-system` | ^2.29.0 | Salesforce Lightning Design System CSS for webview UI styling |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5.3.0 | TypeScript compiler |
| `eslint` | ^8.54.0 | Code linting |
| `@typescript-eslint/eslint-plugin` | ^6.13.0 | TypeScript ESLint rules |
| `@typescript-eslint/parser` | ^6.13.0 | TypeScript ESLint parser |
| `@types/node` | ^20.10.0 | Node.js type definitions |
| `@types/vscode` | ^1.85.0 | VS Code API type definitions |

### External Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| **Salesforce CLI Integration** (`salesforce.salesforcedx-vscode-core`) | VS Code Extension | Provides the **"SFDX: Authorize an Org"** command. This extension requires the [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) to be installed on the machine. Available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core). |
| **Git** | CLI Tool | Required for the Model History feature (commit browsing and comparison) |

### API Dependencies

- The **Validate Model** feature requires the model to already exist in the org (it calls the org's validation endpoint, not a local validator).
- The **Test Model** and **Query from ERD** features require the org to have the Semantic Engine Gateway enabled.
- The **Compare** feature requires the model to exist in the org for remote fetching; it falls back gracefully to local-only visualization if the remote model is unavailable.

---

## 9. Test Plan

### Core User Flows

| # | Scenario | Steps | Expected Result |
|---|---|---|---|
| 1 | **Org authorization** | Install Salesforce CLI Integration, run "SFDX: Authorize an Org" | Org is authorized; extension can make API calls |
| 2 | **List models** | Run "List Models" | Models from the org appear in a webview panel |
| 3 | **Retrieve model** | Run "Retrieve Model to Folder", select a model and destination | All JSON files created with correct structure (see Section 7) |
| 4 | **Visualize ERD** | Right-click `model.json` > "Visualize Local ERD" | ERD renders with all data objects, logical views, and relationships |
| 5 | **ERD drill-down** | Double-click a data object node in the ERD | Drill-down view shows related calcs, hierarchies, metrics, groupings with arrows |
| 6 | **ERD position persistence** | Drag nodes, close panel, reopen ERD | Nodes appear at saved positions; `metadata/positions.json` file exists |
| 7 | **Compare mode** | Right-click `model.json` > "Visualize and Compare" | ERD shows diff status (added/modified/removed) for entities that differ from remote |
| 8 | **Model history** | Right-click model folder > "View Model History" | Commit list displays; clicking a commit loads the ERD at that point in time |
| 9 | **History comparison** | Right-click a commit to set base, click another commit | ERD shows diff between the two commits |
| 10 | **Test model** | Right-click `model.json` > "Test Model", select fields, run query | Query results display in a table |
| 11 | **Query from ERD** | In ERD, select fields on a node and run query | Results display inline in the ERD panel |
| 12 | **Deploy model** | Modify a calc locally, run "Deploy Model", confirm | Org reflects the change; re-retrieve confirms update |
| 13 | **Validate model** | Run "Validate Model" | Validation results appear in the Output panel |

### Edge Cases and Error Handling

| Scenario | Expected Behavior |
|---|---|
| Salesforce CLI Integration not installed | Extension cannot authorize org; user prompted to install it |
| Org not authorized | Clear error message instructing the user to run "SFDX: Authorize an Org" |
| Org does not have Data Cloud | API calls fail gracefully with the Salesforce error message |
| Model does not exist in org (Compare mode) | Falls back to local-only ERD visualization |
| Model folder not in a Git repo (History mode) | Error message indicating Git is required |
| Empty model (no data objects) | ERD renders with no nodes; no crash |
| Large model (50+ data objects) | ERD renders and remains interactive (performance test) |

---

## 10. Risks and Approval Considerations

| Risk | Severity | Mitigation |
|---|---|---|
| **API version coupling** | Medium | The extension targets v65.0 for Semantic APIs. Future API changes or deprecations may require extension updates. |
| **No automated test suite** | Medium | Currently relies on manual testing (see Section 9). An automated test suite using `@vscode/test-electron` should be added for CI/CD. |
| **Write operations** | Low | Only the "Deploy Model" command writes to the org (PUT). User confirmation is required. All other commands are read-only. |
| **SLDS version drift** | Low | The bundled SLDS CSS (`^2.29.0`) may fall behind the latest SLDS release. Regular updates are recommended. |
| **Single-org scope** | Low | The extension uses the CLI's default org. There is no in-extension org picker. Users switch orgs via the SFDX extension. |
| **No Marketplace listing yet** | Info | The extension is currently distributed as a `.vsix` file. To be included in an Extension Pack on the Marketplace, it must be published under an appropriate publisher account. |

---

## 11. Versioning and Release Process

The extension follows **semantic versioning** (`MAJOR.MINOR.PATCH`). The current version is **1.1.0**.

### Release Checklist

1. Update `version` in `package.json`
2. Run `npm run compile` to verify no TypeScript errors
3. Run `npx vsce package` to create the `.vsix` file
4. Test the `.vsix` manually (install in VS Code, verify key flows from the test plan)
5. Distribute the `.vsix` file or publish to the VS Code Marketplace

---

## 12. References

### Salesforce Documentation

- [Salesforce CLI Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/) — installing and authenticating the CLI
- [Salesforce CLI Integration Extension](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core) — the VS Code extension that provides "SFDX: Authorize an Org"
- [Salesforce REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/) — REST API reference
- [Data Cloud Overview](https://help.salesforce.com/s/articleView?id=sf.c360_a_data_cloud.htm) — Data Cloud documentation

### UI Framework

- [Salesforce Lightning Design System (SLDS)](https://www.lightningdesignsystem.com/) — the design system used for all extension UI panels
