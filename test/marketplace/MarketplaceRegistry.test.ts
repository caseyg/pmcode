import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

vi.mock('fs/promises');
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: vi.fn(() => '/mock/home') };
});

const mockExecFn = vi.fn();
vi.mock('child_process', () => ({
  exec: (...args: any[]) => {},
}));
vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util');
  return {
    ...actual,
    promisify: () => mockExecFn,
  };
});

import { MarketplaceRegistry } from '../../src/marketplace/MarketplaceRegistry';

const sampleCatalog = {
  name: 'knowledge-work-plugins',
  owner: { name: 'Anthropic' },
  metadata: { version: '1.0.0' },
  plugins: [
    {
      name: 'product-management',
      source: './product-management',
      description: 'Write feature specs, plan roadmaps, and synthesize user research.',
      category: 'productivity',
    },
    {
      name: 'sales',
      source: './sales',
      description: 'Prospect, craft outreach, and build deal strategy.',
    },
    {
      name: 'external-plugin',
      source: { source: 'github', repo: 'org/plugin' },
      description: 'An external plugin',
      version: '2.0.0',
    },
  ],
};

describe('MarketplaceRegistry', () => {
  let registry: MarketplaceRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFn.mockReset();
    registry = new MarketplaceRegistry('https://github.com/test/marketplace.git');
  });

  describe('constructor', () => {
    it('uses provided repo URL', () => {
      expect(registry.getRepoUrl()).toBe('https://github.com/test/marketplace.git');
    });

    it('uses default repo URL when none provided', () => {
      const r = new MarketplaceRegistry();
      expect(r.getRepoUrl()).toContain('knowledge-work-plugins');
    });
  });

  describe('isCloned()', () => {
    it('returns true when .git directory exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      expect(await registry.isCloned()).toBe(true);
    });

    it('returns false when .git directory missing', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      expect(await registry.isCloned()).toBe(false);
    });
  });

  describe('sync()', () => {
    it('clones repo when not yet cloned', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      mockExecFn.mockResolvedValue({ stdout: '', stderr: '' });

      const updated = await registry.sync();

      expect(updated).toBe(true);
      expect(mockExecFn).toHaveBeenCalledWith(
        expect.stringContaining('git clone'),
        expect.any(Object)
      );
    });

    it('pulls when already cloned', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      mockExecFn.mockResolvedValue({ stdout: 'Updating abc..def\n', stderr: '' });

      const updated = await registry.sync();

      expect(updated).toBe(true);
      expect(mockExecFn).toHaveBeenCalledWith(
        'git pull --ff-only',
        expect.objectContaining({ cwd: expect.stringContaining('marketplace') })
      );
    });

    it('returns false when already up to date', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      mockExecFn.mockResolvedValue({ stdout: 'Already up to date.\n', stderr: '' });

      const updated = await registry.sync();
      expect(updated).toBe(false);
    });
  });

  describe('getCatalog()', () => {
    it('parses marketplace.json from .claude-plugin/', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      const catalog = await registry.getCatalog();

      expect(catalog.name).toBe('knowledge-work-plugins');
      expect(catalog.owner.name).toBe('Anthropic');
      expect(catalog.plugins).toHaveLength(3);
    });

    it('caches catalog after first read', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      await registry.getCatalog();
      await registry.getCatalog();

      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('handles missing plugins array', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ name: 'test', owner: { name: 'Test' } })
      );

      const catalog = await registry.getCatalog();
      expect(catalog.plugins).toEqual([]);
    });
  });

  describe('getPlugins()', () => {
    it('returns all plugins from catalog', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      const plugins = await registry.getPlugins();

      expect(plugins).toHaveLength(3);
      expect(plugins[0].name).toBe('product-management');
      expect(plugins[1].name).toBe('sales');
    });
  });

  describe('getPlugin()', () => {
    it('returns a plugin by name', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      const plugin = await registry.getPlugin('product-management');

      expect(plugin).toBeDefined();
      expect(plugin!.name).toBe('product-management');
      expect(plugin!.description).toContain('feature specs');
    });

    it('returns undefined for unknown plugin', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      const plugin = await registry.getPlugin('nonexistent');
      expect(plugin).toBeUndefined();
    });
  });

  describe('getManifest() — legacy compat', () => {
    it('builds manifest from marketplace catalog', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      const manifest = await registry.getManifest();

      expect(manifest.version).toBe('1.0.0');
      expect(manifest.skills).toHaveLength(3);
      expect(manifest.skills[0].id).toBe('product-management');
      expect(manifest.skills[0].name).toBe('Product Management');
      expect(manifest.connectors).toEqual([]);
    });

    it('caches manifest', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      await registry.getManifest();
      await registry.getManifest();

      // readFile called once for catalog, manifest is derived
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('installPlugin()', () => {
    it('copies relative-source plugin to ~/.pmcode/plugins/', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'SKILL.md', isDirectory: () => false },
      ] as any);
      vi.mocked(fs.copyFile).mockResolvedValue(undefined);

      const targetPath = await registry.installPlugin('product-management');

      expect(targetPath).toBe(path.join('/mock/home', '.pmcode', 'plugins', 'product-management'));
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.copyFile).toHaveBeenCalled();
    });

    it('throws for non-local source plugin', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      await expect(registry.installPlugin('external-plugin')).rejects.toThrow(
        'non-local source'
      );
    });

    it('throws for unknown plugin', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));

      await expect(registry.installPlugin('nonexistent')).rejects.toThrow(
        'not found in marketplace'
      );
    });
  });

  describe('installSkill() — legacy compat', () => {
    it('delegates to installPlugin', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'SKILL.md', isDirectory: () => false },
      ] as any);
      vi.mocked(fs.copyFile).mockResolvedValue(undefined);

      const targetPath = await registry.installSkill('sales');

      expect(targetPath).toContain('sales');
    });
  });

  describe('isSkillInstalled()', () => {
    it('returns true when SKILL.md exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      expect(await registry.isSkillInstalled('idea-triage')).toBe(true);
    });

    it('returns false when neither SKILL.md nor plugin.json exists', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      expect(await registry.isSkillInstalled('idea-triage')).toBe(false);
    });
  });

  describe('getStatus()', () => {
    it('returns not available when repo not cloned', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const status = await registry.getStatus();

      expect(status.available).toBe(false);
      expect(status.skillCount).toBe(0);
    });

    it('returns plugin count when repo is cloned', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify({ lastUpdated: '2026-03-30T10:00:00Z' }))
        .mockResolvedValueOnce(JSON.stringify(sampleCatalog));

      const status = await registry.getStatus();

      expect(status.available).toBe(true);
      expect(status.skillCount).toBe(3);
      expect(status.lastUpdated).toBe('2026-03-30T10:00:00Z');
    });
  });

  describe('setRepoUrl()', () => {
    it('updates repo URL and clears cache', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleCatalog));
      await registry.getCatalog(); // populate cache

      registry.setRepoUrl('https://github.com/other/repo.git');

      expect(registry.getRepoUrl()).toBe('https://github.com/other/repo.git');
      // Next getCatalog should re-read
      const newCatalog = { ...sampleCatalog, name: 'other' };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(newCatalog));
      const catalog = await registry.getCatalog();
      expect(catalog.name).toBe('other');
    });
  });
});
