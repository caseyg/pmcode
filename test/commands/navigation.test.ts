import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerNavigationCommands } from '../../src/commands/navigation';

const { _createMockContext } = vscode as any;

function createMockDeps() {
  return {
    skillManager: {
      getInstalledSkills: vi.fn(async () => [
        { id: 'idea-triage', name: 'Idea Triage', description: 'Triage ideas', metadata: { category: 'planning', connectors: ['jira'] }, source: 'bundled', instructions: '', path: '' },
        { id: 'prd-writer', name: 'PRD Writer', description: 'Write PRDs', metadata: { category: 'planning', connectors: [] }, source: 'bundled', instructions: '', path: '' },
      ]),
      getSkill: vi.fn(async (id: string) => {
        const skills: Record<string, any> = {
          'idea-triage': { id: 'idea-triage', name: 'Idea Triage', description: 'Triage', instructions: 'Steps', source: 'bundled', path: '', metadata: { category: 'planning', connectors: ['jira'] } },
        };
        return skills[id] || null;
      }),
    },
    connectorManager: {
      getConnectors: vi.fn(async () => [
        { id: 'jira', name: 'Jira', description: 'Jira connector', status: 'connected', icon: 'J', type: 'rest-api', fields: [], examplePrompts: [], relatedSkills: [], relatedGuides: [] },
      ]),
      getConnector: vi.fn(async (id: string) => {
        if (id === 'jira') {
          return { id: 'jira', name: 'Jira', description: 'Jira', status: 'connected', icon: 'J', type: 'rest-api', fields: [], examplePrompts: [], relatedSkills: [], relatedGuides: [] };
        }
        return null;
      }),
      getStatus: vi.fn(async () => 'connected' as const),
      getFieldValues: vi.fn(async () => ({})),
    },
    guideEngine: {
      getGuides: vi.fn(() => [
        { id: 'getting-started', title: 'Getting Started', description: 'Get started', type: 'walkthrough', estimatedMinutes: 10, steps: [{ title: 'Step 1', content: 'Do this' }], relatedConnectors: [], relatedSkills: [] },
      ]),
      getGuide: vi.fn((id: string) => {
        if (id === 'getting-started') {
          return { id: 'getting-started', title: 'Getting Started', description: 'Get started', type: 'walkthrough', estimatedMinutes: 10, steps: [{ title: 'Step 1', content: 'Do this' }], relatedConnectors: [], relatedSkills: [] };
        }
        return null;
      }),
      getProgress: vi.fn(async () => ({ guideId: 'getting-started', completedSteps: [], currentStep: 0 })),
    },
    panelManager: {
      openPanel: vi.fn((_type: string, _id: string, _title: string, getHtml: any) => {
        const html = typeof getHtml === 'function' ? getHtml({
          asWebviewUri: (u: any) => u,
          cspSource: 'mock',
        }) : '';
        return {
          webview: {
            html,
            onDidReceiveMessage: vi.fn(() => ({ dispose: () => {} })),
          },
        };
      }),
    },
  } as any;
}

describe('navigation commands', () => {
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

    registerNavigationCommands(context, deps);
  });

  it('registers all navigation commands', () => {
    expect(commands.has('pmcode.openSkills')).toBe(true);
    expect(commands.has('pmcode.openConnectors')).toBe(true);
    expect(commands.has('pmcode.openGuides')).toBe(true);
    expect(commands.has('pmcode.openSkill')).toBe(true);
    expect(commands.has('pmcode.openConnector')).toBe(true);
    expect(commands.has('pmcode.openGuide')).toBe(true);
  });

  describe('openSkills', () => {
    it('opens skills list panel via SkillsListPanel', async () => {
      await commands.get('pmcode.openSkills')!();
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'skills-list', 'list', 'Skills', expect.any(Function)
      );
    });
  });

  describe('openConnectors', () => {
    it('opens connectors list panel via ConnectorsListPanel', async () => {
      await commands.get('pmcode.openConnectors')!();
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'connectors-list', 'list', 'Connectors', expect.any(Function)
      );
    });
  });

  describe('openGuides', () => {
    it('opens guides list panel via GuidesListPanel', async () => {
      await commands.get('pmcode.openGuides')!();
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'guides-list', 'list', 'Guides', expect.any(Function)
      );
    });

    it('gathers progress for each guide', async () => {
      await commands.get('pmcode.openGuides')!();
      expect(deps.guideEngine.getProgress).toHaveBeenCalledWith('getting-started');
    });
  });

  describe('openSkill', () => {
    it('opens skill detail with connector statuses', async () => {
      await commands.get('pmcode.openSkill')!('idea-triage');
      expect(deps.skillManager.getSkill).toHaveBeenCalledWith('idea-triage');
      expect(deps.connectorManager.getStatus).toHaveBeenCalledWith('jira');
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'skill-detail', 'idea-triage', 'Idea Triage', expect.any(Function)
      );
    });

    it('shows QuickPick when no ID provided', async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ label: 'Idea Triage', description: 'idea-triage', id: 'idea-triage' } as any);
      await commands.get('pmcode.openSkill')!();

      expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ label: 'Idea Triage' })]),
        expect.objectContaining({ placeHolder: 'Select a skill' })
      );
    });

    it('returns early when QuickPick cancelled', async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);
      await commands.get('pmcode.openSkill')!();
      expect(deps.panelManager.openPanel).not.toHaveBeenCalled();
    });

    it('shows warning for nonexistent skill', async () => {
      await commands.get('pmcode.openSkill')!('nonexistent');
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });
  });

  describe('openConnector', () => {
    it('opens connector detail with current values', async () => {
      await commands.get('pmcode.openConnector')!('jira');
      expect(deps.connectorManager.getConnector).toHaveBeenCalledWith('jira');
      expect(deps.connectorManager.getFieldValues).toHaveBeenCalledWith('jira');
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'connector-detail', 'jira', 'Jira', expect.any(Function)
      );
    });

    it('shows QuickPick when no ID provided', async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ label: 'Jira', description: 'connected', id: 'jira' } as any);
      await commands.get('pmcode.openConnector')!();
      expect(vscode.window.showQuickPick).toHaveBeenCalled();
    });

    it('shows warning for nonexistent connector', async () => {
      await commands.get('pmcode.openConnector')!('nonexistent');
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });
  });

  describe('openGuide', () => {
    it('opens guide detail with progress', async () => {
      await commands.get('pmcode.openGuide')!('getting-started');
      expect(deps.guideEngine.getGuide).toHaveBeenCalledWith('getting-started');
      expect(deps.guideEngine.getProgress).toHaveBeenCalledWith('getting-started');
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'guide-detail', 'getting-started', 'Getting Started', expect.any(Function)
      );
    });

    it('shows QuickPick when no ID provided', async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ label: 'Getting Started', id: 'getting-started' } as any);
      await commands.get('pmcode.openGuide')!();
      expect(vscode.window.showQuickPick).toHaveBeenCalled();
    });

    it('shows warning for nonexistent guide', async () => {
      await commands.get('pmcode.openGuide')!('nonexistent');
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });
  });
});
