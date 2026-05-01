/**
 * FTUE state synchronization tests.
 *
 * Verifies that completing/uncompleting steps via different entry points
 * (walkthrough commands, dashboard toggle, direct API) keeps all three
 * surfaces in sync: config (source of truth), sidebar progress, and
 * dashboard panel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import {
  registerFtueCommands,
  completeFtueStep,
  uncompleteFtueStep,
  initFtueProgress,
  FTUE_STEPS,
} from '../../src/commands/ftue';

const { _createMockContext } = vscode as any;

/**
 * Creates mock deps with a realistic config store that tracks mutations.
 */
function createStatefulDeps() {
  // In-memory config store — mutations are visible to subsequent reads
  let configState = {
    ftue: {
      completed: false,
      completedSteps: [] as string[],
      phase: 'companion' as string,
    },
  };

  return {
    configManager: {
      getConfig: vi.fn(async () => ({
        ftue: { ...configState.ftue, completedSteps: [...configState.ftue.completedSteps] },
      })),
      updateConfig: vi.fn(async (partial: any) => {
        if (partial.ftue) {
          configState.ftue = { ...configState.ftue, ...partial.ftue };
        }
      }),
    },
    sidebarProvider: {
      updateFtueProgress: vi.fn(),
    },
    panelManager: {
      has: vi.fn(() => false),
      closePanel: vi.fn(),
    },
    providerAdapter: {
      injectPrompt: vi.fn(async () => {}),
    },
    // Expose for assertions
    _getConfigState: () => configState,
  } as any;
  return deps;
}

