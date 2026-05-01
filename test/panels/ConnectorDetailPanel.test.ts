import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ConnectorDetailPanel } from '../../src/panels/ConnectorDetailPanel';
import { PanelManager } from '../../src/panels/PanelManager';
import type { ConnectorConfig } from '../../src/panels/panelUtils';

function makeConnector(overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: 'jira',
    name: 'Jira',
    type: 'rest-api',
    description: 'Connect to Jira',
    icon: 'J',
    status: 'connected',
    fields: [
      { id: 'apiUrl', label: 'API URL', type: 'url', placeholder: 'https://...' },
      { id: 'apiToken', label: 'API Token', type: 'password', required: true },
      { id: 'project', label: 'Project Key', type: 'text', placeholder: 'PROJ' },
    ],
    examplePrompts: ['Show open bugs'],
    relatedSkills: ['idea-triage'],
    relatedGuides: ['getting-started'],
    ...overrides,
  };
}

describe('ConnectorDetailPanel', () => {
  let panelManager: PanelManager;
  const extensionUri = vscode.Uri.file('/mock/ext');

  beforeEach(() => {
    vi.clearAllMocks();
    panelManager = new PanelManager(extensionUri);
  });

  it('show() creates a webview panel', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});

    expect(panel).toBeDefined();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
  });

  it('HTML contains form fields from connector definition', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('API URL');
    expect(html).toContain('API Token');
    expect(html).toContain('Project Key');
  });

  it('form fields have correct types (text, password, url)', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('type="url"');
    expect(html).toContain('type="password"');
    expect(html).toContain('type="text"');
  });

  it('includes test connection button', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('Test Connection');
    expect(html).toContain('testBtn');
  });

  it('shows current values in form fields', () => {
    const connector = makeConnector();
    const currentValues = {
      apiUrl: 'https://mysite.atlassian.net',
      apiToken: 'secret123',
      project: 'MYPROJ',
    };
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, currentValues);
    const html = panel.webview.html;

    expect(html).toContain('https://mysite.atlassian.net');
    expect(html).toContain('secret123');
    expect(html).toContain('MYPROJ');
  });

  // ── Deeper coverage ──

  it('shows connector name and description in header', () => {
    const connector = makeConnector({ name: 'GitHub', description: 'Connect to GitHub repos' });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('GitHub');
    expect(html).toContain('Connect to GitHub repos');
  });

  it('shows status dot and label for connected status', () => {
    const connector = makeConnector({ status: 'connected' });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('status-dot');
    expect(html).toContain('green');
    expect(html).toContain('Connected');
  });

  it('shows status for unconfigured connector', () => {
    const connector = makeConnector({ status: 'unconfigured' });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('Not configured');
  });

  it('shows status for error connector', () => {
    const connector = makeConnector({ status: 'error' });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('Error');
  });

  it('shows type badge', () => {
    const connector = makeConnector({ type: 'mcp-server' });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('mcp-server');
  });

  it('shows required field indicator', () => {
    const connector = makeConnector({
      fields: [{ id: 'token', label: 'Token', type: 'password', required: true }],
    });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('required');
    expect(html).toContain('*');
  });

  it('shows save button when fields exist', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('saveBtn');
    expect(html).toContain('Save');
  });

  it('shows auto-detected message when no fields', () => {
    const connector = makeConnector({ fields: [] });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('auto-detected');
    expect(html).toContain('Test Connection');
  });

  it('shows disable and remove action buttons', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('disableBtn');
    expect(html).toContain('Disable');
    expect(html).toContain('removeBtn');
    expect(html).toContain('Remove');
  });

  it('shows example prompts section', () => {
    const connector = makeConnector({ examplePrompts: ['List my projects', 'Show sprint board'] });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('What you can do');
    expect(html).toContain('List my projects');
    expect(html).toContain('Show sprint board');
    expect(html).toContain('btn-send');
  });

  it('omits prompt buttons when no example prompts', () => {
    const connector = makeConnector({ examplePrompts: [] });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).not.toContain('data-prompt=');
  });

  it('shows related skills and guides', () => {
    const connector = makeConnector({
      relatedSkills: ['idea-triage', 'prd-writer'],
      relatedGuides: ['getting-started'],
    });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('Related');
    expect(html).toContain('data-skill="idea-triage"');
    expect(html).toContain('data-skill="prd-writer"');
    expect(html).toContain('data-guide="getting-started"');
  });

  it('omits related item chips when no related items', () => {
    const connector = makeConnector({ relatedSkills: [], relatedGuides: [] });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).not.toContain('data-skill=');
    expect(html).not.toContain('data-guide=');
  });

  it('renders select field type', () => {
    const connector = makeConnector({
      fields: [{
        id: 'cloud',
        label: 'Cloud Provider',
        type: 'select',
        options: [
          { label: 'AWS', value: 'aws' },
          { label: 'GCP', value: 'gcp' },
        ],
      }],
    });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('<select');
    expect(html).toContain('AWS');
    expect(html).toContain('GCP');
    expect(html).toContain('value="aws"');
  });

  it('pre-selects current value in select field', () => {
    const connector = makeConnector({
      fields: [{
        id: 'cloud',
        label: 'Cloud',
        type: 'select',
        options: [
          { label: 'AWS', value: 'aws' },
          { label: 'GCP', value: 'gcp' },
        ],
      }],
    });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, { cloud: 'gcp' });
    const html = panel.webview.html;

    expect(html).toContain('value="gcp" selected');
  });

  it('shows help text and help URL', () => {
    const connector = makeConnector({
      fields: [{
        id: 'token',
        label: 'Token',
        type: 'text',
        helpText: 'Get your token from settings',
        helpUrl: 'https://example.com/help',
      }],
    });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('Get your token from settings');
    expect(html).toContain('Learn more');
    expect(html).toContain('https://example.com/help');
  });

  it('escapes HTML in connector name and description', () => {
    const connector = makeConnector({
      name: '<img onerror=alert(1)>',
      description: 'Test & verify "safety"',
    });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&amp;');
  });

  it('escapes current values in form fields', () => {
    const connector = makeConnector({
      fields: [{ id: 'url', label: 'URL', type: 'text' }],
    });
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {
      url: '"><script>alert(1)</script>',
    });
    const html = panel.webview.html;

    expect(html).not.toContain('<script>alert(1)');
  });

  it('has valid CSP meta tag', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});
    const html = panel.webview.html;

    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("default-src 'none'");
    expect(html).toMatch(/script-src 'nonce-[a-zA-Z0-9]+'/);
  });

  // ── Message handler tests ──

  it('handles configure message', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});

    (panel as any)._simulateMessage({ type: 'configure', values: { apiUrl: 'https://x.com' } });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'pmcode.connector.configure',
      'jira',
      { apiUrl: 'https://x.com' }
    );
  });

  it('handles test message', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});

    (panel as any)._simulateMessage({ type: 'test' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.connector.test', 'jira');
  });

  it('handles disable message', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});

    (panel as any)._simulateMessage({ type: 'disable' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.connector.disable', 'jira');
  });

  it('handles remove message', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});

    (panel as any)._simulateMessage({ type: 'remove' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.connector.remove', 'jira');
  });

  it('handles sendPrompt message', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});

    (panel as any)._simulateMessage({ type: 'sendPrompt', text: 'Show bugs' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.sendPrompt', 'Show bugs');
  });

  it('handles openSkill message', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});

    (panel as any)._simulateMessage({ type: 'openSkill', id: 'idea-triage' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.openSkill', 'idea-triage');
  });

  it('handles openGuide message', () => {
    const connector = makeConnector();
    const panel = ConnectorDetailPanel.show(extensionUri, panelManager, connector, {});

    (panel as any)._simulateMessage({ type: 'openGuide', id: 'getting-started' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.openGuide', 'getting-started');
  });
});
