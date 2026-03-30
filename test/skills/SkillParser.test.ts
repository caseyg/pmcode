import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { SkillParser, Skill, SkillSource } from '../../src/skills/SkillParser';

describe('SkillParser', () => {
  let parser: SkillParser;

  beforeEach(() => {
    parser = new SkillParser();
  });

  // ---------------------------------------------------------------------------
  // Valid frontmatter parsing
  // ---------------------------------------------------------------------------

  it('parses valid SKILL.md with all frontmatter fields', () => {
    const content = [
      '---',
      'name: my-skill',
      'description: A test skill',
      'license: MIT',
      'metadata:',
      '  author: tester',
      '  version: "2.0"',
      '  category: planning',
      '  connectors: jira github',
      'allowed-tools: Bash(git:*) Read',
      '---',
      '',
      '## Instructions',
      '',
      'Do something useful.',
    ].join('\n');

    const skill = parser.parse(content, '/fake/skills/my-skill', 'bundled');

    expect(skill.id).toBe('my-skill');
    expect(skill.name).toBe('my-skill');
    expect(skill.description).toBe('A test skill');
    expect(skill.license).toBe('MIT');
    expect(skill.metadata.author).toBe('tester');
    expect(skill.metadata.version).toBe('2.0');
    expect(skill.metadata.category).toBe('planning');
    expect(skill.metadata.connectors).toEqual(['jira', 'github']);
    expect(skill.allowedTools).toEqual(['Bash(git:*)', 'Read']);
    expect(skill.instructions).toContain('## Instructions');
    expect(skill.instructions).toContain('Do something useful.');
    expect(skill.source).toBe('bundled');
    expect(skill.path).toBe('/fake/skills/my-skill');
  });

  it('parses SKILL.md with minimal frontmatter (just name + description)', () => {
    const content = [
      '---',
      'name: minimal',
      'description: Bare minimum',
      '---',
      '',
      'Body text here.',
    ].join('\n');

    const skill = parser.parse(content, '/skills/minimal', 'global-pmcode');

    expect(skill.id).toBe('minimal');
    expect(skill.name).toBe('minimal');
    expect(skill.description).toBe('Bare minimum');
    expect(skill.license).toBeUndefined();
    expect(skill.metadata).toEqual({});
    expect(skill.allowedTools).toBeUndefined();
    expect(skill.instructions).toBe('Body text here.');
    expect(skill.source).toBe('global-pmcode');
  });

  // ---------------------------------------------------------------------------
  // Space-separated field parsing
  // ---------------------------------------------------------------------------

  it('parses space-separated connectors string into array', () => {
    const content = [
      '---',
      'name: conn-test',
      'description: connectors test',
      'metadata:',
      '  connectors: jira aha monday linear',
      '---',
      '',
      'Body.',
    ].join('\n');

    const skill = parser.parse(content, '/skills/conn-test', 'bundled');
    expect(skill.metadata.connectors).toEqual(['jira', 'aha', 'monday', 'linear']);
  });

  it('parses space-separated allowed-tools string into array', () => {
    const content = [
      '---',
      'name: tools-test',
      'description: tools test',
      'allowed-tools: Bash(git:*) Read Write Edit',
      '---',
      '',
      'Body.',
    ].join('\n');

    const skill = parser.parse(content, '/skills/tools-test', 'bundled');
    expect(skill.allowedTools).toEqual(['Bash(git:*)', 'Read', 'Write', 'Edit']);
  });

  // ---------------------------------------------------------------------------
  // Markdown body extraction
  // ---------------------------------------------------------------------------

  it('extracts markdown body as instructions', () => {
    const body = '## Title\n\nParagraph one.\n\n- Item\n- Item 2';
    const content = `---\nname: body-test\ndescription: body\n---\n\n${body}\n`;

    const skill = parser.parse(content, '/skills/body-test', 'bundled');
    expect(skill.instructions).toBe(body);
  });

  // ---------------------------------------------------------------------------
  // Missing required fields
  // ---------------------------------------------------------------------------

  it('throws for missing name field', () => {
    const content = [
      '---',
      'description: No name',
      '---',
      '',
      'Body.',
    ].join('\n');

    expect(() => parser.parse(content, '/skills/bad', 'bundled')).toThrow(
      /missing required "name" field/i
    );
  });

  it('throws for missing description field', () => {
    const content = [
      '---',
      'name: no-desc',
      '---',
      '',
      'Body.',
    ].join('\n');

    expect(() => parser.parse(content, '/skills/bad', 'bundled')).toThrow(
      /missing required "description" field/i
    );
  });

  // ---------------------------------------------------------------------------
  // Empty / malformed frontmatter
  // ---------------------------------------------------------------------------

  it('handles empty frontmatter gracefully (throws due to missing fields)', () => {
    const content = '---\n---\nBody.';

    expect(() => parser.parse(content, '/skills/empty', 'bundled')).toThrow(
      /missing required "name" field/i
    );
  });

  it('handles malformed YAML gracefully', () => {
    // gray-matter may still parse this — the key point is it should not crash
    // unexpectedly. If gray-matter cannot extract name/description, we expect
    // the required-field check to throw.
    const content = '---\n: invalid yaml {{{\n---\nBody.';

    expect(() => parser.parse(content, '/skills/bad-yaml', 'bundled')).toThrow();
  });

  // ---------------------------------------------------------------------------
  // ID derivation & source mapping
  // ---------------------------------------------------------------------------

  it('derives skill id from directory name', () => {
    const content = '---\nname: Foo\ndescription: bar\n---\nBody.';

    const skill = parser.parse(content, '/a/b/c/my-cool-skill', 'bundled');
    expect(skill.id).toBe('my-cool-skill');
  });

  it.each<[string, SkillSource]>([
    ['/project/.pmcode/skills/x', 'project-pmcode'],
    ['/project/.agents/skills/x', 'project-agents'],
    [`${process.env.HOME}/.pmcode/skills/x`, 'global-pmcode'],
    [`${process.env.HOME}/.agents/skills/x`, 'global-agents'],
    ['/ext/path/skills/x', 'bundled'],
  ])('sets correct SkillSource for path %s -> %s', (skillPath, source) => {
    const content = '---\nname: src-test\ndescription: source test\n---\nBody.';

    const skill = parser.parse(content, skillPath, source);
    expect(skill.source).toBe(source);
  });

  // ---------------------------------------------------------------------------
  // Integration tests with real bundled SKILL.md files
  // ---------------------------------------------------------------------------

  const projectRoot = path.resolve(__dirname, '..', '..');

  describe('bundled skills integration', () => {
    it('parses skills/idea-triage/SKILL.md correctly', () => {
      const filePath = path.join(projectRoot, 'skills', 'idea-triage', 'SKILL.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      const skillPath = path.join(projectRoot, 'skills', 'idea-triage');

      const skill = parser.parse(content, skillPath, 'bundled');

      expect(skill.id).toBe('idea-triage');
      expect(skill.name).toBe('idea-triage');
      expect(skill.description).toContain('prioritize');
      expect(skill.license).toBe('MIT');
      expect(skill.metadata.author).toBe('pmcode');
      expect(skill.metadata.version).toBe('1.0');
      expect(skill.metadata.category).toBe('planning');
      expect(skill.metadata.connectors).toEqual(['jira', 'aha', 'monday']);
      expect(skill.allowedTools).toEqual(['Bash(git:*)', 'Read']);
      expect(skill.instructions).toContain('## Instructions');
      expect(skill.source).toBe('bundled');
    });

    it('parses skills/sprint-retro/SKILL.md correctly', () => {
      const filePath = path.join(projectRoot, 'skills', 'sprint-retro', 'SKILL.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      const skillPath = path.join(projectRoot, 'skills', 'sprint-retro');

      const skill = parser.parse(content, skillPath, 'bundled');

      expect(skill.id).toBe('sprint-retro');
      expect(skill.name).toBe('sprint-retro');
      expect(skill.description).toContain('retrospective');
      expect(skill.license).toBe('MIT');
      expect(skill.metadata.connectors).toEqual(['jira', 'github']);
      expect(skill.allowedTools).toEqual(['Bash(git:*)', 'Bash(gh:*)', 'Read']);
      expect(skill.instructions).toContain('sprint');
    });

    it('parses skills/prd-writer/SKILL.md correctly', () => {
      const filePath = path.join(projectRoot, 'skills', 'prd-writer', 'SKILL.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      const skillPath = path.join(projectRoot, 'skills', 'prd-writer');

      const skill = parser.parse(content, skillPath, 'bundled');

      expect(skill.id).toBe('prd-writer');
      expect(skill.name).toBe('prd-writer');
      expect(skill.description).toContain('product requirements');
      expect(skill.license).toBe('MIT');
      expect(skill.metadata.connectors).toEqual(['tavily']);
      expect(skill.allowedTools).toEqual(['Bash(git:*)', 'Read']);
      expect(skill.instructions).toContain('PRD');
    });
  });
});
