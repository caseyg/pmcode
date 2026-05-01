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

  // ── Deeper coverage ──

  it('renders category and source badges', () => {
    const skill = makeSkill({ metadata: { category: 'analysis', connectors: [] } });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('analysis');
    expect(html).toContain('bundled');
  });

  it('omits requirements section when no connectors are needed', () => {
    const skill = makeSkill({ metadata: { category: 'general', connectors: [] } });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).not.toContain('Requirements');
    expect(html).not.toContain('data-connector=');
  });

  it('omits instructions section when instructions are empty', () => {
    const skill = makeSkill({ instructions: '' });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).not.toContain('How it works');
  });

  it('renders markdown headings in instructions', () => {
    const skill = makeSkill({ instructions: '# Big Heading\n\nSome text\n\n## Sub Heading\n\nMore text' });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('<h1>');
    expect(html).toContain('<h2>');
    expect(html).toContain('Big Heading');
    expect(html).toContain('Sub Heading');
  });

  it('renders bullet lists in instructions', () => {
    const skill = makeSkill({ instructions: '- Item one\n- Item two\n- Item three' });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item one</li>');
    expect(html).toContain('<li>Item two</li>');
  });

  it('renders numbered lists in instructions', () => {
    const skill = makeSkill({ instructions: '1. First\n2. Second\n3. Third' });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
  });

  it('escapes HTML in skill name and description', () => {
    const skill = makeSkill({
      name: '<script>alert("xss")</script>',
      description: 'Use <b>bold</b> & "quotes"',
    });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;quotes&quot;');
  });

  it('generates correct prompts for PRD skill', () => {
    const skill = makeSkill({ id: 'prd-writer', name: 'PRD Writer', metadata: { category: 'planning', connectors: [] } });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('Draft a PRD');
  });

  it('generates correct prompts for sprint retro skill', () => {
    const skill = makeSkill({ id: 'sprint-retro', name: 'Sprint Retrospective', metadata: { category: 'planning', connectors: [] } });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('sprint retrospective');
  });

  it('generates fallback prompt for unknown skill name', () => {
    const skill = makeSkill({ id: 'custom-thing', name: 'Custom Thing', metadata: { category: 'general', connectors: [] } });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('Run the Custom Thing skill');
  });

  it('shows related section when connectors exist', () => {
    const skill = makeSkill({ metadata: { category: 'planning', connectors: ['jira', 'monday'] } });
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('Related');
    expect(html).toContain('related-item');
    expect(html).toContain('data-connector="jira"');
    expect(html).toContain('data-connector="monday"');
  });

  it('has valid CSP meta tag', () => {
    const skill = makeSkill();
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("default-src 'none'");
    expect(html).toMatch(/script-src 'nonce-[a-zA-Z0-9]+'/);
  });

  it('includes stylesheet link', () => {
    const skill = makeSkill();
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());
    const html = panel.webview.html;

    expect(html).toContain('rel="stylesheet"');
  });

  it('handles sendPrompt message from webview', () => {
    const skill = makeSkill();
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());

    (panel as any)._simulateMessage({ type: 'sendPrompt', text: 'Test prompt' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.sendPrompt', 'Test prompt');
  });

  it('handles openConnector message from webview', () => {
    const skill = makeSkill();
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, new Map());

    (panel as any)._simulateMessage({ type: 'openConnector', id: 'jira' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.openConnector', 'jira');
  });

  it('shows all connector statuses correctly', () => {
    const skill = makeSkill({ metadata: { category: 'planning', connectors: ['jira', 'github', 'monday'] } });
    const statuses = new Map<string, ConnectorStatus>([
      ['jira', 'connected'],
      ['github', 'error'],
      ['monday', 'unconfigured'],
    ]);
    const panel = SkillDetailPanel.show(extensionUri, panelManager, skill, statuses);
    const html = panel.webview.html;

    // jira → Connected, github → Not configured (error mapped), monday → Not configured
    expect(html).toContain('jira');
    expect(html).toContain('github');
    expect(html).toContain('monday');
    // At least one "Connected"
    expect(html).toContain('Connected');
    expect(html).toContain('Not configured');
  });
});
