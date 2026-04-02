import * as vscode from 'vscode';
import { PanelManager } from './PanelManager';
import {
  Guide,
  GuideProgress,
  getNonce,
  getStylesUri,
  escapeHtml,
  escapeAttr,
} from './panelUtils';

/**
 * Opens a WebviewPanel showing all guides as cards.
 * Each card: name, description, estimated time, progress bar.
 * Clicking a card opens the GuideDetailPanel.
 */
export class GuidesListPanel {
  static readonly panelType = 'guides-list';
  static readonly panelId = 'list';

  static show(
    extensionUri: vscode.Uri,
    panelManager: PanelManager,
    guides: Guide[],
    progress: Map<string, GuideProgress>
  ): vscode.WebviewPanel {
    const panel = panelManager.openPanel(
      GuidesListPanel.panelType,
      GuidesListPanel.panelId,
      'Guides',
      (webview) => GuidesListPanel.getHtml(webview, extensionUri, guides, progress)
    );

    panel.webview.onDidReceiveMessage((message) => {
      if (message.type === 'openGuide') {
        vscode.commands.executeCommand('pmcode.openGuide', message.id);
      }
    });

    return panel;
  }

  private static getHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    guides: Guide[],
    progress: Map<string, GuideProgress>
  ): string {
    const stylesUri = getStylesUri(webview, extensionUri);
    const nonce = getNonce();

    const cardsHtml = guides
      .map((guide) => {
        const gp = progress.get(guide.id);
        const totalSteps = guide.steps.length;
        const completedSteps = gp ? Math.min(gp.completedSteps.length, totalSteps) : 0;
        const pct = totalSteps > 0 ? Math.min(Math.round((completedSteps / totalSteps) * 100), 100) : 0;
        const hasProgress = gp && completedSteps > 0;

        const typeLabel = guide.type === 'walkthrough' ? 'Walkthrough' : 'Step-by-step';

        let progressHtml = '';
        if (hasProgress) {
          progressHtml = `
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <span class="text-muted">${completedSteps} / ${totalSteps} steps</span>`;
        }

        return `<div class="card" data-id="${escapeAttr(guide.id)}">
          <div class="card-header">
            <div class="card-icon">&#128214;</div>
            <div>
              <div class="card-title">${escapeHtml(guide.title)}</div>
            </div>
          </div>
          <div class="card-description">${escapeHtml(guide.description)}</div>
          <div class="card-footer">
            <span class="badge">${escapeHtml(typeLabel)}</span>
            <span class="text-muted">${guide.estimatedMinutes} min</span>
          </div>
          ${progressHtml}
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
      <h1>Guides</h1>
      <p>${guides.length} guide${guides.length !== 1 ? 's' : ''} available</p>
    </div>
    <div class="panel-grid">
      ${cardsHtml}
    </div>
  </div>
  <script nonce="${nonce}">
    var vscode = acquireVsCodeApi();
    document.querySelectorAll('.card').forEach(function(card) {
      card.addEventListener('click', function() {
        vscode.postMessage({ type: 'openGuide', id: card.dataset.id });
      });
    });
  </script>
</body>
</html>`;
  }
}
