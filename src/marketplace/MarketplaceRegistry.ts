import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import { promisify } from 'util';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Marketplace plugin manifest (plugin.json at repo root).
 */
export interface PluginManifest {
  version: string;
  skills: MarketplaceSkillEntry[];
  connectors: MarketplaceConnectorEntry[];
}

export interface MarketplaceSkillEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  path: string; // relative path within the repo (e.g. "skills/idea-triage")
  connectors?: string[];
}

export interface MarketplaceConnectorEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  path: string; // relative path within the repo
  type: 'mcp-server' | 'cli-tool' | 'rest-api';
}

export interface MarketplaceStatus {
  available: boolean;
  lastUpdated: string | null;
  repoUrl: string;
  manifestVersion: string | null;
  skillCount: number;
  connectorCount: number;
}

// ── MarketplaceRegistry ───────────────────────────────────────────────────

/**
 * Manages a local clone of the marketplace git repo, reads its plugin
 * manifest, and provides install/update operations for skills and connectors.
 *
 * The repo is cloned to ~/.pmcode/marketplace/. Updates are git pull.
 * The repo URL is configurable; defaults to a placeholder until the real
 * repo is set up.
 */
export class MarketplaceRegistry {
  private static readonly MARKETPLACE_DIR = path.join(os.homedir(), '.pmcode', 'marketplace');
  private static readonly MANIFEST_FILE = 'plugin.json';
  private static readonly STATE_FILE = path.join(os.homedir(), '.pmcode', 'marketplace-state.json');

  private static readonly DEFAULT_REPO_URL = 'https://github.com/pmcode-tools/marketplace.git';

  private repoUrl: string;
  private cachedManifest: PluginManifest | null = null;

  constructor(repoUrl?: string) {
    this.repoUrl = repoUrl ?? MarketplaceRegistry.DEFAULT_REPO_URL;
  }

  /**
   * The local directory where the marketplace repo is cloned.
   */
  get localPath(): string {
    return MarketplaceRegistry.MARKETPLACE_DIR;
  }

  // ── Sync ──────────────────────────────────────────────────────────────

  /**
   * Clone or pull the marketplace repo. Returns true if new content was fetched.
   */
  async sync(): Promise<boolean> {
    const exists = await this.isCloned();

    if (!exists) {
      await fs.mkdir(path.dirname(MarketplaceRegistry.MARKETPLACE_DIR), { recursive: true });
      const execAsync = promisify(childProcess.exec);
      await execAsync(
        `git clone --depth 1 "${this.repoUrl}" "${MarketplaceRegistry.MARKETPLACE_DIR}"`,
        { timeout: 60_000 }
      );
      await this.saveState();
      this.cachedManifest = null;
      return true;
    }

    // Pull latest
    const execAsync = promisify(childProcess.exec);
    const { stdout } = await execAsync('git pull --ff-only', {
      cwd: MarketplaceRegistry.MARKETPLACE_DIR,
      timeout: 30_000,
    });

    const updated = !stdout.includes('Already up to date');
    if (updated) {
      this.cachedManifest = null;
    }
    await this.saveState();
    return updated;
  }

