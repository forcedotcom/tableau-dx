import * as fs from 'fs';
import * as path from 'path';

type PositionMap = Record<string, { x: number; y: number }>;

interface PositionsFile {
  topLevel: PositionMap;
  drilldown: Record<string, PositionMap>;
}

/**
 * File-based position storage.
 * Reads/writes {modelFolder}/metadata/positions.json
 * with separate sections for topLevel and drilldown contexts.
 */
export class FilePositionStorage {
  private filePath: string;

  constructor(folderPath: string) {
    this.filePath = path.join(folderPath, 'metadata', 'positions.json');
  }

  private readFile(): PositionsFile {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        return {
          topLevel: data.topLevel || {},
          drilldown: data.drilldown || {},
        };
      }
    } catch (error) {
      console.error('Failed to read positions file:', error);
    }
    return { topLevel: {}, drilldown: {} };
  }

  private writeFile(data: PositionsFile): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write positions file:', error);
    }
  }

  private getSection(data: PositionsFile, ctx: string): PositionMap {
    if (ctx === 'topLevel') {
      return data.topLevel;
    }
    if (ctx.startsWith('drilldown:')) {
      const entityId = ctx.substring('drilldown:'.length);
      return data.drilldown[entityId] || {};
    }
    return {};
  }

  private setSection(data: PositionsFile, ctx: string, positions: PositionMap): void {
    if (ctx === 'topLevel') {
      data.topLevel = positions;
    } else if (ctx.startsWith('drilldown:')) {
      const entityId = ctx.substring('drilldown:'.length);
      data.drilldown[entityId] = positions;
    }
  }

  getPositions(positionContext: string): PositionMap {
    const data = this.readFile();
    return this.getSection(data, positionContext);
  }

  savePosition(positionContext: string, nodeId: string, x: number, y: number): void {
    const data = this.readFile();
    const section = this.getSection(data, positionContext);
    section[nodeId] = { x, y };
    this.setSection(data, positionContext, section);
    this.writeFile(data);
  }

  saveAllPositions(positionContext: string, positions: PositionMap): void {
    const data = this.readFile();
    this.setSection(data, positionContext, positions);
    this.writeFile(data);
  }

  clearPositions(positionContext?: string): void {
    if (!positionContext) {
      try {
        if (fs.existsSync(this.filePath)) {
          fs.unlinkSync(this.filePath);
        }
      } catch (error) {
        console.error('Failed to delete positions file:', error);
      }
      return;
    }
    const data = this.readFile();
    this.setSection(data, positionContext, {});
    this.writeFile(data);
  }
}
