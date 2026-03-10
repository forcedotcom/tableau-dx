import { SemanticModelUI } from './types';
import { loadSemanticModelFiles } from './model-loader';
import { buildDependencyGraph } from './dependency-resolver';
import { buildSemanticModelUI } from './ui-representation-builder';

export { SemanticModelUI, DiffStatus, RelationshipUI, GitCommitInfo } from './types';
export { loadSemanticModelFiles, loadRawModelFromCommit } from './model-loader';
export { buildDependencyGraph } from './dependency-resolver';
export { buildSemanticModelUI } from './ui-representation-builder';
export { parseExpressionReferences } from './expression-parser';

/**
 * Main entry point: loads model files from a folder and builds the
 * enriched UI representation with dependency analysis.
 */
export function buildModelRepresentation(folderPath: string): SemanticModelUI {
  const rawModel = loadSemanticModelFiles(folderPath);
  const depGraph = buildDependencyGraph(rawModel);
  return buildSemanticModelUI(rawModel, depGraph);
}
