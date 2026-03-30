import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SkillLoader } from './SkillLoader';
import { Skill, SkillSource } from './SkillParser';

/**
 * High-level manager for skill discovery, installation, and removal.
 *
 * Wraps SkillLoader with caching, install/remove operations that target
 * `~/.pmcode/skills/`, and query helpers (search, filter by connector).
 */
export class SkillManager {
  private loader: SkillLoader;
  private cachedSkills: Skill[] | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.loader = new SkillLoader(context);
  }

  /**
   * Return all discovered skills across every loading location.
   * Results are cached after the first call; use `refresh()` to clear.
   */
  async getInstalledSkills(): Promise<Skill[]> {
    if (!this.cachedSkills) {
      this.cachedSkills = await this.loader.loadAll();
    }
    return this.cachedSkills;
  }

  /**
   * Look up a single skill by id.
   */
  async getSkill(id: string): Promise<Skill | undefined> {
    const skills = await this.getInstalledSkills();
    return skills.find((s) => s.id === id);
  }

  /**
   * Install a skill by copying its directory to `~/.pmcode/skills/`.
   *
   * @param id - Skill id (directory name) to install
   * @param source - Where to copy the skill from. If omitted, the skill is
   *   looked up across all locations and the first match is used.
   * @throws If the skill cannot be found at the given source.
   */
  async installSkill(id: string, source?: string): Promise<void> {
    // Find the skill to copy
    const skill = await this.loader.loadSkill(id);
    if (!skill) {
      throw new Error(`Skill "${id}" not found in any skill location`);
    }

    // If a specific source directory was provided, use it; otherwise use the discovered path
    const sourcePath = source ?? skill.path;

    const targetDir = path.join(os.homedir(), '.pmcode', 'skills', id);

    // Ensure target parent exists
    await fs.mkdir(path.dirname(targetDir), { recursive: true });

    // Copy the entire skill directory
    await this.copyDirectory(sourcePath, targetDir);

    // Invalidate cache
    this.cachedSkills = null;
  }

  /**
   * Remove a skill from `~/.pmcode/skills/`.
   *
   * Only removes skills installed in the global PM Code location. Skills in
   * other locations (project-local, bundled, etc.) are not affected.
   *
   * @throws If the skill is not installed in `~/.pmcode/skills/`.
   */
  async removeSkill(id: string): Promise<void> {
    const targetDir = path.join(os.homedir(), '.pmcode', 'skills', id);

    try {
      await fs.access(targetDir);
    } catch {
      throw new Error(
        `Skill "${id}" is not installed in ~/.pmcode/skills/. ` +
        `Only skills in that location can be removed via this command.`
      );
    }

    await fs.rm(targetDir, { recursive: true, force: true });

    // Invalidate cache
    this.cachedSkills = null;
  }

  /**
   * Return skills that require a specific connector.
   *
   * Matches against `metadata.connectors` entries.
   */
  async getSkillsByConnector(connectorId: string): Promise<Skill[]> {
    const skills = await this.getInstalledSkills();
    const normalized = connectorId.toLowerCase();

    return skills.filter((skill) =>
      skill.metadata.connectors?.some(
        (c) => c.toLowerCase() === normalized
      )
    );
  }

  /**
   * Simple text search across skill name and description fields.
   *
   * Case-insensitive substring matching. Returns all skills where
   * the query appears in either the name or description.
   */
  async searchSkills(query: string): Promise<Skill[]> {
    const skills = await this.getInstalledSkills();
    const normalizedQuery = query.toLowerCase();

    return skills.filter((skill) => {
      const name = skill.name.toLowerCase();
      const description = skill.description.toLowerCase();
      return name.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }

  /**
   * Clear the cached skill list, forcing a fresh load on next access.
   */
  refresh(): void {
    this.cachedSkills = null;
  }

  /**
   * Recursively copy a directory and its contents.
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}
