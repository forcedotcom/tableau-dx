# Collapsible History Panel Feature

## Problem
The history panel on the right side (350px) was blocking the sidebar that shows node details (dimensions/measurements/calculated fields) when clicking on data objects in the ERD.

## Solution: Collapsible History Panel

### Features Implemented

#### 1. Collapse/Expand Button
- **Location**: Top-right of history panel
- **Icon**: 
  - `◀` when expanded (collapse)
  - `▶` when collapsed (expand)
- **Color**: Blue accent color matching VS Code theme
- **Tooltip**: "Collapse history panel" / "Expand history panel"

#### 2. Collapsed State
- **Width**: 48px (from 350px)
- **Visible**: Only the collapse button
- **Hidden**: All content (header, commits list, mode toggle)
- **Button position**: Centered vertically when collapsed

#### 3. Auto-Collapse Behavior
When user clicks on a node to view details:
- History panel automatically collapses
- ERD expands to full width (minus 48px for collapsed panel)
- Sidebar opens on the right with node details
- User can manually expand history again if needed

#### 4. Manual Control
User can toggle collapse/expand anytime by clicking the button:
- **Expanded**: Full history visible, ERD width = screen - 350px
- **Collapsed**: Only button visible, ERD width = screen - 48px

### Technical Implementation

#### CSS Changes (`erd-history.ts`)
```css
#historyPanel {
  transition: width 0.3s ease, transform 0.3s ease;
}

#historyPanel.collapsed {
  width: 48px;
}

#historyPanel.collapsed .history-header h2,
#historyPanel.collapsed .history-header .subtitle,
#historyPanel.collapsed .mode-toggle,
#historyPanel.collapsed .compare-mode-info,
#historyPanel.collapsed .history-list,
#historyPanel.collapsed .loading-indicator {
  display: none;
}
```

#### JavaScript Logic
1. **State tracking**: `isHistoryCollapsed` boolean
2. **Toggle handler**: `collapseBtn.onclick`
3. **Auto-collapse**: Wrapped `openSidebar()` function
4. **ERD resize**: Adjusts `erdContainer.style.right` dynamically

### User Experience Flow

#### Scenario 1: View Node Details
```
User clicks node
  ↓
History panel auto-collapses (48px)
  ↓
ERD expands to full width
  ↓
Sidebar opens on right with node details
```

#### Scenario 2: Manual Collapse
```
User clicks collapse button (◀)
  ↓
History panel collapses (48px)
  ↓
ERD expands
  ↓
User can click nodes freely
```

#### Scenario 3: Expand While Sidebar Open
```
Sidebar is open with node details
  ↓
User clicks expand button (▶)
  ↓
History panel expands (350px)
  ↓
Sidebar closes automatically (ERD needs space)
```

### Benefits

1. ✅ **Full node access**: Users can click any node and see details
2. ✅ **Maintained context**: History still accessible via expand button
3. ✅ **Smart auto-collapse**: Automatically gets out of the way
4. ✅ **User control**: Manual toggle available anytime
5. ✅ **Smooth transitions**: 0.3s ease animation
6. ✅ **Consistent UX**: Same sidebar behavior as other ERD views

### Visual States

#### Expanded (Default)
```
┌─────────────────────────────┬──────────┐
│                             │ HISTORY  │
│         ERD                 │ ◀ Panel  │
│                             │ Commits  │
│                             │ ...      │
└─────────────────────────────┴──────────┘
```

#### Collapsed (After clicking node)
```
┌────────────────────────────────────┬─┐
│                                    │▶│
│         ERD (Full Width)           │ │
│                                    │ │
│  ┌─────────────┐                  │ │
│  │  Sidebar    │                  │ │
│  │  Node Info  │                  │ │
│  └─────────────┘                  │ │
└────────────────────────────────────┴─┘
```

### Files Modified

1. ✅ `src/webviews/erd-history.ts`
   - Added collapse button CSS
   - Added collapsed state styles
   - Added collapse/expand JavaScript logic
   - Wrapped `openSidebar()` for auto-collapse

## Testing

To test:
1. Open Model History
2. Click any data object → History should auto-collapse, sidebar opens
3. Click collapse button manually → History collapses
4. Click expand button → History expands
5. Verify smooth 0.3s transitions
6. Verify sidebar works normally when history collapsed
