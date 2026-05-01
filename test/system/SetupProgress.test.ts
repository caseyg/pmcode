import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process for the DependencyChecker used internally
vi.mock('child_process', () => ({
  exec: vi.fn((_cmd: any, _opts: any, cb: any) => {
    cb(null, { stdout: 'v1.0.0', stderr: '' });
    return undefined as any;
  }),
}));
vi.mock('util', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    promisify: (fn: any) => {
      return async (...args: any[]) => {
        return new Promise((resolve, reject) => {
          fn(...args, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      };
    },
  };
});

import { SetupProgress, type SetupStatus } from '../../src/system/SetupProgress';

describe('SetupProgress', () => {
  let setup: SetupProgress;

  beforeEach(() => {
    vi.clearAllMocks();
    setup = new SetupProgress();
  });

  it('getStatus() returns current state', () => {
    const status = setup.getStatus();
    expect(status.phase).toBe('idle');
    expect(status.dependencies).toEqual([]);
    expect(status.connectorsLoaded).toBe(false);
    expect(status.skillsLoaded).toBe(false);
  });

  it('start() begins tracking and runs dependency checks', async () => {
    const phases: string[] = [];
    setup.onProgress((s) => phases.push(s.phase));

    await setup.start();

    expect(phases).toContain('checking-dependencies');
    expect(phases).toContain('loading-connectors');
    const status = setup.getStatus();
    expect(status.dependencies.length).toBeGreaterThan(0);
  });

  it('onProgress() callback fires on updates', async () => {
    const callback = vi.fn();
    setup.onProgress(callback);

    await setup.start();

    expect(callback).toHaveBeenCalled();
    // Should have been called at least for checking-dependencies and loading-connectors
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('tracks phases: dependencies, connectors, skills', async () => {
    const phases: string[] = [];
    setup.onProgress((s: SetupStatus) => phases.push(s.phase));

    await setup.start();
    setup.markConnectorsLoaded();
    setup.markSkillsLoaded();

    expect(phases).toContain('checking-dependencies');
    expect(phases).toContain('loading-connectors');
    expect(phases).toContain('complete');
  });

  it('completes when both connectors and skills are loaded', async () => {
    await setup.start();

    setup.markConnectorsLoaded();
    expect(setup.getStatus().phase).not.toBe('complete');

    setup.markSkillsLoaded();
    expect(setup.getStatus().phase).toBe('complete');
  });

  it('completes when skills load before connectors', async () => {
    await setup.start();

    setup.markSkillsLoaded();
    setup.markConnectorsLoaded();

    expect(setup.getStatus().phase).toBe('complete');
  });
});
