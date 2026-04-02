import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EnvManager } from '../config/EnvManager';
import { ProviderAdapter, McpServerDefinition } from '../providers/ProviderAdapter';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConnectorField {
  id: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  helpText?: string;
  helpUrl?: string;
  required: boolean;
}

export type ConnectorStatus = 'connected' | 'disabled' | 'warning' | 'error' | 'unconfigured';

export interface ConnectorConfig {
  id: string;
  name: string;
  type: 'mcp-server' | 'cli-tool' | 'rest-api';
  description: string;
  icon: string;
  status: ConnectorStatus;
  fields: ConnectorField[];
  mcpServer?: {
    command: string;
    args: string[];
    envMapping: Record<string, string>; // field id -> env var name
    httpUrl?: string; // HTTP MCP endpoint (alternative to command/args)
  };
  cliTool?: {
    command: string;
    authCommand?: string;
    statusCommand?: string;
  };
  examplePrompts: string[];
  relatedSkills: string[];
  relatedGuides: string[];
}

/**
 * Non-secret settings persisted in ~/.pmcode/connectors/{id}.json.
 */
interface ConnectorSettingsFile {
  id: string;
  enabled: boolean;
  values: Record<string, string>; // field id -> value (secrets excluded)
}

// ── Adapter loader ─────────────────────────────────────────────────────────

import { getConnectorDefinition as jiraDef } from './adapters/JiraAdapter';
import { getConnectorDefinition as githubDef } from './adapters/GitHubAdapter';
import { getConnectorDefinition as mondayDef } from './adapters/MondayAdapter';
import { getConnectorDefinition as ahaDef } from './adapters/AhaAdapter';
import { getConnectorDefinition as tavilyDef } from './adapters/TavilyAdapter';

function loadBuiltinDefinitions(): ConnectorConfig[] {
  return [jiraDef(), githubDef(), mondayDef(), ahaDef(), tavilyDef()];
}

// ── ConnectorManager ───────────────────────────────────────────────────────

export class ConnectorManager {
  private static readonly CONNECTORS_DIR = path.join(os.homedir(), '.pmcode', 'connectors');

  private envManager: EnvManager;
  private providerAdapter: ProviderAdapter;
  private definitions: Map<string, ConnectorConfig>;

  constructor(envManager: EnvManager, providerAdapter: ProviderAdapter) {
    this.envManager = envManager;
    this.providerAdapter = providerAdapter;
    this.definitions = new Map();

    for (const def of loadBuiltinDefinitions()) {
      this.definitions.set(def.id, def);
    }
  }

  // ── Query ──────────────────────────────────────────────────────────────

  /**
   * Return all connector definitions with live status applied.
   */
  async getConnectors(): Promise<ConnectorConfig[]> {
    const results: ConnectorConfig[] = [];
    for (const def of this.definitions.values()) {
      const status = await this.getStatus(def.id);
      results.push({ ...def, status });
    }
    return results;
  }

