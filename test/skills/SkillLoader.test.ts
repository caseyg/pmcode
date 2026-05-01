import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Module-level state shared between mock factory and test code
// ---------------------------------------------------------------------------
const _files = new Map<string, string>();
const _dirs = new Map<string, { name: string; isDirectory: () => boolean }[]>();

vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (filePath: string) => {
    const content = _files.get(filePath);
    if (content === undefined) {
      throw Object.assign(new Error(`ENOENT: no such file ${filePath}`), { code: 'ENOENT' });
    }
    return content;
  }),
  readdir: vi.fn(async (dirPath: string, _opts?: any) => {
    const entries = _dirs.get(dirPath);
    if (entries === undefined) {
      throw Object.assign(new Error(`ENOENT: no such directory ${dirPath}`), { code: 'ENOENT' });
    }
    return entries;
  }),
  mkdir: vi.fn(async () => {}),
}));

vi.mock('os', () => ({
  homedir: () => '/mock-home',
}));

// Import after mocks are declared
import { SkillLoader } from '../../src/skills/SkillLoader';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addSkill(
  basePath: string,
  skillId: string,
  overrides: { name?: string; description?: string } = {}
) {
  const skillDir = path.join(basePath, skillId);
  const skillFile = path.join(skillDir, 'SKILL.md');

  const name = overrides.name ?? skillId;
  const description = overrides.description ?? `Description for ${skillId}`;

  _files.set(skillFile, `---\nname: ${name}\ndescription: ${description}\n---\nBody of ${skillId}.`);

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

describe('SkillLoader', () => {
  beforeEach(() => {
    _files.clear();
    _dirs.clear();

    // Provide a workspace folder for project-level paths
    (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/mock-workspace' } }];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads skills from all 5 locations', async () => {
    const locations = [
      { dir: '/mock-workspace/.pmcode/skills', id: 'proj-pm' },
      { dir: '/mock-workspace/.agents/skills', id: 'proj-ag' },
      { dir: '/mock-home/.pmcode/skills', id: 'glob-pm' },
      { dir: '/mock-home/.agents/skills', id: 'glob-ag' },
      { dir: '/ext/skills', id: 'bundled-s' },
    ];

    for (const loc of locations) {
      addSkill(loc.dir, loc.id);
    }

    const loader = new SkillLoader(makeContext('/ext'));
    const skills = await loader.loadAll();

    expect(skills).toHaveLength(5);
    const ids = skills.map((s) => s.id);
    expect(ids).toContain('proj-pm');
    expect(ids).toContain('proj-ag');
    expect(ids).toContain('glob-pm');
    expect(ids).toContain('glob-ag');
    expect(ids).toContain('bundled-s');
  });

  it('higher priority location wins when same skill name exists in multiple', async () => {
    addSkill('/mock-workspace/.pmcode/skills', 'dupe-skill', { description: 'project version' });
    addSkill('/ext/skills', 'dupe-skill', { description: 'bundled version' });

    const loader = new SkillLoader(makeContext('/ext'));
    const skills = await loader.loadAll();

    const found = skills.filter((s) => s.id === 'dupe-skill');
    expect(found).toHaveLength(1);
    expect(found[0].description).toBe('project version');
    expect(found[0].source).toBe('project-pmcode');
  });

  it('handles missing directories gracefully (returns 0 skills)', async () => {
    const loader = new SkillLoader(makeContext('/ext'));
    const skills = await loader.loadAll();
    expect(skills).toEqual([]);
  });

  it('loadAll() returns deduplicated list', async () => {
    addSkill('/mock-workspace/.pmcode/skills', 'alpha');
    addSkill('/mock-home/.pmcode/skills', 'alpha');
    addSkill('/ext/skills', 'alpha');
    addSkill('/mock-workspace/.pmcode/skills', 'beta');

    const loader = new SkillLoader(makeContext('/ext'));
    const skills = await loader.loadAll();

    const ids = skills.map((s) => s.id);
    expect(ids.filter((id) => id === 'alpha')).toHaveLength(1);
    expect(ids).toContain('beta');
    expect(skills).toHaveLength(2);
  });

  it('loadSkill(id) returns specific skill', async () => {
    addSkill('/ext/skills', 'target-skill');

    const loader = new SkillLoader(makeContext('/ext'));
    const skill = await loader.loadSkill('target-skill');

    expect(skill).toBeDefined();
    expect(skill!.id).toBe('target-skill');
  });

  it('loadSkill(id) returns undefined for unknown id', async () => {
    const loader = new SkillLoader(makeContext('/ext'));
    const skill = await loader.loadSkill('nonexistent');

    expect(skill).toBeUndefined();
  });

  it('correctly identifies source type from path', async () => {
    addSkill('/mock-workspace/.agents/skills', 'agent-skill');

    const loader = new SkillLoader(makeContext('/ext'));
    const skill = await loader.loadSkill('agent-skill');

    expect(skill).toBeDefined();
    expect(skill!.source).toBe('project-agents');
  });

  it('reads bundled skills from extension directory', async () => {
    addSkill('/my-extension/skills', 'ext-skill');

    const loader = new SkillLoader(makeContext('/my-extension'));
    const skill = await loader.loadSkill('ext-skill');

    expect(skill).toBeDefined();
    expect(skill!.source).toBe('bundled');
  });
});
