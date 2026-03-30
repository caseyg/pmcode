import * as vscode from 'vscode';
import { PanelManager } from './PanelManager';
import {
  ConnectorConfig,
  getNonce,
  getStylesUri,
  escapeHtml,
  escapeAttr,
  statusDotClass,
  statusLabel,
} from './panelUtils';

/**
 * Opens a WebviewPanel showing all connectors in a grid.
 * Each card shows icon, name, description, and status indicator.
 * Clicking a card opens the ConnectorDetailPanel.
 */
export class ConnectorsListPanel {
  static readonly panelType = 'connectors-list';
  static readonly panelId = 'list';

  static show(
    extensionUri: vscode.Uri,
    panelManager: PanelManager,
    connectors: ConnectorConfig[]
  ): vscode.WebviewPanel {
    const panel = panelManager.openPanel(
      ConnectorsListPanel.panelType,
      ConnectorsListPanel.panelId,
      'Connectors',
      (webview) => ConnectorsListPanel.getHtml(webview, extensionUri, connectors)
    );

    panel.webview.onDidReceiveMessage((message) => {
      if (message.type === 'openConnector') {
        vscode.commands.executeCommand('pmcode.openConnector', message.id);
      }
    });

    return panel;
  }

  private static getHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    connectors: ConnectorConfig[]
  ): string {
    const stylesUri = getStylesUri(webview, extensionUri);
    const nonce = getNonce();

    const cardsHtml = connectors
      .map((c) => {
        const dotClass = statusDotClass(c.status);
        const label = statusLabel(c.status);
        return `<div class="card" data-id="${escapeAttr(c.id)}">
          <div class="card-header">
            <div class="card-icon">${escapeHtml(c.icon)}</div>
            <div>
              <div class="card-title">${escapeHtml(c.name)}</div>
            </div>
          </div>
          <div class="card-description">${escapeHtml(c.description)}</div>
          <div class="card-footer">
            <span class="status-dot ${dotClass}"></span>
            <span class="text-muted">${escapeHtml(label)}</span>
            <span class="badge">${escapeHtml(c.type)}</span>
          </div>
        </div>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${stylesUri}" />
</head>
<body>
  <div class="panel-container">
    <div class="panel-header">
      <h1>Connectors</h1>
      <p>${connectors.length} connector${connectors.length !== 1 ? 's' : ''} available</p>
    </div>
    <div class="panel-grid">
      ${cardsHtml}
    </div>
  </div>
  <script nonce="${nonce}">
    var vscode = acquireVsCodeApi();
    document.querySelectorAll('.card').forEach(function(card) {
      card.addEventListener('click', function() {
        vscode.postMessage({ type: 'openConnector', id: card.dataset.id });
      });
    });
  </script>
</body>
</html>`;
  }
}