  /**
   * Return a single connector definition (with live status).
   */
  async getConnector(id: string): Promise<ConnectorConfig | undefined> {
    const def = this.definitions.get(id);
    if (!def) {
      return undefined;
    }
    const status = await this.getStatus(id);
    return { ...def, status };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Persist connector field values.
   * - Secret fields (password type) go to ~/.pmcode/.env via EnvManager.
   * - Non-secret fields go to ~/.pmcode/connectors/{id}.json.
   * - MCP server definitions are written to the provider config.
   */
  async configure(id: string, values: Record<string, string>): Promise<void> {
    const def = this.definitions.get(id);
    if (!def) {
      throw new Error(`Unknown connector: ${id}`);
    }

    const nonSecretValues: Record<string, string> = {};

    // Separate secrets from non-secrets
    for (const field of def.fields) {
      const value = values[field.id];
      if (value === undefined || value === '') {
        continue;
      }

      if (field.type === 'password') {
        // Store secret in .env using the env mapping key
        const envKey = def.mcpServer?.envMapping[field.id] ?? field.id.toUpperCase();
        await this.envManager.setToken(envKey, value);
      } else {
        nonSecretValues[field.id] = value;
      }
    }

    // Write non-secret settings file
    const settings: ConnectorSettingsFile = {
      id,
      enabled: true,
      values: nonSecretValues,
    };

    await fs.mkdir(ConnectorManager.CONNECTORS_DIR, { recursive: true });
    const settingsPath = path.join(ConnectorManager.CONNECTORS_DIR, `${id}.json`);
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    // Write MCP config to the provider if this is an MCP server
    if (def.mcpServer) {
      await this.writeMcpServerConfig(def, values);
    }
  }

  /**
   * Test whether a connector is working.
   * Returns 'connected' on success, 'error' on failure.
   */
  async testConnection(id: string): Promise<{ status: ConnectorStatus; message: string }> {
    const def = this.definitions.get(id);
    if (!def) {
      return { status: 'error', message: `Unknown connector: ${id}` };
    }

    try {
      if (def.type === 'cli-tool' && def.cliTool?.statusCommand) {
        return await this.testCliTool(def);
      }

      if (def.type === 'mcp-server' && def.mcpServer) {
        return await this.testMcpServer(def);
      }

      return { status: 'warning', message: 'No test available for this connector type.' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', message };
    }
  }

  /**
   * Enable a previously disabled connector.
   */
  async enable(id: string): Promise<void> {
    const settings = await this.readSettings(id);
    settings.enabled = true;
    await this.writeSettings(id, settings);

    const def = this.definitions.get(id);
    if (def?.mcpServer) {
      // Re-enable in provider MCP config
      const configPath = this.providerAdapter.getGlobalMcpConfigPath();
      const mcpConfig = await this.providerAdapter.readMcpConfig(configPath);
      if (mcpConfig.mcpServers[id]) {
        mcpConfig.mcpServers[id].disabled = false;
        await this.providerAdapter.writeMcpConfig(configPath, mcpConfig);
      }
    }
  }

  /**
   * Disable a connector without removing its configuration.
   */
  async disable(id: string): Promise<void> {
    const settings = await this.readSettings(id);
    settings.enabled = false;
    await this.writeSettings(id, settings);

    const def = this.definitions.get(id);
    if (def?.mcpServer) {
      // Mark as disabled in provider MCP config
      const configPath = this.providerAdapter.getGlobalMcpConfigPath();
      const mcpConfig = await this.providerAdapter.readMcpConfig(configPath);
      if (mcpConfig.mcpServers[id]) {
        mcpConfig.mcpServers[id].disabled = true;
        await this.providerAdapter.writeMcpConfig(configPath, mcpConfig);
      }
    }
  }

  /**
   * Remove a connector: delete settings, remove secrets, remove MCP config.
   */
  async remove(id: string): Promise<void> {
    const def = this.definitions.get(id);
    if (!def) {
      return;
    }

    // Remove secrets from .env
    if (def.mcpServer?.envMapping) {
      for (const envKey of Object.values(def.mcpServer.envMapping)) {
        await this.envManager.removeToken(envKey);
      }
    }

    // Remove settings file
    const settingsPath = path.join(ConnectorManager.CONNECTORS_DIR, `${id}.json`);
    try {
      await fs.unlink(settingsPath);
    } catch {
      // File may not exist — that's fine
    }

    // Remove from provider MCP config
    if (def.mcpServer) {
      const configPath = this.providerAdapter.getGlobalMcpConfigPath();
      const mcpConfig = await this.providerAdapter.readMcpConfig(configPath);
      delete mcpConfig.mcpServers[id];
      await this.providerAdapter.writeMcpConfig(configPath, mcpConfig);
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────

  /**
   * Determine the current status of a connector.
   */
  async getStatus(id: string): Promise<ConnectorStatus> {
    const def = this.definitions.get(id);
    if (!def) {
      return 'error';
    }

    // Check if settings file exists (has been configured)
    const settings = await this.readSettings(id);

    // CLI tools: check if the CLI is available
    if (def.type === 'cli-tool') {
      return this.getCliToolStatus(def);
    }

    // MCP servers: check if required fields have values
    if (!settings.id) {
      // No settings file — never configured
      return 'unconfigured';
    }

    if (!settings.enabled) {
      return 'disabled';
    }

    // Verify required secrets exist
    if (def.mcpServer?.envMapping) {
      for (const field of def.fields) {
        if (!field.required) {
          continue;
        }
        if (field.type === 'password') {
          const envKey = def.mcpServer.envMapping[field.id];
          if (envKey) {
            const value = await this.envManager.getToken(envKey);
            if (!value) {
              return 'warning';
            }
          }
        }
      }
    }

    return 'connected';
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async getCliToolStatus(def: ConnectorConfig): Promise<ConnectorStatus> {
    if (!def.cliTool) {
      return 'error';
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const statusCmd = def.cliTool.statusCommand ?? `which ${def.cliTool.command}`;
      await execAsync(statusCmd, { timeout: 10_000 });
      return 'connected';
    } catch {
      return 'unconfigured';
    }
  }

  private async testCliTool(def: ConnectorConfig): Promise<{ status: ConnectorStatus; message: string }> {
    if (!def.cliTool?.statusCommand) {
      return { status: 'error', message: 'No status command defined.' };
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const { stdout, stderr } = await execAsync(def.cliTool.statusCommand, { timeout: 10_000 });
      const output = stdout || stderr;
      return { status: 'connected', message: output.trim().split('\n')[0] ?? 'Connected.' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'error', message };
    }
  }

  private async testMcpServer(def: ConnectorConfig): Promise<{ status: ConnectorStatus; message: string }> {
    if (!def.mcpServer) {
      return { status: 'error', message: 'No MCP server config defined.' };
    }

    // Verify all required env vars are set
    for (const field of def.fields) {
      if (!field.required) {
        continue;
      }
      if (field.type === 'password') {
        const envKey = def.mcpServer.envMapping[field.id];
        if (envKey) {
          const value = await this.envManager.getToken(envKey);
          if (!value) {
            return { status: 'error', message: `Missing required credential: ${field.label}` };
          }
        }
      }
    }

    // For HTTP MCP endpoints, just check the URL is configured
    if (def.mcpServer.httpUrl) {
      return { status: 'connected', message: `${def.name} is configured (HTTP MCP at ${def.mcpServer.httpUrl}).` };
    }

    // For command-based MCP servers, check if the command is available
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`which ${def.mcpServer.command}`, { timeout: 5_000 });
      return { status: 'connected', message: `${def.name} is configured and ready.` };
    } catch {
      return {
        status: 'warning',
        message: `${def.mcpServer.command} not found in PATH. The server may still work via npx.`,
      };
    }
  }

  /**
   * Build the env block for an MCP server definition and write it to the provider config.
   */
  private async writeMcpServerConfig(def: ConnectorConfig, values: Record<string, string>): Promise<void> {
    if (!def.mcpServer) {
      return;
    }

    // Build the env record from field values + env mapping
    const env: Record<string, string> = {};
    for (const [fieldId, envKey] of Object.entries(def.mcpServer.envMapping)) {
      const value = values[fieldId];
      if (value) {
        env[envKey] = value;
      }
    }

    let serverDef: McpServerDefinition;
    if (def.mcpServer.httpUrl) {
      // HTTP MCP endpoint (hosted service)
      serverDef = {
        type: 'http',
        url: def.mcpServer.httpUrl,
      } as any;
    } else {
      // Local command MCP server
      serverDef = {
        command: def.mcpServer.command,
        args: [...def.mcpServer.args],
        env,
      };
    }

    const configPath = this.providerAdapter.getGlobalMcpConfigPath();
    const mcpConfig = await this.providerAdapter.readMcpConfig(configPath);
    mcpConfig.mcpServers[def.id] = serverDef;
    await this.providerAdapter.writeMcpConfig(configPath, mcpConfig);
  }

  /**
   * Get the current configured field values for a connector.
   * Returns non-secret values from the settings file and secret placeholders.
   */
  async getFieldValues(id: string): Promise<Record<string, string>> {
    const settings = await this.readSettings(id);
    const values: Record<string, string> = { ...settings.values };

    // Add env-stored secret values
    const def = this.definitions.get(id);
    if (def) {
      for (const field of def.fields) {
        if (field.type === 'password') {
          const envKey = def.mcpServer?.envMapping[field.id] ?? field.id.toUpperCase();
          const envVal = await this.envManager.getToken(envKey);
          if (envVal) {
            values[field.id] = envVal;
          }
        }
      }
    }

    return values;
  }

  private async readSettings(id: string): Promise<ConnectorSettingsFile> {
    const settingsPath = path.join(ConnectorManager.CONNECTORS_DIR, `${id}.json`);
    try {
      const raw = await fs.readFile(settingsPath, 'utf-8');
      return JSON.parse(raw) as ConnectorSettingsFile;
    } catch {
      return { id: '', enabled: false, values: {} };
    }
  }

  private async writeSettings(id: string, settings: ConnectorSettingsFile): Promise<void> {
    await fs.mkdir(ConnectorManager.CONNECTORS_DIR, { recursive: true });
    const settingsPath = path.join(ConnectorManager.CONNECTORS_DIR, `${id}.json`);
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }
}