  /**
   * Check if the marketplace repo has been cloned.
   */
  async isCloned(): Promise<boolean> {
    try {
      await fs.access(path.join(MarketplaceRegistry.MARKETPLACE_DIR, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  // ── Manifest ──────────────────────────────────────────────────────────

  /**
   * Read and parse the plugin manifest from the local clone.
   */
  async getManifest(): Promise<PluginManifest> {
    if (this.cachedManifest) {
      return this.cachedManifest;
    }

    const manifestPath = path.join(MarketplaceRegistry.MARKETPLACE_DIR, MarketplaceRegistry.MANIFEST_FILE);
    const raw = await fs.readFile(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as PluginManifest;

    // Validate basic structure
    if (!parsed.skills) { parsed.skills = []; }
    if (!parsed.connectors) { parsed.connectors = []; }

    this.cachedManifest = parsed;
    return parsed;
  }

  /**
   * List available skills from the marketplace.
   */
  async getAvailableSkills(): Promise<MarketplaceSkillEntry[]> {
    const manifest = await this.getManifest();
    return manifest.skills;
  }

  /**
   * List available connectors from the marketplace.
   */
  async getAvailableConnectors(): Promise<MarketplaceConnectorEntry[]> {
    const manifest = await this.getManifest();
    return manifest.connectors;
  }

  // ── Install ───────────────────────────────────────────────────────────

  /**
   * Install a skill from the marketplace to ~/.pmcode/skills/.
   * Copies the skill directory from the local clone.
   */
  async installSkill(skillId: string): Promise<string> {
    const manifest = await this.getManifest();
    const entry = manifest.skills.find(s => s.id === skillId);
    if (!entry) {
      throw new Error(`Skill "${skillId}" not found in marketplace`);
    }

    const sourcePath = path.join(MarketplaceRegistry.MARKETPLACE_DIR, entry.path);
    const targetPath = path.join(os.homedir(), '.pmcode', 'skills', skillId);

    await this.copyDirectory(sourcePath, targetPath);
    return targetPath;
  }

  /**
   * Install a connector definition from the marketplace to ~/.pmcode/connectors/.
   * Copies the connector directory from the local clone.
   */
  async installConnector(connectorId: string): Promise<string> {
    const manifest = await this.getManifest();
    const entry = manifest.connectors.find(c => c.id === connectorId);
    if (!entry) {
      throw new Error(`Connector "${connectorId}" not found in marketplace`);
    }

    const sourcePath = path.join(MarketplaceRegistry.MARKETPLACE_DIR, entry.path);
    const targetPath = path.join(os.homedir(), '.pmcode', 'connectors', 'marketplace', connectorId);

    await this.copyDirectory(sourcePath, targetPath);
    return targetPath;
  }

  // ── Status ────────────────────────────────────────────────────────────

  /**
   * Get the current marketplace status (availability, last update, counts).
   */
  async getStatus(): Promise<MarketplaceStatus> {
    const cloned = await this.isCloned();

    if (!cloned) {
      return {
        available: false,
        lastUpdated: null,
        repoUrl: this.repoUrl,
        manifestVersion: null,
        skillCount: 0,
        connectorCount: 0,
      };
    }

    const state = await this.loadState();

    try {
      const manifest = await this.getManifest();
      return {
        available: true,
        lastUpdated: state.lastUpdated,
        repoUrl: this.repoUrl,
        manifestVersion: manifest.version,
        skillCount: manifest.skills.length,
        connectorCount: manifest.connectors.length,
      };
    } catch {
      return {
        available: true,
        lastUpdated: state.lastUpdated,
        repoUrl: this.repoUrl,
        manifestVersion: null,
        skillCount: 0,
        connectorCount: 0,
      };
    }
  }

  /**
   * Check if a skill from the marketplace is already installed locally.
   */
  async isSkillInstalled(skillId: string): Promise<boolean> {
    const targetPath = path.join(os.homedir(), '.pmcode', 'skills', skillId, 'SKILL.md');
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the marketplace repo URL.
   */
  getRepoUrl(): string {
    return this.repoUrl;
  }

  /**
   * Set a new marketplace repo URL. Clears cached manifest.
   */
  setRepoUrl(url: string): void {
    this.repoUrl = url;
    this.cachedManifest = null;
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private async saveState(): Promise<void> {
    const state = {
      lastUpdated: new Date().toISOString(),
      repoUrl: this.repoUrl,
    };
    await fs.mkdir(path.dirname(MarketplaceRegistry.STATE_FILE), { recursive: true });
    await fs.writeFile(MarketplaceRegistry.STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  }

  private async loadState(): Promise<{ lastUpdated: string | null; repoUrl: string }> {
    try {
      const raw = await fs.readFile(MarketplaceRegistry.STATE_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { lastUpdated: null, repoUrl: this.repoUrl };
    }
  }

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
