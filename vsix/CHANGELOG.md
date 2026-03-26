# Changelog

## Unreleased
- Added "Duplicate Local Model" command to create a server-side copy with a new label and API name
- Added safe folder naming to prevent collisions when models share the same label but have different API names
- Added "Hide Server Fields" CodeLens toggle to dim createdBy/createdDate/lastModifiedBy/lastModifiedDate in entity JSON files
- Added per-model viewConfig.json for persisting display preferences
- Added extensionVersion property to all telemetry events
- Improved text contrast for data object names and field labels in Test Model panel

## 0.0.7 - 2026-03-25
- Fixed Windows/VSCode: "unable to determine transport target for pino-pretty" when DEBUG env var is set

## 0.0.6 - 2026-03-25
- Bumped Salesforce API version from v65.0 to v66.0 (adds customSQLV2 support on logical views)
- Centralized API version into a single SF_API_VERSION constant
- Added customSQLV2 and overriddenProperties to LogicalView type
- Fixed watch script to use esbuild (matches dist/ entry point used at runtime)
- Added inline "Edit Custom SQL" CodeLens in logicalViews.json for logical views with customSQLV2
- Fixed Windows: "unable to determine transport target" error caused by path separator mismatch in bundled pino overrides
- Fixed Windows/VSCode: "unable to determine transport target for pino-pretty" when DEBUG env var is set

## 0.0.5 - 2026-03-18
- Fixed drill-down auto-arrange producing tightly clustered nodes (added position normalization + viewport fit)
- Added embedded Tableau Next MCP server (21 tools available to Copilot on activation)
- Added SF CLI auth bridge for MCP server (replaces .env-based credentials)
- Added automatic token refresh (periodic + error-triggered) for MCP server
- Added "Restart MCP Server" command

## 0.0.1 - 2026-03-10
- Initial release
