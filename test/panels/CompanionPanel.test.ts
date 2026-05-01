import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompanionPanel, DashboardData } from '../../src/panels/CompanionPanel';
import { _createMockContext } from '../__mocks__/vscode';
import * as vscode from 'vscode';

vi.mock('vscode');

function mockPanelManager() {
  const panel = {
    webview: {
      html: '',
      onDidReceiveMessage: vi.fn(),
      asWebviewUri: vi.fn((uri: any) => uri),
      cspSource: 'https://mock.csp',
    },
    onDidDispose: vi.fn(),
    reveal: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    panelManager: {
      openPanel: vi.fn((_type: string, _id: string, _title: string, getHtml: (webview: any) => string) => {
        panel.webview.html = getHtml(panel.webview);
        return panel;
      }),
      closePanel: vi.fn(),
      getPanel: vi.fn(),
    },
    panel,
  };
}

function baseDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    phase: 'command-center',
    ftueCompleted: true,
    ftueCompletedSteps: ['meetAI', 'connectTool', 'firstPrompt', 'explore'],
    rooConnected: true,
    connectors: [
      {
        id: 'jira',
        name: 'Jira',
        type: 'mcp-server',
        description: 'Project tracking',
        icon: '📋',
        status: 'connected',
        fields: [],
        examplePrompts: ['Show my Jira tickets'],
        relatedSkills: [],
        relatedGuides: [],
      },
      {
        id: 'github',
        name: 'GitHub',
        type: 'cli-tool',
        description: 'Code collaboration',
        icon: '🐙',
        status: 'unconfigured',
        fields: [],
        examplePrompts: ['Show open PRs'],
        relatedSkills: [],
        relatedGuides: [],
      },
    ],
    skills: [
      {
        id: 'idea-triage',
        name: 'Idea Triage',
        description: 'Evaluate and prioritize ideas',
        metadata: { author: 'pmcode', version: '1.0', category: 'planning', connectors: ['jira'] },
        instructions: 'Triage instructions',
        source: 'bundled',
        path: '/ext/skills/idea-triage',
      },
      {
        id: 'prd-writer',
        name: 'PRD Writer',
        description: 'Draft product requirements',
        metadata: { author: 'pmcode', version: '1.0', category: 'writing', connectors: ['tavily'] },
        instructions: 'PRD instructions',
        source: 'bundled',
        path: '/ext/skills/prd-writer',
      },
    ],
    guides: [
      {
        id: 'getting-started',
        title: 'Getting Started with PM Code',
        description: 'Set up your workspace',
        type: 'walkthrough',
        estimatedMinutes: 10,
        steps: [
          { title: 'Step 1', content: 'First step' },
          { title: 'Step 2', content: 'Second step' },
        ],
        relatedConnectors: [],
        relatedSkills: [],
      },
    ],
    guideProgress: new Map([
      ['getting-started', { guideId: 'getting-started', completedSteps: [0], currentStep: 1 }],
    ]),
    recentlyUsedSkills: ['idea-triage'],
    dependencies: [
      { id: 'node', label: 'Node.js ready', techLabel: 'node installed', installed: true, version: '22.14.0' },
      { id: 'gh', label: 'GitHub CLI ready', techLabel: 'gh CLI installed', installed: false, installCommand: 'brew install gh' },
    ],
    ...overrides,
  };
}

