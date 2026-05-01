import { DependencyChecker, DependencyStatus } from './DependencyChecker';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SetupStatus {
  phase: 'idle' | 'checking-dependencies' | 'loading-connectors' | 'loading-skills' | 'complete';
  dependencies: DependencyStatus[];
  connectorsLoaded: boolean;
  skillsLoaded: boolean;
  error?: string;
}

export type SetupProgressCallback = (status: SetupStatus) => void;

// ── SetupProgress ──────────────────────────────────────────────────────────

/**
 * Tracks background setup progress during the first-time user experience.
 *
 * Uses an EventEmitter-style callback pattern to notify the sidebar and
 * companion panel of progress updates as dependencies are checked,
 * connectors are loaded, and skills are discovered.
 */
export class SetupProgress {
  private status: SetupStatus = {
    phase: 'idle',
    dependencies: [],
    connectorsLoaded: false,
    skillsLoaded: false,
  };

  private listeners: SetupProgressCallback[] = [];
  private dependencyChecker: DependencyChecker;

  constructor() {
    this.dependencyChecker = new DependencyChecker();
  }

  /**
   * Start the background setup process.
   *
   * Runs dependency checks, then signals connector and skill loading phases.
   * Callers are responsible for actually loading connectors/skills and calling
   * `markConnectorsLoaded()` and `markSkillsLoaded()` when done.
   */
  async start(): Promise<void> {
    // Phase 1: Check dependencies
    this.updatePhase('checking-dependencies');

    try {
      const deps = await this.dependencyChecker.checkAll();
      this.status.dependencies = deps;
    } catch (err) {
      this.status.error = err instanceof Error ? err.message : String(err);
    }

    // Phase 2: Signal connector loading
    this.updatePhase('loading-connectors');

    // Phase 3: Signal skill loading
    // (Callers will call markConnectorsLoaded / markSkillsLoaded)
  }

  /**
   * Mark that connectors have finished loading.
   */
  markConnectorsLoaded(): void {
    this.status.connectorsLoaded = true;
    if (this.status.skillsLoaded) {
      this.updatePhase('complete');
    } else {
      this.updatePhase('loading-skills');
    }
  }

  /**
   * Mark that skills have finished loading.
   */
  markSkillsLoaded(): void {
    this.status.skillsLoaded = true;
    if (this.status.connectorsLoaded) {
      this.updatePhase('complete');
    }
    this.emit();
  }

  /**
   * Get the current setup status.
   */
  getStatus(): SetupStatus {
    return { ...this.status };
  }

  /**
   * Register a callback for progress updates.
   */
  onProgress(callback: SetupProgressCallback): void {
    this.listeners.push(callback);
  }

  /**
   * Remove a progress callback.
   */
  offProgress(callback: SetupProgressCallback): void {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  private updatePhase(phase: SetupStatus['phase']): void {
    this.status.phase = phase;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener errors should not break the setup flow
      }
    }
  }
}
