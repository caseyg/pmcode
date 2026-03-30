import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { _createMockContext } from '../__mocks__/vscode';

vi.mock('fs/promises');
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: vi.fn(() => '/mock/home') };
});

import { ConfigVersioning, ConfigSnapshot } from '../../src/config/ConfigVersioning';
import { ConfigManager, PmCodeConfig } from '../../src/config/ConfigManager';
import { EnvManager } from '../../src/config/EnvManager';

const HISTORY_DIR = path.join('/mock/home', '.pmcode', 'history');

function defaultConfig(): PmCodeConfig {
  return {
    ftue: { completed: false, completedSteps: [], phase: 'companion' },
    ui: { sidebarCollapsed: false, lastOpenedPanel: null, searchHistory: [] },
    preferences: { provider: 'roo-code', autoOpenCompanion: true, telemetryEnabled: false },
    connectors: { configured: [], disabled: [] },
    skills: { used: [] },
    guides: { completed: [], inProgress: {} },
  };
}

describe('ConfigVersioning', () => {
  let context: ReturnType<typeof _createMockContext>;
  let configManager: ConfigManager;
  let envManager: EnvManager;
  let versioning: ConfigVersioning;

  beforeEach(() => {
    vi.clearAllMocks();
    context = _createMockContext();
    configManager = new ConfigManager(context as any);
    envManager = new EnvManager();
    versioning = new ConfigVersioning(configManager, envManager);

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSnapshot', () => {
    it('creates timestamped JSON file', async () => {
      // Mock configManager.getConfig() and envManager.getAllTokens()
      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        const p = typeof filePath === 'string' ? filePath : filePath.toString();
        if (p.includes('config.json')) {
          return JSON.stringify(defaultConfig());
        }
        if (p.includes('.env')) {
          return 'JIRA_API_TOKEN=abc\nGITHUB_TOKEN=ghp\n';
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const timestamp = await versioning.createSnapshot();

      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe('string');
      expect(fs.mkdir).toHaveBeenCalledWith(HISTORY_DIR, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(HISTORY_DIR),
        expect.any(String),
        'utf-8',
      );
    });

    it('includes config and env key names (not values)', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        const p = typeof filePath === 'string' ? filePath : filePath.toString();
        if (p.includes('config.json')) {
          return JSON.stringify(defaultConfig());
        }
        if (p.includes('.env')) {
          return 'SECRET_KEY=super_secret_value\n';
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      await versioning.createSnapshot();

      const writtenData = vi.mocked(fs.writeFile).mock.calls.find(
        (call) => (call[0] as string).includes(HISTORY_DIR),
      );
      expect(writtenData).toBeDefined();
      const snapshot = JSON.parse(writtenData![1] as string) as ConfigSnapshot;
      expect(snapshot.envKeys).toContain('SECRET_KEY');
      // The actual value should NOT be in the snapshot
      expect(JSON.stringify(snapshot)).not.toContain('super_secret_value');
    });
  });

  describe('listSnapshots', () => {
    it('returns newest first', async () => {
      const snap1: ConfigSnapshot = {
        timestamp: '2024-01-01T00-00-00-000Z',
        config: defaultConfig(),
        envKeys: [],
      };
      const snap2: ConfigSnapshot = {
        timestamp: '2024-06-15T12-30-00-000Z',
        config: defaultConfig(),
        envKeys: ['JIRA_API_TOKEN'],
      };

      vi.mocked(fs.readdir).mockResolvedValue([
        '2024-01-01T00-00-00-000Z.json',
        '2024-06-15T12-30-00-000Z.json',
      ] as any);
      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        const p = typeof filePath === 'string' ? filePath : filePath.toString();
        if (p.includes('2024-01-01')) return JSON.stringify(snap1);
        if (p.includes('2024-06-15')) return JSON.stringify(snap2);
        throw new Error('ENOENT');
      });

      const snapshots = await versioning.listSnapshots();

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].timestamp).toBe('2024-06-15T12-30-00-000Z');
      expect(snapshots[1].timestamp).toBe('2024-01-01T00-00-00-000Z');
    });

    it('returns empty array when history dir does not exist', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));

      const snapshots = await versioning.listSnapshots();

      expect(snapshots).toEqual([]);
    });

    it('skips corrupted snapshot files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'good.json',
        'bad.json',
      ] as any);
      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        const p = typeof filePath === 'string' ? filePath : filePath.toString();
        if (p.includes('good')) {
          return JSON.stringify({ timestamp: 'good', config: defaultConfig(), envKeys: [] });
        }
        return 'NOT VALID JSON';
      });

      const snapshots = await versioning.listSnapshots();

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].timestamp).toBe('good');
    });
  });

  describe('rollback', () => {
    it('restores config from snapshot', async () => {
      const snapshotConfig: PmCodeConfig = {
        ...defaultConfig(),
        preferences: { ...defaultConfig().preferences, provider: 'old-provider' },
      };
      const snapshot: ConfigSnapshot = {
        timestamp: '2024-01-01T00-00-00-000Z',
        config: snapshotConfig,
        envKeys: [],
      };

      // readFile: return snapshot for rollback file, current config for getConfig
      let readCallCount = 0;
      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        const p = typeof filePath === 'string' ? filePath : filePath.toString();
        if (p.includes('2024-01-01T00-00-00-000Z.json')) {
          return JSON.stringify(snapshot);
        }
        if (p.includes('config.json')) {
          return JSON.stringify(defaultConfig());
        }
        if (p.includes('.env')) {
          return '';
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const restored = await versioning.rollback('2024-01-01T00-00-00-000Z');

      expect(restored.preferences.provider).toBe('old-provider');
    });

    it('creates safety snapshot before restoring', async () => {
      const snapshot: ConfigSnapshot = {
        timestamp: '2024-01-01T00-00-00-000Z',
        config: defaultConfig(),
        envKeys: [],
      };

      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        const p = typeof filePath === 'string' ? filePath : filePath.toString();
        if (p.includes('2024-01-01T00-00-00-000Z.json')) {
          return JSON.stringify(snapshot);
        }
        if (p.includes('config.json')) {
          return JSON.stringify(defaultConfig());
        }
        if (p.includes('.env')) {
          return '';
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      await versioning.rollback('2024-01-01T00-00-00-000Z');

      // writeFile should be called: once for the safety snapshot, then for config writes
      const historyWrites = vi.mocked(fs.writeFile).mock.calls.filter(
        (call) => (call[0] as string).includes(HISTORY_DIR),
      );
      expect(historyWrites.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('auto-pruning', () => {
    it('prunes to 50 snapshots max', async () => {
      // Simulate having 52 snapshot files
      const files = Array.from({ length: 52 }, (_, i) =>
        `snapshot-${String(i).padStart(4, '0')}.json`,
      );

      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        const p = typeof filePath === 'string' ? filePath : filePath.toString();
        if (p.includes('config.json')) {
          return JSON.stringify(defaultConfig());
        }
        if (p.includes('.env')) {
          return '';
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readdir).mockResolvedValue(files as any);

      await versioning.createSnapshot();

      // readdir returns 52 files, so prune 2 to get to 50
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      // First deleted should be the oldest
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(HISTORY_DIR, 'snapshot-0000.json'),
      );
    });

    it('does not prune when under the limit', async () => {
      const files = Array.from({ length: 5 }, (_, i) => `snap-${i}.json`);

      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        const p = typeof filePath === 'string' ? filePath : filePath.toString();
        if (p.includes('config.json')) {
          return JSON.stringify(defaultConfig());
        }
        if (p.includes('.env')) {
          return '';
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.readdir).mockResolvedValue(files as any);

      await versioning.createSnapshot();

      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('static methods', () => {
    it('getHistoryDir returns correct path', () => {
      expect(ConfigVersioning.getHistoryDir()).toBe(HISTORY_DIR);
    });
  });
});
