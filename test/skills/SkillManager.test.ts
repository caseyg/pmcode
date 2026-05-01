import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Module-level state shared between mock factory and test code
// ---------------------------------------------------------------------------
const _files = new Map<string, string>();
const _dirs = new Map<string, { name: string; isDirectory: () => boolean }[]>();
const _accessible = new Set<string>();

vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (filePath: string) => {
    const content = _files.get(filePath);
    if (content === undefined) {
      throw Object.assign(new Error(`ENOENT: ${filePath}`), { code: 'ENOENT' });
    }
    return content;
  }),
  readdir: vi.fn(async (dirPath: string, _opts?: any) => {
    const entries = _dirs.get(dirPath);
    if (entries === undefined) {
      throw Object.assign(new Error(`ENOENT: ${dirPath}`), { code: 'ENOENT' });
    }
    return entries;
  }),
  mkdir: vi.fn(async () => {}),
  access: vi.fn(async (p: string) => {
    if (!_accessible.has(p)) {
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
    }
  }),
  rm: vi.fn(async () => {}),
  copyFile: vi.fn(async () => {}),
}));

vi.mock('os', () => ({
  homedir: () => '/mock-home',
}));

// Import after mocks are declared
import { SkillManager } from '../../src/skills/SkillManager';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addSkill(
  basePath: string,
  skillId: string,
  overrides: { name?: string; description?: string; connectors?: string; allowedTools?: string } = {}
) {
  const skillDir = path.join(basePath, skillId);
  const skillFile = path.join(skillDir, 'SKILL.md');

  const name = overrides.name ?? skillId;
  const desc = overrides.description ?? `Description for ${skillId}`;

  let frontmatter = `name: ${name}\ndescription: ${desc}`;
  if (overrides.connectors) {
    frontmatter += `\nmetadata:\n  connectors: ${overrides.connectors}`;
  }
  if (overrides.allowedTools) {
    frontmatter += `\nallowed-tools: ${overrides.allowedTools}`;
  }

  _files.set(skillFile, `---\n${frontmatter}\n---\nBody of ${skillId}.`);

  const existing = _dirs.get(basePath) ?? [];
  if (!existing.some((e) => e.name === skillId)) {
    existing.push({ name: skillId, isDirectory: () => true });
    _dirs.set(basePath, existing);
  }
}

