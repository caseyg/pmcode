import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import { promisify } from 'util';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * marketplace.json — the Claude Code plugin marketplace catalog format.
 * Lives at `.claude-plugin/marketplace.json` in a marketplace repo.
 */
export interface MarketplaceCatalog {
  name: string;
  owner: { name: string; email?: string };
  metadata?: {
    description?: string;
    version?: string;
    pluginRoot?: string;
  };
  plugins: MarketplacePluginEntry[];
}

/**
 * A single plugin entry in marketplace.json.
 */
export interface MarketplacePluginEntry {
  name: string;
  source: string | PluginSource;
  description?: string;
  version?: string;
  author?: { name: string; email?: string };
  category?: string;
  tags?: string[];
  homepage?: string;
}

/**
 * Structured plugin source (github, url, git-subdir, npm).
 */
export interface PluginSource {
  source: 'github' | 'url' | 'git-subdir' | 'npm';
  repo?: string;
  url?: string;
  path?: string;
  ref?: string;
  sha?: string;
  package?: string;
  version?: string;
  registry?: string;
}

// Keep backward-compat aliases for code that references these
export interface MarketplaceSkillEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  path: string;
  connectors?: string[];
}

export interface MarketplaceConnectorEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  path: string;
  type: 'mcp-server' | 'cli-tool' | 'rest-api';
}

// Legacy manifest shape — built from marketplace.json for backward compat
export interface PluginManifest {
  version: string;
  skills: MarketplaceSkillEntry[];
  connectors: MarketplaceConnectorEntry[];
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
 * Manages a local clone of a marketplace git repo, reads its
 * `.claude-plugin/marketplace.json` catalog, and provides plugin
 * discovery and install operations.
 *
 * Supports multiple marketplace registries. Each is cloned to
 * `~/.pmcode/marketplaces/<name>/`.
 */
export class MarketplaceRegistry {
  private static readonly MARKETPLACES_DIR = path.join(os.homedir(), '.pmcode', 'marketplaces');
  // Legacy single-marketplace dir for backward compat
  private static readonly LEGACY_DIR = path.join(os.homedir(), '.pmcode', 'marketplace');
  private static readonly STATE_FILE = path.join(os.homedir(), '.pmcode', 'marketplace-state.json');

  private static readonly DEFAULT_REPO_URL = 'https://github.com/anthropics/knowledge-work-plugins.git';

  private repoUrl: string;
  private cachedCatalog: MarketplaceCatalog | null = null;
  private cachedManifest: PluginManifest | null = null;

  constructor(repoUrl?: string) {
    this.repoUrl = repoUrl ?? MarketplaceRegistry.DEFAULT_REPO_URL;
  }

  /**
   * The local directory where this marketplace repo is cloned.
   */
  get localPath(): string {
    return this.getMarketplaceDir();
  }

  private getMarketplaceDir(): string {
    // Derive directory name from repo URL
    const name = this.repoUrl
      .replace(/\.git$/, '')
      .split('/')
      .pop() || 'default';
    return path.join(MarketplaceRegistry.MARKETPLACES_DIR, name);
  }

  // ── Sync ──────────────────────────────────────────────────────────────

  /**
   * Clone or pull the marketplace repo. Returns true if new content was fetched.
   */
  async sync(): Promise<boolean> {
    const dir = this.getMarketplaceDir();
    const exists = await this.isCloned();

    if (!exists) {
      await fs.mkdir(path.dirname(dir), { recursive: true });
      const execAsync = promisify(childProcess.exec);
      await execAsync(
        `git clone --depth 1 "${this.repoUrl}" "${dir}"`,
        { timeout: 60_000 }
      );
      await this.saveState();
      this.cachedCatalog = null;
      this.cachedManifest = null;
      return true;
    }

    // Pull latest
    const execAsync = promisify(childProcess.exec);
    const { stdout } = await execAsync('git pull --ff-only', {
      cwd: dir,
      timeout: 30_000,
    });

    const updated = !stdout.includes('Already up to date');
    if (updated) {
      this.cachedCatalog = null;
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
      await fs.access(path.join(this.getMarketplaceDir(), '.git'));
      return true;
    } catch {
      return false;
    }
  }

  // ── Catalog ───────────────────────────────────────────────────────────

  /**
   * Read and parse the marketplace catalog (`.claude-plugin/marketplace.json`).
   */
  async getCatalog(): Promise<MarketplaceCatalog> {
    if (this.cachedCatalog) {
      return this.cachedCatalog;
    }

    const catalogPath = path.join(
      this.getMarketplaceDir(),
      '.claude-plugin',
      'marketplace.json'
    );
    const raw = await fs.readFile(catalogPath, 'utf-8');
    const parsed = JSON.parse(raw) as MarketplaceCatalog;

    if (!parsed.plugins) { parsed.plugins = []; }

    this.cachedCatalog = parsed;
    return parsed;
  }

  /**
   * List all plugins in this marketplace.
   */
  async getPlugins(): Promise<MarketplacePluginEntry[]> {
    const catalog = await this.getCatalog();
    return catalog.plugins;
  }

