import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { _createMockContext } from '../__mocks__/vscode';

vi.mock('fs/promises');
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: vi.fn(() => '/mock/home') };
});

import { ConfigManager, PmCodeConfig } from '../../src/config/ConfigManager';

const PMCODE_DIR = path.join('/mock/home', '.pmcode');
const CONFIG_FILE = path.join(PMCODE_DIR, 'config.json');

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

describe('ConfigManager', () => {
  let context: ReturnType<typeof _createMockContext>;
  let manager: ConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    context = _createMockContext();
    manager = new ConfigManager(context as any);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ensureDirectoryStructure', () => {
    it('creates ~/.pmcode directory structure on init', async () => {
      await manager.ensureDirectoryStructure();

      const expectedDirs = [
        PMCODE_DIR,
        path.join(PMCODE_DIR, 'skills'),
        path.join(PMCODE_DIR, 'connectors'),
        path.join(PMCODE_DIR, 'guides'),
        path.join(PMCODE_DIR, 'memory'),
        path.join(PMCODE_DIR, 'history'),
      ];

      expect(fs.mkdir).toHaveBeenCalledTimes(expectedDirs.length);
      for (const dir of expectedDirs) {
        expect(fs.mkdir).toHaveBeenCalledWith(dir, { recursive: true });
      }
    });
  });

  describe('getConfig', () => {
    it('returns default config when no file exists', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const config = await manager.getConfig();

      expect(config).toEqual(defaultConfig());
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('reads and parses config from filesystem', async () => {
      const stored: PmCodeConfig = {
        ...defaultConfig(),
        preferences: { ...defaultConfig().preferences, provider: 'custom-provider' },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(stored));

      const config = await manager.getConfig();

      expect(config.preferences.provider).toBe('custom-provider');
    });

    it('returns cached config on subsequent calls', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(defaultConfig()));

      const first = await manager.getConfig();
      const second = await manager.getConfig();

      expect(first).toBe(second);
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('handles corrupt JSON gracefully (falls back to defaults)', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('NOT VALID JSON {{{');

      const config = await manager.getConfig();

      expect(config).toEqual(defaultConfig());
    });

    it('uses globalState fallback when filesystem fails', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      const fallback: PmCodeConfig = {
        ...defaultConfig(),
        preferences: { ...defaultConfig().preferences, provider: 'fallback' },
      };
      context.globalState.get.mockImplementation((key: string, def?: unknown) => {
        if (key === 'pmcode.config') return fallback;
        return def;
      });

      const config = await manager.getConfig();

      expect(config.preferences.provider).toBe('fallback');
    });

    it('merges partial config with defaults for missing fields', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ ftue: { completed: true, completedSteps: ['step1'], phase: 'command-center' } }),
      );

      const config = await manager.getConfig();

      expect(config.ftue.completed).toBe(true);
      expect(config.ftue.phase).toBe('command-center');
      expect(config.preferences.provider).toBe('roo-code');
      expect(config.ui.sidebarCollapsed).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('merges partial updates correctly', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(defaultConfig()));

      const updated = await manager.updateConfig({
        preferences: { provider: 'new-provider' },
      });

      expect(updated.preferences.provider).toBe('new-provider');
    });

    it('preserves existing values not in the partial', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(defaultConfig()));

      const updated = await manager.updateConfig({
        preferences: { provider: 'new-provider' },
      });

      expect(updated.preferences.autoOpenCompanion).toBe(true);
      expect(updated.preferences.telemetryEnabled).toBe(false);
      expect(updated.ftue).toEqual(defaultConfig().ftue);
      expect(updated.connectors).toEqual(defaultConfig().connectors);
    });

    it('writes updated config to filesystem and globalState', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(defaultConfig()));

      await manager.updateConfig({ ftue: { completed: true } });

      expect(fs.writeFile).toHaveBeenCalledWith(CONFIG_FILE, expect.any(String), 'utf-8');
      expect(context.globalState.update).toHaveBeenCalled();
    });

    it('handles nested deep merge', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          ...defaultConfig(),
          guides: { completed: ['guide1'], inProgress: { guide2: 3 } },
        }),
      );

      const updated = await manager.updateConfig({
        guides: { inProgress: { guide3: 1 } },
      });

      expect(updated.guides.completed).toEqual(['guide1']);
      expect(updated.guides.inProgress).toEqual({ guide2: 3, guide3: 1 });
    });
  });

  describe('resetConfig', () => {
    it('restores defaults', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ ...defaultConfig(), preferences: { ...defaultConfig().preferences, provider: 'custom' } }),
      );
      await manager.getConfig();

      const reset = await manager.resetConfig();

      expect(reset).toEqual(defaultConfig());
    });

    it('writes defaults to filesystem and globalState', async () => {
      await manager.resetConfig();

      expect(fs.writeFile).toHaveBeenCalled();
      expect(context.globalState.update).toHaveBeenCalled();
    });
  });

  describe('writeConfig error handling', () => {
    it('file write errors do not crash (uses globalState fallback)', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES'));

      const config = await manager.getConfig();

      expect(config).toEqual(defaultConfig());
      expect(context.globalState.update).toHaveBeenCalled();
    });
  });

  describe('static methods', () => {
    it('getConfigDir returns correct path', () => {
      expect(ConfigManager.getConfigDir()).toBe(PMCODE_DIR);
    });

    it('getConfigFilePath returns correct path', () => {
      expect(ConfigManager.getConfigFilePath()).toBe(CONFIG_FILE);
    });
  });
});
