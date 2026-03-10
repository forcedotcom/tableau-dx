# Troubleshooting Model History Feature

## Quick Fix Applied

I've added HTML escaping to the commit messages to prevent any special characters from breaking the display.

## How to Test

1. **Reload the VS Code Extension**:
   - Press `F5` to start debugging, or
   - Press `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows) and run "Developer: Reload Window"

2. **Right-click on a model folder** (one that contains `model.json`)

3. **Select "Semantic Layer: View Model History"**

## What to Check

### If you see "No ERD":
1. Open the **Developer Tools** in the webview:
   - In VS Code, press `Cmd+Shift+P` / `Ctrl+Shift+P`
   - Run "Developer: Open Webview Developer Tools"
2. Check the **Console** tab for any JavaScript errors
3. Look for the debug logs that start with `=== ERD History Debug Info ===`
4. Check if `nodes`, `edges`, and `commits` arrays have data

### If you see "No commit rows":
1. Check the console for the debug log showing the `commits` array
2. Verify that:
   - Your model folder is in a git repository (`git status` should work)
   - The model has been committed at least once
   - The commit modified files in that specific folder

## Common Issues & Solutions

### Issue 1: "This folder is not in a git repository"
**Solution**: Initialize git in your workspace:
```bash
cd /path/to/your/workspace
git init
git add .
git commit -m "Initial commit"
```

### Issue 2: "No commits found for this model"
**Solution**: The model folder hasn't been committed yet:
```bash
git add path/to/model/folder
git commit -m "Add model"
```

### Issue 3: Webview shows blank
**Possible causes**:
1. JavaScript error (check Developer Tools console)
2. Data not loading properly (check debug logs)
3. CSS issue (elements hidden)

**Check the browser console** for:
```
=== ERD History Debug Info ===
Nodes: [...]  // Should have data
Commits: [...]  // Should have data
History panel element: <div>  // Should not be null
```

### Issue 4: ERD doesn't render
**Possible causes**:
1. Nodes array is empty
2. Layout algorithm failed
3. SVG icons not loaded

**Check**:
- Are there nodes in the console log?
- Do you see: `ERD rendered with X nodes and Y edges`?
- Are the SVG icon paths correct?

## Manual Test

If issues persist, try this test model:

1. Create a simple test folder structure:
```
test-model/
├── model.json
├── dataObjects.json
├── relationships.json
└── groupings.json
```

2. Add minimal content to each file:

**model.json**:
```json
{
  "apiName": "TestModel",
  "label": "Test Model",
  "id": "test-123",
  "dataspace": "default"
}
```

**dataObjects.json**:
```json
{
  "items": [
    {
      "apiName": "Account",
      "label": "Account",
      "semanticDimensions": [],
      "semanticMeasurements": []
    }
  ]
}
```

**relationships.json**:
```json
{
  "items": []
}
```

**groupings.json**:
```json
{
  "groupings": []
}
```

3. Commit it:
```bash
git add test-model/
git commit -m "Test model"
```

4. Try opening the history view on this folder

## What Changed

The fix applied:
1. Added `escapeHtml()` function to sanitize commit messages
2. All dynamic text in commit rows is now HTML-escaped
3. Added more debug logging to help troubleshoot

## Next Steps

After reloading the extension and testing:
- If it works: Great! The issue was special characters in commit messages
- If ERD shows but no commits: Git issue or no commits found
- If nothing shows: Check browser console and share the error messages with me
