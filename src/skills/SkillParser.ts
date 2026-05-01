import * as path from 'path';
import matter from 'gray-matter';

/**
 * Source location from which a skill was loaded, in priority order.
 */
export type SkillSource =
  | 'project-pmcode'
  | 'project-agents'
  | 'global-pmcode'
  | 'global-agents'
  | 'bundled';

/**
 * Parsed metadata block from SKILL.md frontmatter.
 */
export interface SkillMetadata {
  author?: string;
  version?: string;
  category?: string;
  connectors?: string[];
}

/**
 * A fully parsed skill from a SKILL.md file.
 */
export interface Skill {
  /** Directory name (e.g., "idea-triage") */
  id: string;
  /** Human-readable name from frontmatter */
  name: string;
  /** Description from frontmatter */
  description: string;
  /** License identifier (e.g., "MIT") */
  license?: string;
  /** Structured metadata from frontmatter */
  metadata: SkillMetadata;
  /** Tools the skill is permitted to use, parsed from space-separated string */
  allowedTools?: string[];
  /** Markdown body (everything after frontmatter) */
  instructions: string;
  /** Which loading location this skill came from */
  source: SkillSource;
  /** Absolute filesystem path to the skill directory */
  path: string;
}

/**
 * Frontmatter shape as it appears in the raw YAML.
 */
interface SkillFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  metadata?: {
    author?: string;
    version?: string;
    category?: string;
    connectors?: string;
  };
  'allowed-tools'?: string;
}

/**
 * Parses SKILL.md files following the agentskills.io specification.
 *
 * Expects YAML frontmatter delimited by `---` followed by a markdown body.
 * Uses the `gray-matter` package for frontmatter extraction.
 */
export class SkillParser {
  /**
   * Parse the raw content of a SKILL.md file into a Skill object.
   *
   * @param content - Raw file content including YAML frontmatter
   * @param skillPath - Absolute path to the skill directory (parent of SKILL.md)
   * @param source - Which loading location the skill was found in
   * @returns A fully populated Skill object
   * @throws If the file lacks required `name` or `description` frontmatter fields
   */
  parse(content: string, skillPath: string, source: SkillSource): Skill {
    const { data, content: body } = matter(content);
    const frontmatter = data as SkillFrontmatter;

    const name = frontmatter.name;
    const description = frontmatter.description;

    if (!name) {
      throw new Error(`SKILL.md at ${skillPath} is missing required "name" field in frontmatter`);
    }
    if (!description) {
      throw new Error(`SKILL.md at ${skillPath} is missing required "description" field in frontmatter`);
    }

    const id = path.basename(skillPath);

    const metadata: SkillMetadata = {};
    if (frontmatter.metadata) {
      metadata.author = frontmatter.metadata.author;
      metadata.version = frontmatter.metadata.version != null
        ? String(frontmatter.metadata.version)
        : undefined;
      metadata.category = frontmatter.metadata.category;

      if (frontmatter.metadata.connectors) {
        metadata.connectors = frontmatter.metadata.connectors
          .split(/\s+/)
          .filter(Boolean);
      }
    }

    let allowedTools: string[] | undefined;
    if (frontmatter['allowed-tools']) {
      allowedTools = frontmatter['allowed-tools']
        .split(/\s+/)
        .filter(Boolean);
    }

    return {
      id,
      name,
      description,
      license: frontmatter.license,
      metadata,
      allowedTools,
      instructions: body.trim(),
      source,
      path: skillPath,
    };
  }
}
