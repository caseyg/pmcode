import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerNavigationCommands } from '../../src/commands/navigation';

const { _createMockContext } = vscode as any;

function createMockDeps() {
  return {
    skillManager: {
      getInstalledSkills: vi.fn(async () => [
        { id: 'idea-triage', name: 'Idea Triage', description: 'Triage ideas' },
        { id: 'prd-writer', name: 'PRD Writer', description: 'Write PRDs' },
      ]),
      getSkill: vi.fn(async (id: string) => {
        const skills: Record<string, any> = {
          'idea-triage': { id: 'idea-triage', name: 'Idea Triage', description: 'Triage', instructions: 'Steps' },
        };
        return skills[id] || null;
      }),
    },
    connectorManager: {
      getConnectors: vi.fn(async () => [
        { id: 'jira', name: 'Jira', description: 'Jira connector', status: 'connected' },
        { id: 'github', name: 'GitHub', description: 'GitHub connector', status: 'unconfigured' },
      ]),
      getConnector: vi.fn(async (id: string) => {
        const connectors: Record<string, any> = {
          jira: { id: 'jira', name: 'Jira', description: 'Jira', status: 'connected', examplePrompts: [] },
        };
        return connectors[id] || null;
      }),
    },
    guideEngine: {
      getGuides: vi.fn(() => [
        { id: 'getting-started', title: 'Getting Started', description: 'Get started', type: 'walkthrough', estimatedMinutes: 10, steps: [] },
      ]),
      getGuide: vi.fn((id: string) => {
        if (id === 'getting-started') {
          return { id: 'getting-started', title: 'Getting Started', description: 'Get started', type: 'walkthrough', estimatedMinutes: 10, steps: [{ title: 'Step 1', content: 'Do this' }] };
        }
        return null;
      }),
    },
    panelManager: {
      openPanel: vi.fn((_type: string, _id: string, _title: string, getHtml: any) => {
        const html = typeof getHtml === 'function' ? getHtml({
          asWebviewUri: (u: any) => u,
          cspSource: 'mock',
        }) : '';
        const messageHandlers: Array<(msg: any) => void> = [];
        return {
          webview: {
            html,
            onDidReceiveMessage: vi.fn((cb: (msg: any) => void) => {
              messageHandlers.push(cb);
              return { dispose: () => {} };
            }),
          },
          _simulateMessage: (msg: any) => messageHandlers.forEach(h => h(msg)),
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
    it('opens skills list panel', async () => {
      await commands.get('pmcode.openSkills')!();
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'skills-list', 'list', 'Skills', expect.any(Function)
      );
    });

    it('list panel HTML contains skill names', async () => {
      await commands.get('pmcode.openSkills')!();
      const html = deps.panelManager.openPanel.mock.results[0].value.webview.html;
      expect(html).toContain('Idea Triage');
      expect(html).toContain('PRD Writer');
    });

    it('list panel wires up message handler for openItem', async () => {
      const panel = await commands.get('pmcode.openSkills')!();
      // Should have registered onDidReceiveMessage
      expect(deps.panelManager.openPanel.mock.results[0].value.webview.onDidReceiveMessage).toHaveBeenCalled();
    });
  });

  describe('openConnectors', () => {
    it('opens connectors list panel', async () => {
      await commands.get('pmcode.openConnectors')!();
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'connectors-list', 'list', 'Connectors', expect.any(Function)
      );
    });

    it('list panel HTML contains connector names', async () => {
      await commands.get('pmcode.openConnectors')!();
      const html = deps.panelManager.openPanel.mock.results[0].value.webview.html;
      expect(html).toContain('Jira');
      expect(html).toContain('GitHub');
    });
  });

  describe('openGuides', () => {
    it('opens guides list panel', async () => {
      await commands.get('pmcode.openGuides')!();
      expect(deps.panelManager.openPanel).toHaveBeenCalledWith(
        'guides-list', 'list', 'Guides', expect.any(Function)
      );
    });
  });

  describe('openSkill', () => {
    it('opens skill detail when given an ID', async () => {
      await commands.get('pmcode.openSkill')!('idea-triage');
      expect(deps.skillManager.getSkill).toHaveBeenCalledWith('idea-triage');
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
    it('opens connector detail when given an ID', async () => {
      await commands.get('pmcode.openConnector')!('jira');
      expect(deps.connectorManager.getConnector).toHaveBeenCalledWith('jira');
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
    it('opens guide detail when given an ID', async () => {
      await commands.get('pmcode.openGuide')!('getting-started');
      expect(deps.guideEngine.getGuide).toHaveBeenCalledWith('getting-started');
    });

    it('shows QuickPick when no ID provided', async () => {
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ label: 'Getting Started', id: 'getting-started' } as any);
      await commands.get('pmcode.openGuide')!();

      expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ label: 'Getting Started' })]),
        expect.objectContaining({ placeHolder: 'Select a guide' })
      );
    });

    it('shows warning for nonexistent guide', async () => {
      await commands.get('pmcode.openGuide')!('nonexistent');
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );
    });
  });
});
