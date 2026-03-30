import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

// Mock all dependencies that activate() creates internally
vi.mock('../src/config/ConfigManager', () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    ensureDirectoryStructure: vi.fn(async () => {}),
    getConfig: vi.fn(async () => ({
      ftue: { completed: true, completedSteps: [] },
    })),
  })),
}));

vi.mock('../src/config/EnvManager', () => ({
  EnvManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../src/config/ConfigVersioning', () => ({
  ConfigVersioning: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../src/providers/RooCodeAdapter', () => ({
  RooCodeAdapter: vi.fn().mockImplementation(() => ({
    injectPrompt: vi.fn(async () => {}),
    detect: vi.fn(async () => true),
  })),
}));

vi.mock('../src/connectors/ConnectorManager', () => ({
  ConnectorManager: vi.fn().mockImplementation(() => ({
    getConnectors: vi.fn(async () => []),
    getConnector: vi.fn(async () => undefined),
  })),
}));

vi.mock('../src/skills/SkillManager', () => ({
  SkillManager: vi.fn().mockImplementation(() => ({
    getInstalledSkills: vi.fn(async () => []),
    getSkill: vi.fn(async () => undefined),
  })),
}));

vi.mock('../src/guides/GuideEngine', () => ({
  GuideEngine: vi.fn().mockImplementation(() => ({
    getGuides: vi.fn(() => []),
    getGuide: vi.fn(() => undefined),
    getProgress: vi.fn(async () => ({ guideId: '', completedSteps: [], currentStep: 0 })),
    completeStep: vi.fn(async () => {}),
    resetProgress: vi.fn(async () => {}),
  })),
}));

vi.mock('../src/commands/core', () => ({
  registerCoreCommands: vi.fn(),
}));

vi.mock('../src/commands/navigation', () => ({
  registerNavigationCommands: vi.fn(),
}));

vi.mock('../src/commands/connectors', () => ({
  registerConnectorCommands: vi.fn(),
}));

vi.mock('../src/commands/skills', () => ({
  registerSkillCommands: vi.fn(),
}));

vi.mock('../src/commands/guides', () => ({
  registerGuideCommands: vi.fn(),
}));

vi.mock('../src/commands/system', () => ({
  registerSystemCommands: vi.fn(),
}));

const { _createMockContext } = vscode as any;

describe('extension', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = _createMockContext();
  });

  it('activate() registers sidebar provider', async () => {
    const { activate } = await import('../src/extension');
    await activate(context);

    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'pmcode.sidebar',
      expect.any(Object)
    );
  });

  it('activate() registers all commands', async () => {
    // Re-import to get fresh module
    vi.resetModules();

    // Re-apply mocks after resetModules
    vi.doMock('../src/config/ConfigManager', () => ({
      ConfigManager: vi.fn().mockImplementation(() => ({
        ensureDirectoryStructure: vi.fn(async () => {}),
        getConfig: vi.fn(async () => ({
          ftue: { completed: true, completedSteps: [] },
        })),
      })),
    }));
    vi.doMock('../src/config/EnvManager', () => ({ EnvManager: vi.fn().mockImplementation(() => ({})) }));
    vi.doMock('../src/config/ConfigVersioning', () => ({ ConfigVersioning: vi.fn().mockImplementation(() => ({})) }));
    vi.doMock('../src/providers/RooCodeAdapter', () => ({
      RooCodeAdapter: vi.fn().mockImplementation(() => ({
        injectPrompt: vi.fn(async () => {}),
        detect: vi.fn(async () => true),
      })),
    }));
    vi.doMock('../src/connectors/ConnectorManager', () => ({
      ConnectorManager: vi.fn().mockImplementation(() => ({
        getConnectors: vi.fn(async () => []),
        getConnector: vi.fn(async () => undefined),
      })),
    }));
    vi.doMock('../src/skills/SkillManager', () => ({
      SkillManager: vi.fn().mockImplementation(() => ({
        getInstalledSkills: vi.fn(async () => []),
        getSkill: vi.fn(async () => undefined),
      })),
    }));
    vi.doMock('../src/guides/GuideEngine', () => ({
      GuideEngine: vi.fn().mockImplementation(() => ({
        getGuides: vi.fn(() => []),
        getGuide: vi.fn(() => undefined),
        getProgress: vi.fn(async () => ({ guideId: '', completedSteps: [], currentStep: 0 })),
        completeStep: vi.fn(async () => {}),
        resetProgress: vi.fn(async () => {}),
      })),
    }));

    const coreModule = { registerCoreCommands: vi.fn() };
    const navModule = { registerNavigationCommands: vi.fn() };
    const connModule = { registerConnectorCommands: vi.fn() };
    const skillModule = { registerSkillCommands: vi.fn() };
    const guideModule = { registerGuideCommands: vi.fn() };
    const sysModule = { registerSystemCommands: vi.fn() };

    vi.doMock('../src/commands/core', () => coreModule);
    vi.doMock('../src/commands/navigation', () => navModule);
    vi.doMock('../src/commands/connectors', () => connModule);
    vi.doMock('../src/commands/skills', () => skillModule);
    vi.doMock('../src/commands/guides', () => guideModule);
    vi.doMock('../src/commands/system', () => sysModule);

    const { activate: activate2 } = await import('../src/extension');
    const ctx2 = _createMockContext();
    await activate2(ctx2);

    expect(coreModule.registerCoreCommands).toHaveBeenCalledOnce();
    expect(navModule.registerNavigationCommands).toHaveBeenCalledOnce();
    expect(connModule.registerConnectorCommands).toHaveBeenCalledOnce();
    expect(skillModule.registerSkillCommands).toHaveBeenCalledOnce();
    expect(guideModule.registerGuideCommands).toHaveBeenCalledOnce();
    expect(sysModule.registerSystemCommands).toHaveBeenCalledOnce();
  });

  it('deactivate() does not throw', async () => {
    const { deactivate } = await import('../src/extension');
    expect(() => deactivate()).not.toThrow();
  });
});