describe('CompanionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('show()', () => {
    it('creates a webview panel via PanelManager', () => {
      const { panelManager } = mockPanelManager();
      const extensionUri = vscode.Uri.file('/ext');
      const data = baseDashboardData();

      CompanionPanel.show(extensionUri, panelManager as any, data);

      expect(panelManager.openPanel).toHaveBeenCalledWith(
        'companion',
        'dashboard',
        'PM Code',
        expect.any(Function)
      );
    });

    it('registers message handlers on the panel', () => {
      const { panelManager, panel } = mockPanelManager();
      const extensionUri = vscode.Uri.file('/ext');

      CompanionPanel.show(extensionUri, panelManager as any, baseDashboardData());

      expect(panel.webview.onDidReceiveMessage).toHaveBeenCalled();
      expect(panel.onDidDispose).toHaveBeenCalled();
    });
  });

  describe('Command Center phase (FTUE completed)', () => {
    it('renders connector health with status dots', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData());

      expect(panel.webview.html).toContain('Jira');
      expect(panel.webview.html).toContain('GitHub');
      expect(panel.webview.html).toContain('status-dot');
      expect(panel.webview.html).toContain('Connected');
      expect(panel.webview.html).toContain('Not configured');
    });

    it('shows recently used skills', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData());

      expect(panel.webview.html).toContain('Recently used');
      expect(panel.webview.html).toContain('Idea Triage');
    });

    it('shows suggested skills not recently used', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData());

      expect(panel.webview.html).toContain('Try these');
      expect(panel.webview.html).toContain('PRD Writer');
    });

    it('shows guides with progress', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData());

      expect(panel.webview.html).toContain('Getting Started with PM Code');
      expect(panel.webview.html).toContain('1/2 done');
      expect(panel.webview.html).toContain('progress-fill');
    });

    it('shows quick action buttons', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData());

      expect(panel.webview.html).toContain('Quick Actions');
      expect(panel.webview.html).toContain('My tasks');
      expect(panel.webview.html).toContain('Standup summary');
      expect(panel.webview.html).toContain('Needs attention');
    });

    it('renders hero with command center messaging', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData());

      expect(panel.webview.html).toContain('command center');
    });

    it('handles empty connectors', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData({ connectors: [] }));

      expect(panel.webview.html).toContain('No connectors configured');
    });

    it('handles empty skills', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData({ skills: [] }));

      expect(panel.webview.html).toContain('No skills installed');
    });
  });

  describe('Companion phase (FTUE not completed)', () => {
    const ftueData = baseDashboardData({
      phase: 'companion',
      ftueCompleted: false,
      ftueCompletedSteps: ['meetAI'],
      recentlyUsedSkills: [],
    });

    it('renders welcome hero', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, ftueData);

      expect(panel.webview.html).toContain('Welcome to PM Code');
      expect(panel.webview.html).toContain('set up');
    });

    it('shows FTUE steps with progress', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, ftueData);

      expect(panel.webview.html).toContain('Quick Start');
      expect(panel.webview.html).toContain('1 of 4 complete');
      expect(panel.webview.html).toContain('Meet your AI assistant');
      expect(panel.webview.html).toContain('Connect your first tool');
    });

    it('marks completed steps with checkmark', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, ftueData);

      // meetAI is completed, so it should have the completed class
      const html = panel.webview.html;
      const meetAiSection = html.substring(
        html.indexOf('Meet your AI assistant') - 200,
        html.indexOf('Meet your AI assistant') + 100
      );
      expect(meetAiSection).toContain('completed');
    });

    it('shows action buttons for uncompleted steps', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, ftueData);

      expect(panel.webview.html).toContain('Connect a tool');
      expect(panel.webview.html).toContain('Send your first prompt');
    });

    it('shows Roo Code connection status', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, ftueData);

      expect(panel.webview.html).toContain('Roo Code');
      expect(panel.webview.html).toContain('Connected');
    });

    it('shows system dependencies', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, ftueData);

      expect(panel.webview.html).toContain('Node.js ready');
      expect(panel.webview.html).toContain('22.14.0');
      expect(panel.webview.html).toContain('GitHub CLI ready');
    });

    it('shows recommended guides', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, ftueData);

      expect(panel.webview.html).toContain('Recommended Guides');
      expect(panel.webview.html).toContain('Getting Started with PM Code');
    });

    it('renders progress bar with correct percentage', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, ftueData);

      // 1 of 4 = 25%
      expect(panel.webview.html).toContain('width: 25%');
    });
  });

  describe('CSP and security', () => {
    it('includes Content-Security-Policy meta tag', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData());

      expect(panel.webview.html).toContain('Content-Security-Policy');
      expect(panel.webview.html).toContain("default-src 'none'");
    });

    it('uses nonce for inline script and style', () => {
      const { panelManager, panel } = mockPanelManager();
      CompanionPanel.show(vscode.Uri.file('/ext'), panelManager as any, baseDashboardData());

      const nonceMatch = panel.webview.html.match(/nonce="([^"]+)"/);
      expect(nonceMatch).not.toBeNull();
      // nonce should appear in both CSP and script/style tags
      const nonce = nonceMatch![1];
      expect(panel.webview.html.split(`nonce="${nonce}"`).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('update()', () => {
    it('re-renders the panel with new data', () => {
      const { panelManager } = mockPanelManager();
      const extensionUri = vscode.Uri.file('/ext');
      const data = baseDashboardData();

      const panel = CompanionPanel.show(extensionUri, panelManager as any, data);

      // Update with new connector status
      const updatedData = baseDashboardData({
        connectors: [
          { ...data.connectors[0], status: 'error' },
          { ...data.connectors[1], status: 'connected' },
        ],
      });

      CompanionPanel.update(updatedData, extensionUri);
      expect(panel.webview.html).toContain('Error');
    });
  });
});
