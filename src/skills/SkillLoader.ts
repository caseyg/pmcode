import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SkillParser, Skill, SkillSource } from './SkillParser';

/**
 * A skill loading location with its filesystem path and source label.
 */
interface SkillLocation {
  path: string;
  source: SkillSource;
}

/**
 * Loads skills from all five discovery locations in priority order.
 *
 * Priority (highest first):
 *   1. `./.pmcode/skills/`   — project-local PM Code skills
 *   2. `./.agents/skills/`   — cross-agent project skills (skills.sh convention)
 *   3. `~/.pmcode/skills/`   — global PM Code skills
 *   4. `~/.agents/skills/`   — cross-agent global skills
 *   5. bundled skills        — shipped with the extension
 *
 * When the same skill id exists in multiple locations, the highest-priority
 * version wins and lower-priority duplicates are discarded.
 */
export class SkillLoader {
  private parser: SkillParser;
  private extensionPath: string;

  constructor(context: vscode.ExtensionContext) {
    this.parser = new SkillParser();
    this.extensionPath = context.extensionPath;
  }

  /**
   * Load all skills from every discovery location, de-duplicated by priority.
   */
  async loadAll(): Promise<Skill[]> {
    const locations = this.getSkillLocations();
    const skillMap = new Map<string, Skill>();

    // Process locations in priority order. First occurrence of each id wins.
    for (const location of locations) {
      const skills = await this.loadFromDirectory(location.path, location.source);
      for (const skill of skills) {
        if (!skillMap.has(skill.id)) {
          skillMap.set(skill.id, skill);
        }
      }
    }

    return Array.from(skillMap.values());
  }

  /**
   * Load a single skill by id, searching locations in priority order.
   *
   * @returns The highest-priority version of the skill, or undefined if not found.
   */
  async loadSkill(id: string): Promise<Skill | undefined> {
    const locations = this.getSkillLocations();

    for (const location of locations) {
      const skillDir = path.join(location.path, id);
      const skillFile = path.join(skillDir, 'SKILL.md');

      try {
        const content = await fs.readFile(skillFile, 'utf-8');
        return this.parser.parse(content, skillDir, location.source);
      } catch {
        // Skill not found in this location — try next
        continue;
      }
    }

    return undefined;
  }

  /**
   * Return the ordered list of skill directory paths that are searched.
   */
  getSkillPaths(): string[] {
    return this.getSkillLocations().map((loc) => loc.path);
  }

  /**
   * Build the ordered list of skill locations based on current workspace.
   */
  private getSkillLocations(): SkillLocation[] {
    const locations: SkillLocation[] = [];

    // Project-local paths (require an open workspace folder)
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      locations.push({
        path: path.join(workspaceRoot, '.pmcode', 'skills'),
        source: 'project-pmcode',
      });
      locations.push({
        path: path.join(workspaceRoot, '.agents', 'skills'),
        source: 'project-agents',
      });
    }

    // Global paths
    const home = os.homedir();
    locations.push({
      path: path.join(home, '.pmcode', 'skills'),
      source: 'global-pmcode',
    });
    locations.push({
      path: path.join(home, '.agents', 'skills'),
      source: 'global-agents',
    });

    // Bundled skills shipped with the extension
    locations.push({
      path: path.join(this.extensionPath, 'skills'),
      source: 'bundled',
    });

    return locations;
  }

  /**
   * Read all skill directories within a given parent directory.
   * Returns an empty array if the directory does not exist.
   */
  private async loadFromDirectory(dirPath: string, source: SkillSource): Promise<Skill[]> {
    let entries: string[];
    try {
      const dirEntries = await fs.readdir(dirPath, { withFileTypes: true });
      entries = dirEntries
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      // Directory doesn't exist or isn't readable — that's fine
      return [];
    }

    const skills: Skill[] = [];

    for (const entry of entries) {
      const skillDir = path.join(dirPath, entry);
      const skillFile = path.join(skillDir, 'SKILL.md');

      try {
        const content = await fs.readFile(skillFile, 'utf-8');
        const skill = this.parser.parse(content, skillDir, source);
        skills.push(skill);
      } catch (err) {
        // Log and skip malformed or unreadable skills
        console.warn(`PM Code: Failed to load skill from ${skillDir}:`, err);
      }
    }

    return skills;
  }
}
