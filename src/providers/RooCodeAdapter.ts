import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProviderAdapter, McpConfig } from './ProviderAdapter';

const EMPTY_MCP_CONFIG: McpConfig = { mcpServers: {} };

export class RooCodeAdapter implements ProviderAdapter {
  readonly provider = 'roo-code';

  private static readonly EXTENSION_ID = 'rooveterinaryinc.roo-cline';

  private static readonly GLOBAL_MCP_PATH = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Code',
    'User',
    'globalStorage',
    'rooveterinaryinc.roo-cline',
    'settings',
    'cline_mcp_settings.json'
  );

  /**
   * Check if Roo Code extension is installed.
   */
  async detect(): Promise<boolean> {
    const ext = vscode.extensions.getExtension(RooCodeAdapter.EXTENSION_ID);
    return ext !== undefined;
  }

  getGlobalMcpConfigPath(): string {
    return RooCodeAdapter.GLOBAL_MCP_PATH;
  }

  getProjectMcpConfigPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, '.roo', 'mcp.json');
  }

  /**
   * Read MCP config from a file. Returns empty config if file doesn't exist or is invalid.
   */
  async readMcpConfig(configPath: string): Promise<McpConfig> {
    try {
      const raw = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as McpConfig;

      // Validate structure
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        return { ...EMPTY_MCP_CONFIG };
      }

      return parsed;
    } catch {
      return { ...EMPTY_MCP_CONFIG };
    }
  }

  /**
   * Write MCP config to a file, merging PM Code servers with any existing user-added servers.
   * Preserves servers not managed by PM Code.
   */
  async writeMcpConfig(configPath: string, config: McpConfig): Promise<void> {
    // Read existing config to preserve user-added servers
    const existing = await this.readMcpConfig(configPath);

    const merged: McpConfig = {
      mcpServers: {
        ...existing.mcpServers,
        ...config.mcpServers,
      },
    };

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(merged, null, 2), 'utf-8');
  }

  /**
   * Inject a prompt into Roo Code by copying to clipboard and focusing the Roo sidebar.
   */
  async injectPrompt(text: string): Promise<void> {
    await vscode.env.clipboard.writeText(text);

    try {
      // Try to focus the Roo Code sidebar input
      await vscode.commands.executeCommand('roo-cline.SidebarProvider.focus');
    } catch {
      // Fallback: try alternative command names
      try {
        await vscode.commands.executeCommand('workbench.view.extension.roo-cline-sidebar');
      } catch {
        // Last resort: show a message telling the user to paste
        void vscode.window.showInformationMessage(
          'Prompt copied to clipboard. Open Roo Code and paste (Cmd+V) to send it.'
        );
      }
    }
  }
}
