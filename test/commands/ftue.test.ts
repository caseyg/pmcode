import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerFtueCommands, completeFtueStep, FTUE_STEPS, initFtueProgress } from '../../src/commands/ftue';

const { _createMockContext } = vscode as any;

function createMockDeps() {
  return {
    configManager: {
      getConfig: vi.fn(async () => ({
        ftue: {
          completed: false,
          completedSteps: [],
          phase: 'companion',
        },
      })),
      updateConfig: vi.fn(async () => {}),
    },
    sidebarProvider: {
      updateFtueProgress: vi.fn(),
    },
    providerAdapter: {
      injectPrompt: vi.fn(async () => {}),
    },
  } as any;
}

describe('FTUE commands', () => {
  let context: any;
  let deps: any;
  let commands: Map<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.clearAllMocks();
    context = _createMockContext();
    deps = createMockDeps();
    commands = new Map();

    vi.mocked(vscode.commands.registerCommand).mockImplementation(
      (id: string, cb: (...args: any[]) => any) => {
        commands.set(id, cb);
        return { dispose: () => {} };
      }
    );

    registerFtueCommands(context, deps);
  });

  it('registers all FTUE commands', () => {
    expect(commands.has('pmcode.openRooSidebar')).toBe(true);
    expect(commands.has('pmcode.connectorConfigured')).toBe(true);
    expect(commands.has('pmcode.firstPrompt')).toBe(true);
    expect(commands.has('pmcode.firstPromptSent')).toBe(true);
    expect(commands.has('pmcode.ftue.completeExplore')).toBe(true);
  });

  describe('completeFtueStep', () => {
    it('adds step to completedSteps and updates config', async () => {
      await completeFtueStep('meetAI', deps);

      expect(deps.configManager.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          ftue: expect.objectContaining({
            completedSteps: ['meetAI'],
            completed: false,
          }),
        })
      );
    });

    it('updates sidebar progress', async () => {
      await completeFtueStep('meetAI', deps);

      expect(deps.sidebarProvider.updateFtueProgress).toHaveBeenCalledWith(1, 4);
    });

    it('skips if step already completed', async () => {
      deps.configManager.getConfig.mockResolvedValue({
        ftue: { completed: false, completedSteps: ['meetAI'], phase: 'companion' },
      });

      await completeFtueStep('meetAI', deps);

      expect(deps.configManager.updateConfig).not.toHaveBeenCalled();
    });

    it('marks FTUE complete when all 4 steps done', async () => {
      deps.configManager.getConfig.mockResolvedValue({
        ftue: {
          completed: false,
          completedSteps: ['meetAI', 'connectTool', 'firstPrompt'],
          phase: 'companion',
        },
      });

      await completeFtueStep('explore', deps);

      expect(deps.configManager.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          ftue: expect.objectContaining({
            completed: true,
            phase: 'command-center',
          }),
        })
      );
    });
  });

  describe('openRooSidebar', () => {
    it('tries to focus roo sidebar and marks meetAI complete', async () => {
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
      await commands.get('pmcode.openRooSidebar')!();

      expect(deps.configManager.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          ftue: expect.objectContaining({
            completedSteps: expect.arrayContaining(['meetAI']),
          }),
        })
      );
    });
  });

  describe('connectorConfigured', () => {
    it('marks connectTool step complete', async () => {
      await commands.get('pmcode.connectorConfigured')!();

      expect(deps.configManager.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          ftue: expect.objectContaining({
            completedSteps: expect.arrayContaining(['connectTool']),
          }),
        })
      );
    });
  });

  describe('firstPromptSent', () => {
    it('marks firstPrompt step complete', async () => {
      await commands.get('pmcode.firstPromptSent')!();

      expect(deps.configManager.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          ftue: expect.objectContaining({
            completedSteps: expect.arrayContaining(['firstPrompt']),
          }),
        })
      );
    });
  });

  describe('ftue.completeExplore', () => {
    it('marks explore step complete', async () => {
      await commands.get('pmcode.ftue.completeExplore')!();

      expect(deps.configManager.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          ftue: expect.objectContaining({
            completedSteps: expect.arrayContaining(['explore']),
          }),
        })
      );
    });
  });

  describe('initFtueProgress', () => {
    it('sends current progress to sidebar', async () => {
      deps.configManager.getConfig.mockResolvedValue({
        ftue: { completed: false, completedSteps: ['meetAI', 'connectTool'], phase: 'companion' },
      });

      await initFtueProgress(deps);

      expect(deps.sidebarProvider.updateFtueProgress).toHaveBeenCalledWith(2, 4);
    });

    it('sends 0 progress when no steps completed', async () => {
      await initFtueProgress(deps);

      expect(deps.sidebarProvider.updateFtueProgress).toHaveBeenCalledWith(0, 4);
    });
  });

  describe('FTUE_STEPS', () => {
    it('has exactly 4 steps', () => {
      expect(FTUE_STEPS).toHaveLength(4);
    });

    it('contains the expected step IDs', () => {
      expect(FTUE_STEPS).toContain('meetAI');
      expect(FTUE_STEPS).toContain('connectTool');
      expect(FTUE_STEPS).toContain('firstPrompt');
      expect(FTUE_STEPS).toContain('explore');
    });
  });
});
