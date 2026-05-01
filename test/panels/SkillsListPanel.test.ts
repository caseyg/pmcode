import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { SkillsListPanel } from '../../src/panels/SkillsListPanel';
import { PanelManager } from '../../src/panels/PanelManager';
import type { Skill } from '../../src/skills/SkillParser';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'idea-triage',
    name: 'Idea Triage',
    description: 'Triage and prioritize ideas',
    instructions: 'Follow these steps...',
    source: 'bundled',
    path: '/mock/skills/idea-triage',
    metadata: { category: 'planning', connectors: ['jira'] },
    ...overrides,
  };
}

describe('SkillsListPanel', () => {
  let panelManager: PanelManager;
  const extensionUri = vscode.Uri.file('/mock/ext');

  beforeEach(() => {
    vi.clearAllMocks();
    panelManager = new PanelManager(extensionUri);
  });

  it('show() creates a webview panel', () => {
    const skills = [makeSkill()];
    const panel = SkillsListPanel.show(extensionUri, panelManager, skills);

    expect(panel).toBeDefined();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
  });

  it('HTML contains skill names and descriptions', () => {
    const skills = [
      makeSkill({ id: 's1', name: 'Skill One', description: 'Desc one' }),
      makeSkill({ id: 's2', name: 'Skill Two', description: 'Desc two' }),
    ];
    const panel = SkillsListPanel.show(extensionUri, panelManager, skills);
    const html = panel.webview.html;

    expect(html).toContain('Skill One');
    expect(html).toContain('Desc one');
    expect(html).toContain('Skill Two');
    expect(html).toContain('Desc two');
  });

  it('HTML contains category badges', () => {
    const skills = [
      makeSkill({ metadata: { category: 'research' } }),
    ];
    const panel = SkillsListPanel.show(extensionUri, panelManager, skills);
    const html = panel.webview.html;

    expect(html).toContain('research');
    expect(html).toContain('badge');
  });

  it('handles empty skills array', () => {
    const panel = SkillsListPanel.show(extensionUri, panelManager, []);
    const html = panel.webview.html;

    expect(html).toContain('0 skills installed');
  });
});
