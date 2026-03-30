import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnvManager } from '../../src/config/EnvManager';
import type { ProviderAdapter, McpConfig } from '../../src/providers/ProviderAdapter';

// ── Mock fs/promises before importing ConnectorManager ───────────────────────

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: (fn: Function) => fn,
  };
});

import * as fs from 'fs/promises';
import { ConnectorManager } from '../../src/connectors/ConnectorManager';
import { exec } from 'child_process';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockEnvManager(): EnvManager {
  const store: Record<string, string> = {};
  return {
    getToken: vi.fn(async (key: string) => store[key]),
    setToken: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeToken: vi.fn(async (key: string) => {
      delete store[key];
    }),
    getAllTokens: vi.fn(async () => ({ ...store })),
  } as unknown as EnvManager;
}

function createMockProviderAdapter(): ProviderAdapter {
  let mcpConfig: McpConfig = { mcpServers: {} };
  return {
    provider: 'test',
    detect: vi.fn().mockResolvedValue(true),
    getGlobalMcpConfigPath: vi.fn().mockReturnValue('/mock/mcp-config.json'),
    getProjectMcpConfigPath: vi.fn().mockReturnValue('/mock/project-mcp.json'),
    readMcpConfig: vi.fn(async () => ({ ...mcpConfig, mcpServers: { ...mcpConfig.mcpServers } })),
    writeMcpConfig: vi.fn(async (_path: string, config: McpConfig) => {
      mcpConfig = config;
    }),
    injectPrompt: vi.fn().mockResolvedValue(undefined),
  } as unknown as ProviderAdapter;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConnectorManager', () => {
  let envManager: EnvManager;
  let providerAdapter: ProviderAdapter;
  let manager: ConnectorManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: readFile throws (no settings file)
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    envManager = createMockEnvManager();
    providerAdapter = createMockProviderAdapter();
    manager = new ConnectorManager(envManager, providerAdapter);
  });

  // ── getConnectors ────────────────────────────────────────────────────────

  describe('getConnectors()', () => {
    it('returns all 5 connector definitions', async () => {
      const connectors = await manager.getConnectors();
      expect(connectors).toHaveLength(5);
      const ids = connectors.map((c) => c.id);
      expect(ids).toContain('jira');
      expect(ids).toContain('github');
      expect(ids).toContain('monday');
      expect(ids).toContain('aha');
      expect(ids).toContain('tavily');
    });
  });

  // ── getConnector ─────────────────────────────────────────────────────────

  describe('getConnector()', () => {
    it('returns the correct connector by id', async () => {
      const jira = await manager.getConnector('jira');
      expect(jira).toBeDefined();
      expect(jira!.id).toBe('jira');
      expect(jira!.name).toBe('Jira');
    });

    it('returns undefined for unknown id', async () => {
      const result = await manager.getConnector('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  // ── configure ────────────────────────────────────────────────────────────

  describe('configure()', () => {
    it('saves secret fields to EnvManager', async () => {
      await manager.configure('jira', {
        instanceUrl: 'https://test.atlassian.net',
        apiToken: 'secret-token-123',
      });

      expect(envManager.setToken).toHaveBeenCalledWith('JIRA_API_TOKEN', 'secret-token-123');
    });

    it('saves non-secret settings to connector JSON file', async () => {
      await manager.configure('jira', {
        instanceUrl: 'https://test.atlassian.net',
        apiToken: 'secret-token-123',
        defaultProject: 'PROJ',
      });

      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenPath = writeCall[0] as string;
      expect(writtenPath).toContain('jira.json');

      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.id).toBe('jira');
      expect(writtenData.enabled).toBe(true);
      // instanceUrl is url type (non-secret), so it should be in values
      expect(writtenData.values.instanceUrl).toBe('https://test.atlassian.net');
      // defaultProject is text type (non-secret), so it should be in values
      expect(writtenData.values.defaultProject).toBe('PROJ');
      // apiToken is password type (secret), so it should NOT be in values
      expect(writtenData.values.apiToken).toBeUndefined();
    });

    it('writes MCP config via ProviderAdapter for MCP server types', async () => {
      await manager.configure('jira', {
        instanceUrl: 'https://test.atlassian.net',
        apiToken: 'secret-token-123',
      });

      expect(providerAdapter.getGlobalMcpConfigPath).toHaveBeenCalled();
      expect(providerAdapter.readMcpConfig).toHaveBeenCalled();
      expect(providerAdapter.writeMcpConfig).toHaveBeenCalled();

      const writeCall = vi.mocked(providerAdapter.writeMcpConfig).mock.calls[0];
      const config = writeCall[1] as McpConfig;
      expect(config.mcpServers['jira']).toBeDefined();
      expect(config.mcpServers['jira'].command).toBe('npx');
      expect(config.mcpServers['jira'].env).toEqual({
        JIRA_URL: 'https://test.atlassian.net',
        JIRA_API_TOKEN: 'secret-token-123',
      });
    });

    it('does not write MCP config for CLI tool type (github)', async () => {
      await manager.configure('github', {});

      expect(providerAdapter.writeMcpConfig).not.toHaveBeenCalled();
    });

    it('throws for unknown connector id', async () => {
      await expect(manager.configure('nonexistent', {})).rejects.toThrow('Unknown connector: nonexistent');
    });
  });

  // ── testConnection ───────────────────────────────────────────────────────

  describe('testConnection()', () => {
    it('for MCP servers, checks that required credentials exist', async () => {
      // No credentials set => should return error about missing credential
      vi.mocked(exec as unknown as (...args: any[]) => any).mockRejectedValue(new Error('not found'));

      const result = await manager.testConnection('jira');
      expect(result.status).toBe('error');
      expect(result.message).toContain('Missing required credential');
    });

    it('for MCP servers, returns connected when credentials exist and command found', async () => {
      // Set up credentials
      vi.mocked(envManager.getToken).mockResolvedValue('some-token');
      vi.mocked(exec as unknown as (...args: any[]) => any).mockResolvedValue({ stdout: '/usr/bin/npx', stderr: '' });

      const result = await manager.testConnection('jira');
      expect(result.status).toBe('connected');
    });

    it('for CLI tools, runs the status command', async () => {
      vi.mocked(exec as unknown as (...args: any[]) => any).mockResolvedValue({
        stdout: 'Logged in to github.com as testuser',
        stderr: '',
      });

      const result = await manager.testConnection('github');
      expect(result.status).toBe('connected');
      expect(result.message).toContain('Logged in');
    });

    it('for CLI tools, returns error when status command fails', async () => {
      vi.mocked(exec as unknown as (...args: any[]) => any).mockRejectedValue(
        new Error('gh: command not found')
      );

      const result = await manager.testConnection('github');
      expect(result.status).toBe('error');
      expect(result.message).toContain('command not found');
    });

    it('returns error for unknown connector', async () => {
      const result = await manager.testConnection('nonexistent');
      expect(result.status).toBe('error');
      expect(result.message).toContain('Unknown connector');
    });
  });

  // ── enable ───────────────────────────────────────────────────────────────

  describe('enable()', () => {
    it('updates connector settings to enabled', async () => {
      // Simulate existing disabled settings file
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ id: 'jira', enabled: false, values: {} }) as any
      );

      // Also set up the MCP config with the server
      vi.mocked(providerAdapter.readMcpConfig).mockResolvedValue({
        mcpServers: { jira: { command: 'npx', args: [], disabled: true } },
      });

      await manager.enable('jira');

      // Should write settings with enabled: true
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const written = JSON.parse(writeCall[1] as string);
      expect(written.enabled).toBe(true);

      // Should update MCP config to disabled: false
      expect(providerAdapter.writeMcpConfig).toHaveBeenCalled();
      const mcpCall = vi.mocked(providerAdapter.writeMcpConfig).mock.calls[0];
      expect(mcpCall[1].mcpServers['jira'].disabled).toBe(false);
    });
  });

  // ── disable ──────────────────────────────────────────────────────────────

  describe('disable()', () => {
    it('sets disabled flag on MCP server', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ id: 'jira', enabled: true, values: {} }) as any
      );

      vi.mocked(providerAdapter.readMcpConfig).mockResolvedValue({
        mcpServers: { jira: { command: 'npx', args: [] } },
      });

      await manager.disable('jira');

      // Should write settings with enabled: false
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const written = JSON.parse(writeCall[1] as string);
      expect(written.enabled).toBe(false);

      // Should update MCP config with disabled: true
      expect(providerAdapter.writeMcpConfig).toHaveBeenCalled();
      const mcpCall = vi.mocked(providerAdapter.writeMcpConfig).mock.calls[0];
      expect(mcpCall[1].mcpServers['jira'].disabled).toBe(true);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('cleans up secrets, settings file, and MCP entry', async () => {
      vi.mocked(providerAdapter.readMcpConfig).mockResolvedValue({
        mcpServers: { jira: { command: 'npx', args: [] } },
      });

      await manager.remove('jira');

      // Should remove secrets
      expect(envManager.removeToken).toHaveBeenCalledWith('JIRA_URL');
      expect(envManager.removeToken).toHaveBeenCalledWith('JIRA_API_TOKEN');

      // Should delete settings file
      expect(fs.unlink).toHaveBeenCalled();
      const unlinkPath = vi.mocked(fs.unlink).mock.calls[0][0] as string;
      expect(unlinkPath).toContain('jira.json');

      // Should remove from MCP config
      expect(providerAdapter.writeMcpConfig).toHaveBeenCalled();
      const mcpCall = vi.mocked(providerAdapter.writeMcpConfig).mock.calls[0];
      expect(mcpCall[1].mcpServers['jira']).toBeUndefined();
    });

    it('does nothing for unknown connector', async () => {
      await manager.remove('nonexistent');
      expect(envManager.removeToken).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });

  // ── getStatus ────────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns unconfigured when no settings file exists', async () => {
      // readFile throws ENOENT (default mock)
      const connector = await manager.getConnector('jira');
      expect(connector!.status).toBe('unconfigured');
    });

    it('returns disabled when settings exist but disabled', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ id: 'jira', enabled: false, values: {} }) as any
      );

      const connector = await manager.getConnector('jira');
      expect(connector!.status).toBe('disabled');
    });

    it('returns connected when configured, enabled, and secrets present', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ id: 'jira', enabled: true, values: {} }) as any
      );
      vi.mocked(envManager.getToken).mockResolvedValue('some-token');

      const connector = await manager.getConnector('jira');
      expect(connector!.status).toBe('connected');
    });

    it('returns warning when configured but required secret is missing', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ id: 'jira', enabled: true, values: {} }) as any
      );
      // getToken returns undefined (no secret) — default mock behavior

      const connector = await manager.getConnector('jira');
      expect(connector!.status).toBe('warning');
    });

    it('returns connected for CLI tool when status command succeeds', async () => {
      vi.mocked(exec as unknown as (...args: any[]) => any).mockResolvedValue({
        stdout: 'ok',
        stderr: '',
      });

      const connector = await manager.getConnector('github');
      expect(connector!.status).toBe('connected');
    });

    it('returns unconfigured for CLI tool when status command fails', async () => {
      vi.mocked(exec as unknown as (...args: any[]) => any).mockRejectedValue(
        new Error('not found')
      );

      const connector = await manager.getConnector('github');
      expect(connector!.status).toBe('unconfigured');
    });

    it('returns error for unknown connector id', async () => {
      // Access getStatus indirectly: getConnector returns undefined for unknown
      // but we can test via the internal list
      const connector = await manager.getConnector('nonexistent');
      expect(connector).toBeUndefined();
    });
  });
});
