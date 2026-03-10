# Model Filter Configuration

## Overview

The extension now supports a global configuration setting to automatically filter semantic models by a search term. This is useful for demos or when working with large lists of models.

## Configuration

### Setting Name
`semanticLayer.defaultModelFilter`

### Type
String (empty by default)

### Description
Default search term to filter models. Leave empty to show all models.

## How to Configure

### Option 1: VS Code Settings UI
1. Open VS Code Settings (`Cmd+,` on Mac, `Ctrl+,` on Windows/Linux)
2. Search for "Semantic Layer"
3. Find "Default Model Filter"
4. Enter your filter term (e.g., "sales")

### Option 2: settings.json
Add to your workspace or user settings:

```json
{
  "semanticLayer.defaultModelFilter": "sales"
}
```

## Behavior

- **Empty value** (default): All models are fetched and displayed
- **With value** (e.g., "sales"): Only models matching the search term are fetched from Salesforce

## Commands Affected

The filter is automatically applied to all commands that fetch the model list:

1. ✅ **List Models** - `semanticLayer.listModels`
2. ✅ **Import Model to Folder** - `semanticLayer.exportToFolder`
3. ✅ **Visualize Remote ERD** - `semanticLayer.visualizeERD`
4. ✅ **Validate Model** - `semanticLayer.validateModel`

## Example

For a demo where you only want to show "sales" models:

```json
{
  "semanticLayer.defaultModelFilter": "sales"
}
```

Now all model-fetching commands will automatically filter to only show models containing "sales" in their name.

## API Implementation

The filter uses the `searchTerm` query parameter:
```
GET /services/data/v65.0/ssot/semantic/models?searchTerm=sales
```

This is **server-side filtering**, so it's efficient even with very large model lists.