  /**
   * Get a single plugin entry by name.
   */
  async getPlugin(name: string): Promise<MarketplacePluginEntry | undefined> {
    const catalog = await this.getCatalog();
    return catalog.plugins.find(p => p.name === name);
  }

  // ── Legacy manifest interface ─────────────────────────────────────────

  /**
   * Build a PluginManifest from the marketplace catalog.
   * Maps plugin entries to the legacy skills/connectors format for
   * backward compatibility with existing panels and commands.
   */
  async getManifest(): Promise<PluginManifest> {
    if (this.cachedManifest) {
      return this.cachedManifest;
    }

    const catalog = await this.getCatalog();
    const skills: MarketplaceSkillEntry[] = [];

    for (const plugin of catalog.plugins) {
      const sourcePath = typeof plugin.source === 'string' ? plugin.source : '';
      skills.push({
        id: plugin.name,
        name: plugin.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: plugin.description || '',
        category: plugin.category || 'general',
        version: plugin.version || '1.0.0',
        path: sourcePath,
      });
    }

    const manifest: PluginManifest = {
      version: catalog.metadata?.version || '1.0.0',
      skills,
      connectors: [],
    };

    this.cachedManifest = manifest;
    return manifest;
  }

  /**
   * List available skills (plugins) from the marketplace.
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
   * Install a plugin from the marketplace.
   * For relative-source plugins, copies from the local clone.
   * Also extracts skills/ into ~/.pmcode/skills/ so SkillLoader finds them.
   */
  async installPlugin(pluginName: string): Promise<string> {
    const catalog = await this.getCatalog();
    const entry = catalog.plugins.find(p => p.name === pluginName);
    if (!entry) {
      throw new Error(`Plugin "${pluginName}" not found in marketplace`);
    }

    const source = entry.source;
    if (typeof source === 'string' && source.startsWith('./')) {
      // Relative path — copy from local clone
      const sourcePath = path.join(this.getMarketplaceDir(), source);
      const targetPath = path.join(os.homedir(), '.pmcode', 'plugins', pluginName);
      await this.copyDirectory(sourcePath, targetPath);

      // Extract skills into ~/.pmcode/skills/ so SkillLoader discovers them
      const skillsDir = path.join(sourcePath, 'skills');
      try {
        const skillEntries = await fs.readdir(skillsDir, { withFileTypes: true });
        for (const entry of skillEntries) {
          if (entry.isDirectory()) {
            const skillSource = path.join(skillsDir, entry.name);
            const skillTarget = path.join(os.homedir(), '.pmcode', 'skills', entry.name);
            await this.copyDirectory(skillSource, skillTarget);
          }
        }
      } catch {
        // No skills/ directory in this plugin — that's fine
      }

      return targetPath;
    }

    throw new Error(
      `Plugin "${pluginName}" uses a non-local source. ` +
      `Only relative-path sources (./...) are supported for direct install.`
    );
  }

  /**
   * Install a skill from the marketplace to ~/.pmcode/skills/.
   * Backward-compat wrapper around installPlugin.
   */
  async installSkill(skillId: string): Promise<string> {
    return this.installPlugin(skillId);
  }

  /**
   * Install a connector from the marketplace.
   */
  async installConnector(connectorId: string): Promise<string> {
    const manifest = await this.getManifest();
    const entry = manifest.connectors.find(c => c.id === connectorId);
    if (!entry) {
      throw new Error(`Connector "${connectorId}" not found in marketplace`);
    }

    const sourcePath = path.join(this.getMarketplaceDir(), entry.path);
    const targetPath = path.join(os.homedir(), '.pmcode', 'connectors', 'marketplace', connectorId);
    await this.copyDirectory(sourcePath, targetPath);
    return targetPath;
  }

  // ── Status ────────────────────────────────────────────────────────────

  /**
   * Get the current marketplace status.
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
      const catalog = await this.getCatalog();
      return {
        available: true,
        lastUpdated: state.lastUpdated,
        repoUrl: this.repoUrl,
        manifestVersion: catalog.metadata?.version || null,
        skillCount: catalog.plugins.length,
        connectorCount: 0,
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
   * Check if a plugin is already installed locally.
   */
  async isSkillInstalled(skillId: string): Promise<boolean> {
    // Check both legacy skills dir and new plugins dir
    const paths = [
      path.join(os.homedir(), '.pmcode', 'skills', skillId, 'SKILL.md'),
      path.join(os.homedir(), '.pmcode', 'plugins', skillId, '.claude-plugin', 'plugin.json'),
    ];
    for (const p of paths) {
      try {
        await fs.access(p);
        return true;
      } catch {
        // continue
      }
    }
    return false;
  }

  /**
   * Get the marketplace repo URL.
   */
  getRepoUrl(): string {
    return this.repoUrl;
  }

  /**
   * Set a new marketplace repo URL. Clears cached data.
   */
  setRepoUrl(url: string): void {
    this.repoUrl = url;
    this.cachedCatalog = null;
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
