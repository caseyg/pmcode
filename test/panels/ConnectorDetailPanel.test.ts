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
});
