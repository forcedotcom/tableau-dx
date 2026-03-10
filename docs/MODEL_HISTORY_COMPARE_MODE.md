# Model History Compare Mode Feature

## Overview
Added **Compare Mode** to the Model History ERD viewer. Users can now select a base commit and compare it with other commits to see differences visually.

## What Was Added

### 1. Shared Comparison Utility
**File**: `src/utils/compare-models.ts` (NEW)
- Extracted `compareModels()` function from visualize-compare-erd.ts
- Reusable function that compares two model versions
- Returns `diffInfo` object with categorized differences:
  - `dataObjects`: onlyLocal, onlyRemote, modified
  - `relationships`: onlyLocal, onlyRemote, modified
  - `calculatedFields`: onlyLocal, onlyRemote, modified, dependenciesChanged

### 2. UI Components
**File**: `src/webviews/erd-history.ts` (UPDATED)

#### Mode Toggle
- Two-button toggle: "👁️ View Mode" and "🔄 Compare Mode"
- View Mode: Click to view model at that commit (original behavior)
- Compare Mode: Set base commit, then click to compare

#### Visual Indicators
- **Base Commit**: Purple border + "📌 BASE" badge
- **Active Commit**: Blue border (currently viewing)
- Info panel explaining how to use compare mode

#### User Interactions
- **Left-click**: View commit (View Mode) or Compare with base (Compare Mode)
- **Right-click**: Set as base commit (Compare Mode only)

### 3. Backend Logic
**File**: `src/commands/visualize-model-history.ts` (UPDATED)

#### New Message Handler: `compareCommits`
- Loads data from both base and selected commits
- Calls `compareModels()` to generate diff info
- Sends back both data and diff info to webview

### 4. Visual Diff Display
Same color scheme as "Visualize and Compare" feature:
- 🟢 **Green** (`diff-only-local`): Only in selected commit (additions)
- 🟠 **Orange** (`diff-modified`): Modified between base and selected
- 🟣 **Purple** (`diff-only-remote`): Only in base (deletions)
- 🔵 **Blue** (`diff-calc-dependency`): Data objects affected by calc field changes

## How It Works

### View Mode (Default)
1. User clicks on a commit
2. ERD shows the model as it was at that commit
3. No diff highlighting

### Compare Mode
1. User toggles to "Compare Mode"
2. User right-clicks a commit to "Set as Base" (default: CURRENT)
3. User clicks another commit to compare
4. Extension loads both versions and calculates differences
5. ERD shows the selected commit's model with diff highlighting

## Technical Flow

```
User clicks commit in Compare Mode
  ↓
Webview sends 'compareCommits' message
  ↓
Extension loads baseData + selectedData
  ↓
compareModels(baseData, selectedData) → diffInfo
  ↓
Send back: data + diffInfo
  ↓
Webview updates ERD with diff classes
  ↓
reinitializeERD(diffInfo) applies visual styling
```

## Files Modified

1. ✅ `src/utils/compare-models.ts` - NEW (shared comparison logic)
2. ✅ `src/commands/visualize-compare-erd.ts` - Refactored to use shared utility
3. ✅ `src/commands/visualize-model-history.ts` - Added compareCommits handler
4. ✅ `src/webviews/erd-history.ts` - Added compare mode UI and logic

## User Experience

### Setting Up Comparison
- Right-click "CURRENT" or any commit → Sets as base (purple border)
- Base commit shows "📌 BASE" indicator

### Comparing
- Click any other commit → Shows differences
- Green nodes/edges = Added since base
- Orange = Modified since base
- Purple = Deleted since base
- Blue = Affected by calc field changes

### Switching Back
- Toggle back to "View Mode" to resume normal time-travel
- Or right-click a different commit to change base

## Benefits

1. **Visual Diff**: See model changes at a glance
2. **Flexible Base**: Compare any two commits, not just current vs history
3. **Consistent Design**: Same diff colors as existing Compare feature
4. **Intuitive**: Right-click to set base, left-click to compare
5. **Context Retention**: Base persists while browsing other commits

## Testing

To test:
1. Open Model History on a model with multiple commits
2. Toggle to "Compare Mode"
3. Right-click a commit to set as base
4. Click other commits to see differences
5. Verify colors match the Compare feature
6. Toggle back to View Mode - should work normally
