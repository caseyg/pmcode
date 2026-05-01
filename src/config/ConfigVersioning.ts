import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager, PmCodeConfig } from './ConfigManager';
import { EnvManager } from './EnvManager';

export interface ConfigSnapshot {
  timestamp: string;
  config: PmCodeConfig;
  envKeys: string[];
}

export class ConfigVersioning {
  private static readonly HISTORY_DIR = path.join(os.homedir(), '.pmcode', 'history');
  private static readonly MAX_SNAPSHOTS = 50;

  private configManager: ConfigManager;
  private envManager: EnvManager;

  constructor(configManager: ConfigManager, envManager: EnvManager) {
    this.configManager = configManager;
    this.envManager = envManager;
  }

  /**
   * Create a timestamped snapshot of the current config and env key names.
   * Returns the snapshot timestamp string.
   */
  async createSnapshot(): Promise<string> {
    await fs.mkdir(ConfigVersioning.HISTORY_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const config = await this.configManager.getConfig();
    const tokens = await this.envManager.getAllTokens();

    const snapshot: ConfigSnapshot = {
      timestamp,
      config,
      envKeys: Object.keys(tokens),
    };

    const filePath = path.join(ConfigVersioning.HISTORY_DIR, `${timestamp}.json`);
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');

    await this.pruneOldSnapshots();

    return timestamp;
  }

  /**
   * List all available snapshots, sorted newest first.
   */
  async listSnapshots(): Promise<ConfigSnapshot[]> {
    try {
      const files = await fs.readdir(ConfigVersioning.HISTORY_DIR);
      const jsonFiles = files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse();

      const snapshots: ConfigSnapshot[] = [];
      for (const file of jsonFiles) {
        try {
          const raw = await fs.readFile(path.join(ConfigVersioning.HISTORY_DIR, file), 'utf-8');
          snapshots.push(JSON.parse(raw) as ConfigSnapshot);
        } catch {
          // Skip corrupted snapshot files
          continue;
        }
      }

      return snapshots;
    } catch {
      return [];
    }
  }

  /**
   * Rollback config to a specific snapshot by timestamp.
   * Restores config.json state. Does NOT restore env token values (only keys are stored).
   */
  async rollback(timestamp: string): Promise<PmCodeConfig> {
    const filePath = path.join(ConfigVersioning.HISTORY_DIR, `${timestamp}.json`);

    const raw = await fs.readFile(filePath, 'utf-8');
    const snapshot = JSON.parse(raw) as ConfigSnapshot;

    // Create a snapshot of current state before rolling back
    await this.createSnapshot();

    // Restore the config
    const restored = await this.configManager.updateConfig(snapshot.config);
    return restored;
  }

  /**
   * Get the history directory path.
   */
  static getHistoryDir(): string {
    return ConfigVersioning.HISTORY_DIR;
  }

  private async pruneOldSnapshots(): Promise<void> {
    try {
      const files = await fs.readdir(ConfigVersioning.HISTORY_DIR);
      const jsonFiles = files
        .filter((f) => f.endsWith('.json'))
        .sort();

      if (jsonFiles.length <= ConfigVersioning.MAX_SNAPSHOTS) {
        return;
      }

      const toDelete = jsonFiles.slice(0, jsonFiles.length - ConfigVersioning.MAX_SNAPSHOTS);
      for (const file of toDelete) {
        await fs.unlink(path.join(ConfigVersioning.HISTORY_DIR, file));
      }
    } catch {
      // Pruning is best-effort
    }
  }
}
