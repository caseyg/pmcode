import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));
vi.mock('util', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    promisify: (fn: any) => {
      // Return a function that calls the mock exec and wraps in promise
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

import { exec } from 'child_process';
import { DependencyChecker } from '../../src/system/DependencyChecker';

const mockExec = vi.mocked(exec);

describe('DependencyChecker', () => {
  let checker: DependencyChecker;

  beforeEach(() => {
    vi.clearAllMocks();
    checker = new DependencyChecker();
  });

  function mockExecSuccess(stdout: string) {
    mockExec.mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, { stdout, stderr: '' });
      return undefined as any;
    });
  }

  function mockExecFailure(message = 'command not found') {
    mockExec.mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(new Error(message), { stdout: '', stderr: '' });
      return undefined as any;
    });
  }

  describe('checkAll()', () => {
    it('returns status for all dependencies', async () => {
      mockExecSuccess('v20.0.0');
      const results = await checker.checkAll();

      // Should have 4 dependencies: xcode-cli, node, python, gh
      expect(results).toHaveLength(4);
      expect(results.map((r) => r.id)).toEqual([
        'xcode-cli',
        'node',
        'python',
        'gh',
      ]);
    });
  });

  describe('check()', () => {
    it('detects installed dependency with version', async () => {
      mockExec.mockImplementation((_cmd: any, _opts: any, cb: any) => {
        cb(null, { stdout: 'v20.11.0', stderr: '' });
        return undefined as any;
      });

      const result = await checker.check('node');
      expect(result.installed).toBe(true);
      expect(result.version).toBe('20.11.0');
    });

    it('reports missing dependency with install command', async () => {
      mockExecFailure();

      const result = await checker.check('gh');
      expect(result.installed).toBe(false);
      expect(result.installCommand).toBe('brew install gh');
    });

    it('returns human-friendly labels (not technical names)', async () => {
      mockExecSuccess('v20.0.0');
      const result = await checker.check('node');
      expect(result.label).toBe('Node.js ready');
      expect(result.techLabel).toBe('node installed');
    });

    it('handles command execution errors gracefully', async () => {
      mockExecFailure('Permission denied');

      const result = await checker.check('python');
      expect(result.installed).toBe(false);
      expect(result.id).toBe('python');
    });

    it('returns basic status for unknown dependency id', async () => {
      const result = await checker.check('unknown-dep');
      expect(result.installed).toBe(false);
      expect(result.id).toBe('unknown-dep');
    });
  });
});
