import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ConnectorsListPanel } from '../../src/panels/ConnectorsListPanel';
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
    fields: [],
    examplePrompts: [],
    relatedSkills: [],
    relatedGuides: [],
    ...overrides,
  };
}

describe('ConnectorsListPanel', () => {
  let panelManager: PanelManager;
  const extensionUri = vscode.Uri.file('/mock/ext');

  beforeEach(() => {
    vi.clearAllMocks();
    panelManager = new PanelManager(extensionUri);
  });

  it('show() creates a webview panel', () => {
    const connectors = [makeConnector()];
    const panel = ConnectorsListPanel.show(extensionUri, panelManager, connectors);

    expect(panel).toBeDefined();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
  });

  it('HTML contains connector names and status dots', () => {
    const connectors = [
      makeConnector({ name: 'Jira', status: 'connected' }),
      makeConnector({ id: 'gh', name: 'GitHub', status: 'unconfigured' }),
    ];
    const panel = ConnectorsListPanel.show(extensionUri, panelManager, connectors);
    const html = panel.webview.html;

    expect(html).toContain('Jira');
    expect(html).toContain('GitHub');
    expect(html).toContain('status-dot green');
    expect(html).toContain('status-dot muted');
  });

  it('handles empty connectors array', () => {
    const panel = ConnectorsListPanel.show(extensionUri, panelManager, []);
    const html = panel.webview.html;

    expect(html).toContain('0 connectors available');
  });
});
