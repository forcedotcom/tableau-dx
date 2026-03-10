# Persistent Position Cache with localStorage

## Overview
Implemented a global position caching system that stores node positions in localStorage, persisting across:
- All ERD views (Local, Remote, Compare, History)
- VS Code sessions (survives restarts)
- Per model (each model has independent layout)

## Implementation

### 1. Position Cache Utility (`src/utils/position-cache.ts`) - NEW

**Storage Structure**:
```javascript
localStorage['semanticERD_positions'] = {
  "SalesModel__c": {
    "Order__c": {x: 100, y: 200},
    "Customer__c": {x: 300, y: 150}
  },
  "CustomerModel__c": {
    "Account__c": {x: 150, y: 250}
  }
}
```

**Functions**:
- `loadPositions(modelApiName)` - Load cached positions for a model
- `savePosition(modelApiName, nodeId, x, y)` - Save single node position
- `saveAllPositions(modelApiName, positions)` - Batch save all positions
- `clearPositions(modelApiName)` - Clear cache for one model
- `clearAllPositions()` - Clear entire cache
- `getPositionCacheJS()` - Returns JavaScript code for injection into webviews

### 2. Base ERD Integration (`src/webviews/erd.ts`) - UPDATED

**Changes**:
1. Import position cache utility
2. Inject cache JavaScript into webview
3. Add `modelApiName` to script context
4. Modified `layoutForceAtlas2()`:
   - Load cached positions before layout
   - Skip layout if all nodes have cached positions
   - Use cached positions for existing nodes
   - Only calculate positions for new nodes
   - Save all positions to localStorage after layout
5. Modified drag handler:
   - Save position to localStorage when user drags a node

**Flow**:
```
Load ERD
  ↓
Load cached positions from localStorage
  ↓
All nodes cached? → Use cache, skip layout
Some nodes new? → Use cache for existing, layout for new
No cache? → Full layout, save to cache
  ↓
User drags node → Save to localStorage immediately
```

### 3. History ERD Integration (`src/webviews/erd-history.ts`) - UPDATED

**Changes**:
1. Replace in-memory cache with localStorage-backed cache
2. Load positions from localStorage on init
3. Save positions after user drags
4. Share same cache with all other ERD views

**Key Change**:
```javascript
// OLD: In-memory only
const persistentNodePositions = {};

// NEW: localStorage-backed
const persistentNodePositions = loadCachedPositions(modelApiName);
```

### 4. Commands (Future) - TODO

All ERD command files already pass `model.apiName`, so they're ready. The position cache utility is automatically used via the injected JavaScript.

## Benefits

### ✅ Cross-View Consistency
- Drag a node in Local ERD → position persists in Remote ERD, Compare ERD, History ERD
- All views share the same layout

### ✅ Session Persistence
- Close VS Code → reopen → positions are preserved
- No need to rearrange nodes every time

### ✅ Per-Model Independence
- Each model has its own layout
- `SalesModel__c` positions don't affect `CustomerModel__c`

### ✅ Smart Caching
- First load: Algorithm calculates, saves to cache
- Subsequent loads: Uses cache, skips expensive layout
- New nodes: Only calculates position for new nodes

### ✅ Auto-Save on Drag
- User drags node → instantly saved to localStorage
- No manual save button needed

## Usage

### For Users
**Just drag nodes!** Positions are automatically saved and reused.

### For Developers
The cache is completely transparent:
- No code changes needed in commands
- Automatic localStorage management
- Works across all ERD views

### Clear Cache (if needed)
Open browser console in webview:
```javascript
clearCachedPositions('SalesModel__c'); // Clear one model
clearAllPositions(); // Clear everything
```

## Technical Details

### localStorage Key
`semanticERD_positions`

### Data Format
```json
{
  "ModelApiName": {
    "NodeId": {"x": 100, "y": 200}
  }
}
```

### Performance
- **First load**: ~500 iterations of ForceAtlas2
- **Subsequent loads**: 0 iterations (uses cache)
- **Drag save**: Single localStorage write (~1ms)

## Files Modified

1. 🆕 `src/utils/position-cache.ts` - NEW utility module
2. ✏️ `src/webviews/erd.ts` - Integrated localStorage cache
3. ✏️ `src/webviews/erd-history.ts` - Use shared localStorage cache

## Testing

1. Open any ERD (Local/Remote/Compare/History)
2. Drag nodes to new positions
3. Close the ERD
4. Open the same model in a different ERD view → positions preserved
5. Close VS Code
6. Reopen VS Code and open the model → positions still preserved!
