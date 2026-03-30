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
  exec: (...args: any[]) => {
    // This gets called by promisify(exec), so we need the raw exec
    // But since we mock promisify to return mockExecFn, this is unused
  },
}));
vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util');
  return {
    ...actual,
    promisify: () => mockExecFn,
  };
});

import { MarketplaceRegistry } from '../../src/marketplace/MarketplaceRegistry';

const MARKETPLACE_DIR = path.join('/mock/home', '.pmcode', 'marketplace');

const sampleManifest = {
  version: '1.0',
  skills: [
    {
      id: 'idea-triage',
      name: 'Idea Triage',
      description: 'Evaluate and prioritize ideas',
      category: 'planning',
      version: '1.0',
      path: 'skills/idea-triage',
      connectors: ['jira'],
    },
    {
      id: 'sprint-retro',
      name: 'Sprint Retro',
      description: 'Run a sprint retrospective',
      category: 'agile',
      version: '1.0',
      path: 'skills/sprint-retro',
      connectors: ['jira', 'github'],
    },
  ],
  connectors: [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Team messaging',
      version: '1.0',
      path: 'connectors/slack',
      type: 'mcp-server',
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
      expect(r.getRepoUrl()).toContain('marketplace.git');
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
        expect.objectContaining({ cwd: MARKETPLACE_DIR })
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

  describe('getManifest()', () => {
    it('parses plugin.json from local clone', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));

      const manifest = await registry.getManifest();

      expect(manifest.version).toBe('1.0');
      expect(manifest.skills).toHaveLength(2);
      expect(manifest.connectors).toHaveLength(1);
    });

    it('caches manifest after first read', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));

      await registry.getManifest();
      await registry.getManifest();

      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('handles missing skills/connectors arrays', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0' }));

      const manifest = await registry.getManifest();

      expect(manifest.skills).toEqual([]);
      expect(manifest.connectors).toEqual([]);
    });
  });

  describe('getAvailableSkills()', () => {
    it('returns skills from manifest', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));

      const skills = await registry.getAvailableSkills();

      expect(skills).toHaveLength(2);
      expect(skills[0].id).toBe('idea-triage');
      expect(skills[1].id).toBe('sprint-retro');
    });
  });

  describe('getAvailableConnectors()', () => {
    it('returns connectors from manifest', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));

      const connectors = await registry.getAvailableConnectors();

      expect(connectors).toHaveLength(1);
      expect(connectors[0].id).toBe('slack');
    });
  });

  describe('installSkill()', () => {
    it('copies skill directory to ~/.pmcode/skills/', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'SKILL.md', isDirectory: () => false },
      ] as any);
      vi.mocked(fs.copyFile).mockResolvedValue(undefined);

      const targetPath = await registry.installSkill('idea-triage');

      expect(targetPath).toBe(path.join('/mock/home', '.pmcode', 'skills', 'idea-triage'));
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.copyFile).toHaveBeenCalled();
    });

    it('throws for unknown skill id', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));

      await expect(registry.installSkill('nonexistent')).rejects.toThrow(
        'Skill "nonexistent" not found in marketplace'
      );
    });
  });

  describe('installConnector()', () => {
    it('copies connector directory', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'connector.json', isDirectory: () => false },
      ] as any);
      vi.mocked(fs.copyFile).mockResolvedValue(undefined);

      const targetPath = await registry.installConnector('slack');

      expect(targetPath).toContain('slack');
      expect(fs.copyFile).toHaveBeenCalled();
    });

    it('throws for unknown connector id', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));

      await expect(registry.installConnector('nonexistent')).rejects.toThrow(
        'Connector "nonexistent" not found in marketplace'
      );
    });
  });

  describe('isSkillInstalled()', () => {
    it('returns true when SKILL.md exists in ~/.pmcode/skills/', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      expect(await registry.isSkillInstalled('idea-triage')).toBe(true);
    });

    it('returns false when SKILL.md does not exist', async () => {
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
      expect(status.connectorCount).toBe(0);
    });

    it('returns counts when repo is cloned', async () => {
      // access for .git check
      vi.mocked(fs.access).mockResolvedValue(undefined);
      // readFile for state and manifest
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify({ lastUpdated: '2026-03-30T10:00:00Z' }))
        .mockResolvedValueOnce(JSON.stringify(sampleManifest));

      const status = await registry.getStatus();

      expect(status.available).toBe(true);
      expect(status.skillCount).toBe(2);
      expect(status.connectorCount).toBe(1);
      expect(status.lastUpdated).toBe('2026-03-30T10:00:00Z');
    });
  });

  describe('setRepoUrl()', () => {
    it('updates repo URL and clears cache', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleManifest));
      await registry.getManifest(); // populate cache

      registry.setRepoUrl('https://github.com/other/repo.git');

      expect(registry.getRepoUrl()).toBe('https://github.com/other/repo.git');
      // Next getManifest should re-read
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ ...sampleManifest, version: '2.0' }));
      const manifest = await registry.getManifest();
      expect(manifest.version).toBe('2.0');
    });
  });
});
