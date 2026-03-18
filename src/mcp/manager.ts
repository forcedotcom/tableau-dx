import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getOrgInfo } from '../api/org';
import { OrgInfo } from '../types';

const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Manages the Tableau Next MCP server registration.
 *
 * The IDE owns the MCP server process lifecycle (spawn / kill / restart)
 * via .cursor/mcp.json.  This manager is responsible for:
 *  1. Writing / updating that config file with fresh SF CLI credentials
 *  2. Periodically refreshing the token so the server stays authenticated
 */
export class McpServerManager implements vscode.Disposable {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private outputChannel: vscode.OutputChannel;
  private extensionPath: string;
  private disposed = false;

  constructor(private context: vscode.ExtensionContext) {
    this.extensionPath = context.extensionPath;
    this.outputChannel = vscode.window.createOutputChannel('Tableau Next MCP');
  }

  async start(): Promise<void> {
    const orgInfo = await this.getCredentials();
    if (!orgInfo) {
      return;
    }

    await this.writeMcpConfig(orgInfo);
    this.startTokenRefresh();
    this.log('MCP server registered via .cursor/mcp.json');
  }

  private async getCredentials(): Promise<OrgInfo | null> {
    try {
      return await getOrgInfo();
    } catch {
      this.log('No Salesforce org found — MCP server will not start. Authorize an org first.');
      vscode.window.showWarningMessage(
        'Tableau Next MCP: No Salesforce org found. Authorize an org and run "Tableau Semantic: Restart MCP Server".'
      );
      return null;
    }
  }

  private getServerPath(): string {
    return path.join(this.extensionPath, 'out', 'mcp-server', 'stdio-server.mjs');
  }

  /**
   * Write / merge the tableau-next server entry into .cursor/mcp.json.
   * Cursor watches this file and will automatically start the MCP server.
   */
  private async writeMcpConfig(orgInfo: OrgInfo): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      this.log('No workspace folder found — skipping MCP registration');
      return;
    }

    const cursorDir = path.join(workspaceRoot, '.cursor');
    const mcpConfigPath = path.join(cursorDir, 'mcp.json');
    const serverPath = this.getServerPath();

    const newServerEntry = {
      command: 'node',
      args: [serverPath],
      env: {
        ACCESS_TOKEN: orgInfo.result.accessToken,
        INSTANCE_URL: orgInfo.result.instanceUrl,
      },
    };

    fs.mkdirSync(cursorDir, { recursive: true });

    let existingConfig: Record<string, unknown> = {};
    if (fs.existsSync(mcpConfigPath)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      } catch {
        // Overwrite if corrupt
      }
    }

    const mergedConfig = {
      ...existingConfig,
      mcpServers: {
        ...(existingConfig.mcpServers as Record<string, unknown> || {}),
        'tableau-next': newServerEntry,
      },
    };

    fs.writeFileSync(mcpConfigPath, JSON.stringify(mergedConfig, null, 2) + '\n');
    this.log(`Wrote MCP config to ${mcpConfigPath}`);
  }

  async restart(): Promise<void> {
    this.log('Restarting MCP server...');
    await this.start();
  }

  private startTokenRefresh(): void {
    this.stopTokenRefresh();

    this.refreshTimer = setInterval(async () => {
      if (this.disposed) {
        return;
      }
      await this.refreshToken();
    }, TOKEN_REFRESH_INTERVAL_MS);
  }

  private stopTokenRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshToken(): Promise<void> {
    this.log('Refreshing Salesforce token...');
    const orgInfo = await this.getCredentials();
    if (!orgInfo) {
      this.log('Token refresh failed — no org available');
      return;
    }

    await this.writeMcpConfig(orgInfo);
    this.log('Token refreshed — updated .cursor/mcp.json');
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  dispose(): void {
    this.disposed = true;
    this.stopTokenRefresh();
    this.outputChannel.dispose();
  }
}
