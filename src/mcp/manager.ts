import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AuthInfo, ConfigAggregator, OrgConfigProperties, Org } from '@salesforce/core';

const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface AuthFileEntry {
  accessToken: string;
  instanceUrl: string;
}

interface AuthFileData {
  default: string;
  orgs: Record<string, AuthFileEntry>;
}

/**
 * Manages the Tableau Next MCP server registration.
 *
 * The IDE owns the MCP server process lifecycle (spawn / kill / restart)
 * via .cursor/mcp.json.  This manager is responsible for:
 *  1. Writing / updating that config file
 *  2. Writing an auth file (outside the workspace) with org credentials
 *  3. Periodically refreshing the auth file so tokens stay valid
 *  4. Writing agent rules so the AI knows how to use the MCP tools
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
    this.writeAgentRule();
    await this.writeAuthFile();
    this.writeMcpConfig();
    this.startTokenRefresh();
    this.log('MCP server registered via .cursor/mcp.json');
  }

  private getServerPath(): string {
    const distPath = path.join(this.extensionPath, 'dist', 'mcp-server', 'stdio-server.mjs');
    if (fs.existsSync(distPath)) {
      return distPath;
    }
    return path.join(this.extensionPath, 'out', 'mcp-server', 'stdio-server.mjs');
  }

  private getAuthFilePath(): string {
    const storagePath = this.context.globalStorageUri.fsPath;
    return path.join(storagePath, 'mcp-auth.json');
  }

  /**
   * Gather credentials for all authorized Salesforce orgs and write them
   * to a JSON file in the extension's global storage (outside the workspace).
   */
  private async writeAuthFile(): Promise<void> {
    const authFilePath = this.getAuthFilePath();
    fs.mkdirSync(path.dirname(authFilePath), { recursive: true });

    let defaultUsername = '';
    try {
      const configAggregator = await ConfigAggregator.create();
      const targetOrg = configAggregator.getPropertyValue(OrgConfigProperties.TARGET_ORG) as string | undefined;
      if (targetOrg) {
        const org = await Org.create({ aliasOrUsername: targetOrg });
        defaultUsername = org.getConnection().getUsername() ?? targetOrg;
      }
    } catch {
      this.log('Could not resolve default org');
    }

    const orgs: Record<string, AuthFileEntry> = {};

    try {
      const authorizations = await AuthInfo.listAllAuthorizations();
      for (const auth of authorizations) {
        if (auth.error || auth.isExpired === true) {
          continue;
        }
        const username = auth.username;
        try {
          const org = await Org.create({ aliasOrUsername: username });
          const conn = org.getConnection();
          if (conn.accessToken && conn.instanceUrl) {
            orgs[username] = {
              accessToken: conn.accessToken,
              instanceUrl: conn.instanceUrl,
            };
          }
        } catch {
          this.log(`Skipping org ${username} — could not read auth info`);
        }
      }
    } catch {
      this.log('Could not list authorized orgs');
    }

    if (Object.keys(orgs).length === 0) {
      this.log('No authorized orgs found — MCP server will not have credentials.');
      vscode.window.showWarningMessage(
        'Tableau Next MCP: No authorized orgs found. Authorize an org and run "Tableau Semantic: Restart MCP Server".'
      );
    }

    const authData: AuthFileData = {
      default: defaultUsername,
      orgs,
    };

    fs.writeFileSync(authFilePath, JSON.stringify(authData, null, 2) + '\n');
    this.log(`Wrote auth file to ${authFilePath} (${Object.keys(orgs).length} org(s))`);
  }

  /**
   * Write / merge the tableau-next server entry into .cursor/mcp.json.
   * No secrets are stored — just the command and the path to the auth file.
   */
  private writeMcpConfig(): void {
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
        AUTH_FILE: this.getAuthFilePath(),
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
      await this.writeAuthFile();
      this.log('Auth file refreshed');
    }, TOKEN_REFRESH_INTERVAL_MS);
  }

  private stopTokenRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private getRuleTemplatePath(): string {
    const candidates = [
      path.join(this.extensionPath, 'dist', 'mcp', 'tableau-mcp-rule.md'),
      path.join(this.extensionPath, 'out', 'mcp', 'tableau-mcp-rule.md'),
      path.join(this.extensionPath, 'src', 'mcp', 'tableau-mcp-rule.md'),
    ];
    return candidates.find(p => fs.existsSync(p)) ?? candidates[0];
  }

  private writeAgentRule(): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    const rulesDir = path.join(workspaceRoot, '.cursor', 'rules');
    const ruleDestPath = path.join(rulesDir, 'tableau-mcp.mdc');

    const templatePath = this.getRuleTemplatePath();
    if (!fs.existsSync(templatePath)) {
      this.log(`Rule template not found at ${templatePath} — skipping`);
      return;
    }

    fs.mkdirSync(rulesDir, { recursive: true });

    const ruleContent = fs.readFileSync(templatePath, 'utf-8');
    const mdcContent = [
      '---',
      'description: Rules for using the Tableau Next MCP server with semantic models',
      'globs: ',
      'alwaysApply: true',
      '---',
      '',
      ruleContent,
    ].join('\n');

    fs.writeFileSync(ruleDestPath, mdcContent);
    this.log(`Wrote agent rule to ${ruleDestPath}`);
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
