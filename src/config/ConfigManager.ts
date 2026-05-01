import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface PmCodeConfig {
  ftue: {
    completed: boolean;
    completedSteps: string[];
    phase: 'companion' | 'command-center' | 'invisible';
  };
  ui: {
    sidebarCollapsed: boolean;
    lastOpenedPanel: string | null;
    searchHistory: string[];
  };
  preferences: {
    provider: string;
    autoOpenCompanion: boolean;
    telemetryEnabled: boolean;
  };
  connectors: {
    configured: string[];
    disabled: string[];
  };
  skills: {
    used: string[];
  };
  guides: {
    completed: string[];
    inProgress: Record<string, number>;
  };
}

const DEFAULT_CONFIG: PmCodeConfig = {
  ftue: {
    completed: false,
    completedSteps: [],
    phase: 'companion',
  },
  ui: {
    sidebarCollapsed: false,
    lastOpenedPanel: null,
    searchHistory: [],
  },
  preferences: {
    provider: 'roo-code',
    autoOpenCompanion: true,
    telemetryEnabled: false,
  },
  connectors: {
    configured: [],
    disabled: [],
  },
  skills: {
    used: [],
  },
  guides: {
    completed: [],
    inProgress: {},
  },
};

export class ConfigManager {
  private static readonly PMCODE_DIR = path.join(os.homedir(), '.pmcode');
  private static readonly CONFIG_FILE = path.join(ConfigManager.PMCODE_DIR, 'config.json');
  private static readonly GLOBAL_STATE_KEY = 'pmcode.config';

  private context: vscode.ExtensionContext;
  private cachedConfig: PmCodeConfig | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Ensure ~/.pmcode/ directory structure exists.
   */
  async ensureDirectoryStructure(): Promise<void> {
    const dirs = [
      ConfigManager.PMCODE_DIR,
      path.join(ConfigManager.PMCODE_DIR, 'skills'),
      path.join(ConfigManager.PMCODE_DIR, 'connectors'),
      path.join(ConfigManager.PMCODE_DIR, 'guides'),
      path.join(ConfigManager.PMCODE_DIR, 'memory'),
      path.join(ConfigManager.PMCODE_DIR, 'history'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Get the current config, reading from filesystem with globalState fallback.
   */
  async getConfig(): Promise<PmCodeConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    try {
      const raw = await fs.readFile(ConfigManager.CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PmCodeConfig>;
      this.cachedConfig = this.mergeWithDefaults(parsed);
      return this.cachedConfig;
    } catch {
      // Filesystem failed — try globalState fallback
      const fallback = this.context.globalState.get<PmCodeConfig>(ConfigManager.GLOBAL_STATE_KEY);
      if (fallback) {
        this.cachedConfig = this.mergeWithDefaults(fallback);
        return this.cachedConfig;
      }

      // No config anywhere — return defaults and persist them
      this.cachedConfig = { ...DEFAULT_CONFIG };
      await this.writeConfig(this.cachedConfig);
      return this.cachedConfig;
    }
  }

  /**
   * Update config with a partial object (deep-merged with current config).
   */
  async updateConfig(partial: DeepPartial<PmCodeConfig>): Promise<PmCodeConfig> {
    const current = await this.getConfig();
    const updated = this.deepMerge(
      current as unknown as Record<string, unknown>,
      partial as unknown as Record<string, unknown>
    ) as unknown as PmCodeConfig;
    await this.writeConfig(updated);
    this.cachedConfig = updated;
    return updated;
  }

  /**
   * Reset config to defaults.
   */
  async resetConfig(): Promise<PmCodeConfig> {
    const fresh = { ...DEFAULT_CONFIG };
    await this.writeConfig(fresh);
    this.cachedConfig = fresh;
    return fresh;
  }

  /**
   * Get the path to the ~/.pmcode directory.
   */
  static getConfigDir(): string {
    return ConfigManager.PMCODE_DIR;
  }

  /**
   * Get the path to config.json.
   */
  static getConfigFilePath(): string {
    return ConfigManager.CONFIG_FILE;
  }

  private async writeConfig(config: PmCodeConfig): Promise<void> {
    try {
      await this.ensureDirectoryStructure();
      await fs.writeFile(ConfigManager.CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      // Filesystem write failed — fall back to globalState
      console.warn('PM Code: Failed to write config.json, using globalState fallback', err);
    }

    // Always mirror to globalState as a backup
    await this.context.globalState.update(ConfigManager.GLOBAL_STATE_KEY, config);
  }

  private mergeWithDefaults(partial: Partial<PmCodeConfig>): PmCodeConfig {
    return this.deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      partial as unknown as Record<string, unknown>
    ) as unknown as PmCodeConfig;
  }

  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = target[key];
      if (
        sourceVal !== null &&
        sourceVal !== undefined &&
        typeof sourceVal === 'object' &&
        !Array.isArray(sourceVal) &&
        typeof targetVal === 'object' &&
        targetVal !== null &&
        !Array.isArray(targetVal)
      ) {
        result[key] = this.deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>
        );
      } else if (sourceVal !== undefined) {
        result[key] = sourceVal;
      }
    }
    return result;
  }
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