describe('FTUE state synchronization', () => {
  let context: any;
  let deps: any;
  let commands: Map<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.clearAllMocks();
    context = _createMockContext();
    deps = createStatefulDeps();
    commands = new Map();

    vi.mocked(vscode.commands.registerCommand).mockImplementation(
      (id: string, cb: (...args: any[]) => any) => {
        commands.set(id, cb);
        return { dispose: () => {} };
      }
    );
    // executeCommand should delegate to registered commands
    vi.mocked(vscode.commands.executeCommand).mockImplementation(
      async (id: string, ...args: any[]) => {
        const handler = commands.get(id);
        if (handler) { return handler(...args); }
      }
    );

    registerFtueCommands(context, deps);
  });

  describe('single step completion via walkthrough command', () => {
    it('pmcode.openRooSidebar marks meetAI in config', async () => {
      await commands.get('pmcode.openRooSidebar')!();

      const state = deps._getConfigState();
      expect(state.ftue.completedSteps).toContain('meetAI');
    });

    it('pmcode.openRooSidebar updates sidebar progress to 1/4', async () => {
      await commands.get('pmcode.openRooSidebar')!();

      expect(deps.sidebarProvider.updateFtueProgress).toHaveBeenCalledWith(1, 4);
    });

    it('pmcode.connectorConfigured marks connectTool in config', async () => {
      await commands.get('pmcode.connectorConfigured')!();

      const state = deps._getConfigState();
      expect(state.ftue.completedSteps).toContain('connectTool');
    });

    it('pmcode.firstPromptSent marks firstPrompt in config', async () => {
      await commands.get('pmcode.firstPromptSent')!();

      const state = deps._getConfigState();
      expect(state.ftue.completedSteps).toContain('firstPrompt');
    });

    it('pmcode.ftue.completeExplore marks explore in config', async () => {
      await commands.get('pmcode.ftue.completeExplore')!();

      const state = deps._getConfigState();
      expect(state.ftue.completedSteps).toContain('explore');
    });
  });

  describe('idempotency — completing same step twice is safe', () => {
    it('second call is a no-op', async () => {
      await commands.get('pmcode.connectorConfigured')!();
      deps.configManager.updateConfig.mockClear();
      deps.sidebarProvider.updateFtueProgress.mockClear();

      await commands.get('pmcode.connectorConfigured')!();

      // Should not have written config or updated sidebar again
      expect(deps.configManager.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('completing all 4 steps', () => {
    it('marks ftue.completed=true and phase=command-center', async () => {
      await commands.get('pmcode.openRooSidebar')!();
      await commands.get('pmcode.connectorConfigured')!();
      await commands.get('pmcode.firstPromptSent')!();
      await commands.get('pmcode.ftue.completeExplore')!();

      const state = deps._getConfigState();
      expect(state.ftue.completed).toBe(true);
      expect(state.ftue.phase).toBe('command-center');
      expect(state.ftue.completedSteps).toHaveLength(4);
    });

    it('sidebar shows 4/4 after all steps', async () => {
      await commands.get('pmcode.openRooSidebar')!();
      await commands.get('pmcode.connectorConfigured')!();
      await commands.get('pmcode.firstPromptSent')!();
      await commands.get('pmcode.ftue.completeExplore')!();

      // Last call should be 4/4
      const calls = deps.sidebarProvider.updateFtueProgress.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toEqual([4, 4]);
    });
  });

  describe('toggle from dashboard', () => {
    it('toggle completes an uncompleted step', async () => {
      await commands.get('pmcode.ftue.toggle')!('meetAI');

      const state = deps._getConfigState();
      expect(state.ftue.completedSteps).toContain('meetAI');
    });

    it('toggle uncompletes a completed step', async () => {
      await commands.get('pmcode.openRooSidebar')!(); // complete meetAI
      expect(deps._getConfigState().ftue.completedSteps).toContain('meetAI');

      await commands.get('pmcode.ftue.toggle')!('meetAI'); // uncomplete it

      const state = deps._getConfigState();
      expect(state.ftue.completedSteps).not.toContain('meetAI');
      expect(state.ftue.completed).toBe(false);
      expect(state.ftue.phase).toBe('companion');
    });

    it('toggle updates sidebar each time', async () => {
      deps.sidebarProvider.updateFtueProgress.mockClear();

      await commands.get('pmcode.ftue.toggle')!('meetAI'); // complete
      expect(deps.sidebarProvider.updateFtueProgress).toHaveBeenCalledWith(1, 4);

      deps.sidebarProvider.updateFtueProgress.mockClear();
      await commands.get('pmcode.ftue.toggle')!('meetAI'); // uncomplete
      expect(deps.sidebarProvider.updateFtueProgress).toHaveBeenCalledWith(0, 4);
    });

    it('toggle refreshes dashboard when open', async () => {
      deps.panelManager.has.mockReturnValue(true);

      await commands.get('pmcode.ftue.toggle')!('connectTool');

      expect(deps.panelManager.closePanel).toHaveBeenCalledWith('companion', 'dashboard');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.openDashboard');
    });

    it('toggle does not touch dashboard when closed', async () => {
      deps.panelManager.has.mockReturnValue(false);

      await commands.get('pmcode.ftue.toggle')!('connectTool');

      expect(deps.panelManager.closePanel).not.toHaveBeenCalled();
    });

    it('toggle sets context key when completing', async () => {
      await commands.get('pmcode.ftue.toggle')!('connectTool');

      // Should set context key for walkthrough sync
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'pmcode.ftue.connectTool', true);
    });

    it('toggle clears context key when uncompleting', async () => {
      await commands.get('pmcode.connectorConfigured')!(); // complete first
      vi.mocked(vscode.commands.executeCommand).mockClear();

      await commands.get('pmcode.ftue.toggle')!('connectTool'); // uncomplete

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'pmcode.ftue.connectTool', false);
    });

    it('toggle with invalid stepId is a no-op', async () => {
      await commands.get('pmcode.ftue.toggle')!('bogusStep');

      expect(deps.configManager.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('multi-step scenario — interleaved completions and toggles', () => {
    it('complete 2 steps, toggle one off, complete another', async () => {
      // Complete meetAI and connectTool via walkthrough commands
      await commands.get('pmcode.openRooSidebar')!();
      await commands.get('pmcode.connectorConfigured')!();

      let state = deps._getConfigState();
      expect(state.ftue.completedSteps).toEqual(
        expect.arrayContaining(['meetAI', 'connectTool'])
      );
      expect(state.ftue.completedSteps).toHaveLength(2);

      // Toggle connectTool off via dashboard
      await commands.get('pmcode.ftue.toggle')!('connectTool');
      state = deps._getConfigState();
      expect(state.ftue.completedSteps).not.toContain('connectTool');
      expect(state.ftue.completedSteps).toContain('meetAI');
      expect(state.ftue.completedSteps).toHaveLength(1);
      expect(state.ftue.completed).toBe(false);

      // Complete firstPrompt via walkthrough
      await commands.get('pmcode.firstPromptSent')!();
      state = deps._getConfigState();
      expect(state.ftue.completedSteps).toHaveLength(2);
      expect(state.ftue.completedSteps).toEqual(
        expect.arrayContaining(['meetAI', 'firstPrompt'])
      );

      // Sidebar should reflect 2/4
      const calls = deps.sidebarProvider.updateFtueProgress.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toEqual([2, 4]);
    });

    it('complete all, uncomplete one, re-complete it', async () => {
      // Complete all 4
      await commands.get('pmcode.openRooSidebar')!();
      await commands.get('pmcode.connectorConfigured')!();
      await commands.get('pmcode.firstPromptSent')!();
      await commands.get('pmcode.ftue.completeExplore')!();

      let state = deps._getConfigState();
      expect(state.ftue.completed).toBe(true);
      expect(state.ftue.phase).toBe('command-center');

      // Uncomplete one
      await commands.get('pmcode.ftue.toggle')!('firstPrompt');
      state = deps._getConfigState();
      expect(state.ftue.completed).toBe(false);
      expect(state.ftue.phase).toBe('companion');
      expect(state.ftue.completedSteps).toHaveLength(3);

      // Re-complete it
      await commands.get('pmcode.ftue.toggle')!('firstPrompt');
      state = deps._getConfigState();
      expect(state.ftue.completed).toBe(true);
      expect(state.ftue.phase).toBe('command-center');
      expect(state.ftue.completedSteps).toHaveLength(4);
    });
  });

  describe('initFtueProgress — startup sync', () => {
    it('sends persisted progress to sidebar', async () => {
      // Pre-populate some completed steps
      await commands.get('pmcode.openRooSidebar')!();
      await commands.get('pmcode.connectorConfigured')!();
      deps.sidebarProvider.updateFtueProgress.mockClear();

      await initFtueProgress(deps);

      expect(deps.sidebarProvider.updateFtueProgress).toHaveBeenCalledWith(2, 4);
    });

    it('sets context keys for persisted steps', async () => {
      await commands.get('pmcode.openRooSidebar')!();
      vi.mocked(vscode.commands.executeCommand).mockClear();

      await initFtueProgress(deps);

      // Should set context key for meetAI=true, others=false
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'pmcode.ftue.meetAI', true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'pmcode.ftue.connectTool', false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'pmcode.ftue.firstPrompt', false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'pmcode.ftue.explore', false);
    });

    it('sends 0/4 when no steps completed', async () => {
      await initFtueProgress(deps);

      expect(deps.sidebarProvider.updateFtueProgress).toHaveBeenCalledWith(0, 4);
    });
  });

  describe('no infinite recursion', () => {
    it('completeFtueStep uses setContext not commands — no recursion possible', async () => {
      const executeSpy = vi.mocked(vscode.commands.executeCommand);
      executeSpy.mockClear();

      await commands.get('pmcode.connectorConfigured')!();

      // Should only see setContext calls, not re-firing of pmcode.connectorConfigured
      const connectorCalls = executeSpy.mock.calls.filter(
        (c) => c[0] === 'pmcode.connectorConfigured'
      );
      expect(connectorCalls.length).toBe(0);

      // But should have setContext calls
      const contextCalls = executeSpy.mock.calls.filter(
        (c) => c[0] === 'setContext'
      );
      expect(contextCalls.length).toBeGreaterThan(0);
    });

    it('completing same step twice only writes config once', async () => {
      await completeFtueStep('connectTool', deps);
      expect(deps.configManager.updateConfig).toHaveBeenCalledTimes(1);

      deps.configManager.updateConfig.mockClear();
      await completeFtueStep('connectTool', deps);

      expect(deps.configManager.updateConfig).not.toHaveBeenCalled();
    });
  });
});
