import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { extensions, env, commands, window } from '../__mocks__/vscode';

vi.mock('fs/promises');
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: vi.fn(() => '/mock/home') };
});

import { RooCodeAdapter } from '../../src/providers/RooCodeAdapter';
import { McpConfig } from '../../src/providers/ProviderAdapter';

describe('RooCodeAdapter', () => {
  let adapter: RooCodeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new RooCodeAdapter();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detect', () => {
    it('returns true when Roo extension is found', async () => {
      extensions.getExtension.mockReturnValue({
        id: 'rooveterinaryinc.roo-cline',
        isActive: true,
      });

      const result = await adapter.detect();

      expect(result).toBe(true);
      expect(extensions.getExtension).toHaveBeenCalledWith('rooveterinaryinc.roo-cline');
    });

    it('returns false when Roo extension is missing', async () => {
      extensions.getExtension.mockReturnValue(undefined);

      const result = await adapter.detect();

      expect(result).toBe(false);
    });
  });

  describe('getGlobalMcpConfigPath', () => {
    it('returns correct path', () => {
      const configPath = adapter.getGlobalMcpConfigPath();

      expect(configPath).toContain('rooveterinaryinc.roo-cline');
      expect(configPath).toContain('cline_mcp_settings.json');
      expect(configPath).toContain(path.join('Library', 'Application Support', 'Code'));
    });
  });

  describe('getProjectMcpConfigPath', () => {
    it('returns correct path', () => {
      const configPath = adapter.getProjectMcpConfigPath('/workspace/project');

      expect(configPath).toBe(path.join('/workspace/project', '.roo', 'mcp.json'));
    });
  });

  describe('readMcpConfig', () => {
    it('handles missing file', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const config = await adapter.readMcpConfig('/nonexistent/path.json');

      expect(config).toEqual({ mcpServers: {} });
    });

    it('parses valid config', async () => {
      const validConfig: McpConfig = {
        mcpServers: {
          'pm-jira': {
            command: 'npx',
            args: ['-y', '@pmcode/jira-mcp'],
            env: { JIRA_API_TOKEN: 'token123' },
          },
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validConfig));

      const config = await adapter.readMcpConfig('/path/to/config.json');

      expect(config.mcpServers['pm-jira']).toBeDefined();
      expect(config.mcpServers['pm-jira'].command).toBe('npx');
      expect(config.mcpServers['pm-jira'].args).toEqual(['-y', '@pmcode/jira-mcp']);
    });

    it('returns empty config for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('NOT JSON');

      const config = await adapter.readMcpConfig('/path/to/config.json');

      expect(config).toEqual({ mcpServers: {} });
    });

    it('returns empty config when mcpServers is missing from parsed JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ otherKey: 'value' }));

      const config = await adapter.readMcpConfig('/path/to/config.json');

      expect(config).toEqual({ mcpServers: {} });
    });
  });

  describe('writeMcpConfig', () => {
    it('merges new servers with existing', async () => {
      const existing: McpConfig = {
        mcpServers: {
          'user-server': { command: 'node', args: ['server.js'] },
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existing));

      const newConfig: McpConfig = {
        mcpServers: {
          'pm-jira': { command: 'npx', args: ['-y', '@pmcode/jira-mcp'] },
        },
      };

      await adapter.writeMcpConfig('/path/to/config.json', newConfig);

      const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
      expect(written.mcpServers['user-server']).toBeDefined();
      expect(written.mcpServers['pm-jira']).toBeDefined();
    });

    it('preserves user-added servers', async () => {
      const existing: McpConfig = {
        mcpServers: {
          'my-custom-server': { command: 'python', args: ['my_server.py'] },
          'pm-old': { command: 'npx', args: ['old'] },
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existing));

      const newConfig: McpConfig = {
        mcpServers: {
          'pm-old': { command: 'npx', args: ['new-version'] },
        },
      };

      await adapter.writeMcpConfig('/path/to/config.json', newConfig);

      const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
      // User server preserved
      expect(written.mcpServers['my-custom-server'].command).toBe('python');
      // PM server updated
      expect(written.mcpServers['pm-old'].args).toEqual(['new-version']);
    });

    it('creates parent directories if needed', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await adapter.writeMcpConfig('/new/deep/path/config.json', {
        mcpServers: { test: { command: 'echo', args: ['hi'] } },
      });

      expect(fs.mkdir).toHaveBeenCalledWith('/new/deep/path', { recursive: true });
    });

    it('writes to the correct file path', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await adapter.writeMcpConfig('/path/to/config.json', {
        mcpServers: {},
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/config.json',
        expect.any(String),
        'utf-8',
      );
    });
  });

  describe('injectPrompt', () => {
    it('copies text to clipboard', async () => {
      commands.executeCommand.mockResolvedValue(undefined);

      await adapter.injectPrompt('Hello from PM Code');

      expect(env.clipboard.writeText).toHaveBeenCalledWith('Hello from PM Code');
    });

    it('tries to focus Roo Code sidebar', async () => {
      commands.executeCommand.mockResolvedValue(undefined);

      await adapter.injectPrompt('test prompt');

      expect(commands.executeCommand).toHaveBeenCalledWith('roo-cline.SidebarProvider.focus');
    });

    it('falls back to alternative command on first failure', async () => {
      commands.executeCommand
        .mockRejectedValueOnce(new Error('Command not found'))
        .mockResolvedValueOnce(undefined);

      await adapter.injectPrompt('test prompt');

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'workbench.view.extension.roo-cline-sidebar',
      );
    });

    it('shows info message when all commands fail', async () => {
      commands.executeCommand
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'));

      await adapter.injectPrompt('test prompt');

      expect(window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('clipboard'),
      );
    });
  });

  describe('provider property', () => {
    it('returns roo-code', () => {
      expect(adapter.provider).toBe('roo-code');
    });
  });
});