function makeContext(extensionPath: string): any {
  return { extensionPath };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillManager', () => {
  beforeEach(() => {
    _files.clear();
    _dirs.clear();
    _accessible.clear();
    vi.mocked(fs.mkdir).mockClear();
    vi.mocked(fs.rm).mockClear();
    vi.mocked(fs.copyFile).mockClear();
    vi.mocked(fs.access).mockClear();

    (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/mock-workspace' } }];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- getInstalledSkills ----

  it('getInstalledSkills() returns all loaded skills', async () => {
    addSkill('/ext/skills', 'skill-a');
    addSkill('/ext/skills', 'skill-b');

    const mgr = new SkillManager(makeContext('/ext'));
    const skills = await mgr.getInstalledSkills();

    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.id)).toEqual(expect.arrayContaining(['skill-a', 'skill-b']));
  });

  // ---- getSkill ----

  it('getSkill(id) returns correct skill', async () => {
    addSkill('/ext/skills', 'target');

    const mgr = new SkillManager(makeContext('/ext'));
    const skill = await mgr.getSkill('target');

    expect(skill).toBeDefined();
    expect(skill!.id).toBe('target');
    expect(skill!.name).toBe('target');
  });

  it('getSkill(id) returns undefined for unknown', async () => {
    const mgr = new SkillManager(makeContext('/ext'));
    const skill = await mgr.getSkill('nope');

    expect(skill).toBeUndefined();
  });

  // ---- installSkill ----

  it('installSkill() copies skill directory to ~/.pmcode/skills/', async () => {
    addSkill('/ext/skills', 'to-install');

    // The copy process reads the source dir; mock the entries for copyDirectory
    _dirs.set(path.join('/ext/skills', 'to-install'), [
      { name: 'SKILL.md', isDirectory: () => false },
    ]);

    const mgr = new SkillManager(makeContext('/ext'));
    await mgr.installSkill('to-install');

    // Verify mkdir was called for the target parent
    expect(fs.mkdir).toHaveBeenCalledWith(
      '/mock-home/.pmcode/skills',
      { recursive: true }
    );

    // Verify copyFile was called
    expect(fs.copyFile).toHaveBeenCalledWith(
      path.join('/ext/skills', 'to-install', 'SKILL.md'),
      path.join('/mock-home/.pmcode/skills', 'to-install', 'SKILL.md')
    );
  });

  // ---- removeSkill ----

  it('removeSkill() deletes from ~/.pmcode/skills/', async () => {
    const targetDir = '/mock-home/.pmcode/skills/removable';
    _accessible.add(targetDir);

    const mgr = new SkillManager(makeContext('/ext'));
    await mgr.removeSkill('removable');

    expect(fs.rm).toHaveBeenCalledWith(targetDir, { recursive: true, force: true });
  });

  it('removeSkill() only removes from global pmcode dir (not other locations)', async () => {
    addSkill('/ext/skills', 'bundled-only');

    const mgr = new SkillManager(makeContext('/ext'));

    await expect(mgr.removeSkill('bundled-only')).rejects.toThrow(
      /not installed in ~\/\.pmcode\/skills\//
    );
  });

  // ---- getSkillsByConnector ----

  it('getSkillsByConnector() filters correctly', async () => {
    addSkill('/ext/skills', 'jira-skill', { connectors: 'jira github' });
    addSkill('/ext/skills', 'slack-skill', { connectors: 'slack' });
    addSkill('/ext/skills', 'no-conn');

    const mgr = new SkillManager(makeContext('/ext'));

    const jiraSkills = await mgr.getSkillsByConnector('jira');
    expect(jiraSkills).toHaveLength(1);
    expect(jiraSkills[0].id).toBe('jira-skill');

    const slackSkills = await mgr.getSkillsByConnector('slack');
    expect(slackSkills).toHaveLength(1);
    expect(slackSkills[0].id).toBe('slack-skill');

    const noneSkills = await mgr.getSkillsByConnector('linear');
    expect(noneSkills).toHaveLength(0);
  });

  // ---- searchSkills ----

  it('searchSkills() matches on name', async () => {
    addSkill('/ext/skills', 'idea-triage', { name: 'idea-triage', description: 'Evaluate ideas' });
    addSkill('/ext/skills', 'sprint-retro', { name: 'sprint-retro', description: 'Run retros' });

    const mgr = new SkillManager(makeContext('/ext'));
    const results = await mgr.searchSkills('idea');

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('idea-triage');
  });

  it('searchSkills() matches on description', async () => {
    addSkill('/ext/skills', 'writer', { name: 'prd-writer', description: 'Draft product requirements documents' });
    addSkill('/ext/skills', 'other', { name: 'other', description: 'Something else' });

    const mgr = new SkillManager(makeContext('/ext'));
    const results = await mgr.searchSkills('requirements');

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('writer');
  });

  it('searchSkills() is case-insensitive', async () => {
    addSkill('/ext/skills', 'my-skill', { name: 'My-Skill', description: 'A Great Tool' });

    const mgr = new SkillManager(makeContext('/ext'));

    const r1 = await mgr.searchSkills('MY-SKILL');
    expect(r1).toHaveLength(1);

    const r2 = await mgr.searchSkills('great tool');
    expect(r2).toHaveLength(1);
  });

  // ---- refresh ----

  it('refresh() reloads from disk', async () => {
    addSkill('/ext/skills', 'original');

    const mgr = new SkillManager(makeContext('/ext'));

    const first = await mgr.getInstalledSkills();
    expect(first).toHaveLength(1);

    // Add another skill on "disk"
    addSkill('/ext/skills', 'added-later');

    // Before refresh, cache still has old data
    const cached = await mgr.getInstalledSkills();
    expect(cached).toHaveLength(1);

    // After refresh, new skill appears
    mgr.refresh();
    const refreshed = await mgr.getInstalledSkills();
    expect(refreshed).toHaveLength(2);
    expect(refreshed.map((s) => s.id)).toContain('added-later');
  });
});
