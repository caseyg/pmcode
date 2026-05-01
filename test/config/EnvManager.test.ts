import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

vi.mock('fs/promises');
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: vi.fn(() => '/mock/home') };
});

import { EnvManager } from '../../src/config/EnvManager';

const ENV_FILE = path.join('/mock/home', '.pmcode', '.env');

describe('EnvManager', () => {
  let manager: EnvManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new EnvManager();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getToken', () => {
    it('returns undefined for missing keys', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const token = await manager.getToken('JIRA_API_TOKEN');

      expect(token).toBeUndefined();
    });

    it('returns the value for an existing key', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('JIRA_API_TOKEN=abc123\nGITHUB_TOKEN=ghp_xyz\n');

      const token = await manager.getToken('JIRA_API_TOKEN');

      expect(token).toBe('abc123');
    });
  });

  describe('setToken', () => {
    it('creates .env file if missing', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await manager.setToken('JIRA_API_TOKEN', 'abc123');

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(ENV_FILE), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        ENV_FILE,
        expect.stringContaining('JIRA_API_TOKEN=abc123'),
        'utf-8',
      );
    });

    it('adds new key to existing .env', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('JIRA_API_TOKEN=abc123\n');

      await manager.setToken('GITHUB_TOKEN', 'ghp_xyz');

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toContain('JIRA_API_TOKEN=abc123');
      expect(written).toContain('GITHUB_TOKEN=ghp_xyz');
    });

    it('updates existing key', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('JIRA_API_TOKEN=old_value\n');

      await manager.setToken('JIRA_API_TOKEN', 'new_value');

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toContain('JIRA_API_TOKEN=new_value');
      expect(written).not.toContain('old_value');
    });
  });

  describe('removeToken', () => {
    it('removes key and value', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('JIRA_API_TOKEN=abc123\nGITHUB_TOKEN=ghp_xyz\n');

      await manager.removeToken('JIRA_API_TOKEN');

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).not.toContain('JIRA_API_TOKEN');
      expect(written).toContain('GITHUB_TOKEN=ghp_xyz');
    });

    it('handles removing a key that does not exist', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('JIRA_API_TOKEN=abc123\n');

      await manager.removeToken('NONEXISTENT_KEY');

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toContain('JIRA_API_TOKEN=abc123');
    });
  });

  describe('getAllTokens', () => {
    it('returns all key-value pairs', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('JIRA_API_TOKEN=abc123\nGITHUB_TOKEN=ghp_xyz\n');

      const tokens = await manager.getAllTokens();

      expect(tokens).toEqual({
        JIRA_API_TOKEN: 'abc123',
        GITHUB_TOKEN: 'ghp_xyz',
      });
    });

    it('returns empty object when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const tokens = await manager.getAllTokens();

      expect(tokens).toEqual({});
    });
  });

  describe('special characters', () => {
    it('handles values with spaces by quoting them', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await manager.setToken('MY_KEY', 'value with spaces');

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toContain('MY_KEY="value with spaces"');
    });

    it('handles values with equals signs', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await manager.setToken('MY_KEY', 'abc=def');

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      // equals in value without spaces should not be quoted
      expect(written).toContain('MY_KEY=abc=def');
    });

    it('handles values with hash characters by quoting them', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await manager.setToken('MY_KEY', 'abc#comment');

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toContain('MY_KEY="abc#comment"');
    });

    it('escapes double quotes in values', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await manager.setToken('MY_KEY', 'value "with" quotes');

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).toContain('MY_KEY="value \\"with\\" quotes"');
    });
  });

  describe('static methods', () => {
    it('getEnvFilePath returns correct path', () => {
      expect(EnvManager.getEnvFilePath()).toBe(ENV_FILE);
    });
  });
});
