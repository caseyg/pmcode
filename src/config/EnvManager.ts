import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse as dotenvParse } from 'dotenv';

export type EnvTokenKey =
  | 'JIRA_API_TOKEN'
  | 'GITHUB_TOKEN'
  | 'MONDAY_API_TOKEN'
  | 'AHA_API_TOKEN'
  | 'TAVILY_API_KEY'
  | string;

export class EnvManager {
  private static readonly ENV_FILE = path.join(os.homedir(), '.pmcode', '.env');

  /**
   * Get a single token value by key. Returns undefined if not set.
   */
  async getToken(key: EnvTokenKey): Promise<string | undefined> {
    const tokens = await this.readEnvFile();
    return tokens[key];
  }

  /**
   * Set a token value. Creates the .env file if it doesn't exist.
   */
  async setToken(key: EnvTokenKey, value: string): Promise<void> {
    const tokens = await this.readEnvFile();
    tokens[key] = value;
    await this.writeEnvFile(tokens);
  }

  /**
   * Remove a token by key.
   */
  async removeToken(key: EnvTokenKey): Promise<void> {
    const tokens = await this.readEnvFile();
    delete tokens[key];
    await this.writeEnvFile(tokens);
  }

  /**
   * Get all tokens as a key-value record.
   */
  async getAllTokens(): Promise<Record<string, string>> {
    return this.readEnvFile();
  }

  /**
   * Get the path to the .env file.
   */
  static getEnvFilePath(): string {
    return EnvManager.ENV_FILE;
  }

  private async readEnvFile(): Promise<Record<string, string>> {
    try {
      const raw = await fs.readFile(EnvManager.ENV_FILE, 'utf-8');
      return dotenvParse(raw);
    } catch {
      return {};
    }
  }

  private async writeEnvFile(tokens: Record<string, string>): Promise<void> {
    const dir = path.dirname(EnvManager.ENV_FILE);
    await fs.mkdir(dir, { recursive: true });

    const lines = Object.entries(tokens)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => {
        // Quote values that contain spaces, #, or newlines
        if (/[\s#"']/.test(value)) {
          const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          return `${key}="${escaped}"`;
        }
        return `${key}=${value}`;
      });

    await fs.writeFile(EnvManager.ENV_FILE, lines.join('\n') + '\n', 'utf-8');
  }
}
