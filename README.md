# Salesforce Semantic Layer Extension

A Visual Studio Code extension for working with Salesforce Semantic Layer models.

## Features

- **Show Org Info**: Display connected Salesforce org information
- **List Models**: View all semantic models in your org
- **Export Model to Folder**: Export semantic models as JSON files to your workspace
- **Update Model**: Push changes from local JSON files back to Salesforce
- **Visualize ERD**: Interactive Entity Relationship Diagram with full graph visualization
  - Visual graph of data objects, logical views, and relationships
  - Click on entities to view details in a sidebar
  - **Jump to Code**: Navigate directly from the ERD to the entity definition in JSON files
  - Run semantic queries directly from the ERD
- **Validate Model**: Validate semantic model configurations

## Requirements

- Salesforce CLI (`sf`) must be installed and authenticated to a Salesforce org with Data Cloud
- Visual Studio Code 1.85.0 or higher

## Usage

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Search for "Semantic Layer" to see available commands
3. Use "Visualize ERD" to view an interactive diagram of your semantic model
4. Click on any entity in the ERD to view details and jump to its code definition

## Version History

### 0.8.2
- **Redesigned ERD UI**: Beautiful pink/magenta circular nodes with white icons (matching Salesforce design)
- Clean dark mode with improved contrast and readability
- **Relationship Popup**: Click on edges to see detailed relationship information
- Label positioning below nodes for better clarity
- Soft shadows and refined styling throughout
- Uses embedded SVG icons from src/assets

### 0.8.1
- **Enhanced ERD Visuals**: Beautiful round nodes with gradient backgrounds and glowing shadows
- Improved readability with larger text (14px bold) and text outlines
- Better spacing: increased node repulsion and edge lengths for clearer layouts
- Thicker, more visible connection lines (3px) with enhanced arrows
- Polished UI: green control buttons, badge-style stats, smooth animations
- Interactive hover effects on nodes and edges

### 0.8.0
- Enhanced ERD visualization with interactive Cytoscape.js graph
- Added entity sidebar with detailed field information
- **New**: Jump to Code button - navigate from ERD entities to JSON definitions
- Improved UI with modern dark theme
- Added graph controls (Fit All, Reset Zoom, Re-layout)

### 0.7.0
- Initial release with basic semantic layer operations

## License

MIT
