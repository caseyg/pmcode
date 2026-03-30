import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { SkillDetailPanel } from '../../src/panels/SkillDetailPanel';
import { PanelManager } from '../../src/panels/PanelManager';
import type { Skill } from '../../src/skills/SkillParser';
import type { ConnectorStatus } from '../../src/panels/panelUtils';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'idea-triage',
    name: 'Idea Triage',
    description: 'Triage and prioritize product ideas',
    instructions: 'Step 1: Gather ideas\n\nStep 2: Score them',
    source: 'bundled',
    path: '/mock/skills/idea-triage',
    metadata: { category: 'planning', connectors: ['jira', 'github'] },
    ...overrides,
  };
}

describe('SkillDetailPanel', () => {
  let panelManager: PanelManager;
  const extensionUri = vscode.Uri.file('/mock/ext');

  beforeEach(() => {
    vi.clearAllMocks();
    panelManager = new PanelManager(extensionUri);
  });

  it('show() creates a webview panel with skill info', () => {
    const skill = makeSkill();
    const statuses = new Map<string, ConnectorStatus>();
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, statuses);

    expect(panel).toBeDefined();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
  });

  it('HTML contains skill name, description, instructions', () => {
    const skill = makeSkill();
    const statuses = new Map<string, ConnectorStatus>();
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, statuses);
    const html = panel.webview.html;

    expect(html).toContain('Idea Triage');
    expect(html).toContain('Triage and prioritize product ideas');
    expect(html).toContain('How it works');
    expect(html).toContain('Gather ideas');
  });

  it('shows connector requirements with status', () => {
    const skill = makeSkill();
    const statuses = new Map<string, ConnectorStatus>([
      ['jira', 'connected'],
      ['github', 'unconfigured'],
    ]);
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, statuses);
    const html = panel.webview.html;

    expect(html).toContain('Requirements');
    expect(html).toContain('jira');
    expect(html).toContain('github');
    expect(html).toContain('Connected');
    expect(html).toContain('Not configured');
  });

  it('includes "Send to Roo" prompt buttons', () => {
    const skill = makeSkill({ name: 'Idea Triage' });
    const statuses = new Map<string, ConnectorStatus>();
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, statuses);
    const html = panel.webview.html;

    expect(html).toContain('Try it now');
    expect(html).toContain('btn-send');
    expect(html).toContain('Triage the top 10 ideas');
  });
});
