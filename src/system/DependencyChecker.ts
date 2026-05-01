import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ── Types ──────────────────────────────────────────────────────────────────

export interface DependencyStatus {
  id: string;
  label: string;
  techLabel: string;
  installed: boolean;
  version?: string;
  installCommand?: string;
}

interface DependencyDefinition {
  id: string;
  label: string;
  techLabel: string;
  command: string;
  versionRegex: RegExp;
  installCommand: string;
}

// ── Dependency definitions ─────────────────────────────────────────────────

const DEPENDENCIES: DependencyDefinition[] = [
  {
    id: 'xcode-cli',
    label: 'Developer tools ready',
    techLabel: 'xcode-select installed',
    command: 'xcode-select -p',
    versionRegex: /^\/.*$/m,
    installCommand: 'xcode-select --install',
  },
  {
    id: 'node',
    label: 'Node.js ready',
    techLabel: 'node installed',
    command: 'node --version',
    versionRegex: /v?([\d.]+)/,
    installCommand: 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install --lts',
  },
  {
    id: 'python',
    label: 'Python ready',
    techLabel: 'python3 installed',
    command: 'python3 --version',
    versionRegex: /Python\s+([\d.]+)/,
    installCommand: 'brew install python3',
  },
  {
    id: 'gh',
    label: 'GitHub CLI ready',
    techLabel: 'gh CLI installed',
    command: 'gh --version',
    versionRegex: /gh version\s+([\d.]+)/,
    installCommand: 'brew install gh',
  },
];

// ── DependencyChecker ──────────────────────────────────────────────────────

export class DependencyChecker {
  /**
   * Check all system dependencies and return their statuses.
   */
  async checkAll(): Promise<DependencyStatus[]> {
    const results: DependencyStatus[] = [];

    for (const dep of DEPENDENCIES) {
      results.push(await this.check(dep.id));
    }

    return results;
  }

  /**
   * Check a single dependency by id.
   */
  async check(depId: string): Promise<DependencyStatus> {
    const dep = DEPENDENCIES.find((d) => d.id === depId);
    if (!dep) {
      return {
        id: depId,
        label: depId,
        techLabel: depId,
        installed: false,
        installCommand: undefined,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(dep.command, {
        timeout: 10_000,
        env: { ...process.env, PATH: this.getExtendedPath() },
      });

      const output = stdout || stderr;
      const match = output.match(dep.versionRegex);
      const version = match?.[1] ?? match?.[0]?.trim();

      return {
        id: dep.id,
        label: dep.label,
        techLabel: dep.techLabel,
        installed: true,
        version,
      };
    } catch {
      return {
        id: dep.id,
        label: dep.label,
        techLabel: dep.techLabel,
        installed: false,
        installCommand: dep.installCommand,
      };
    }
  }

  /**
   * Extend PATH to include common tool locations that may not be in the
   * VS Code subprocess environment.
   */
  private getExtendedPath(): string {
    const basePath = process.env.PATH ?? '';
    const extras = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      `${process.env.HOME}/.nvm/current/bin`,
      `${process.env.HOME}/.pyenv/shims`,
    ];

    return [...extras, basePath].join(':');
  }
}
