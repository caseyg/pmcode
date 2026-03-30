import * as vscode from 'vscode';
import { Skill } from '../skills/SkillParser';
import { PanelManager } from './PanelManager';
import { getNonce, getStylesUri, escapeHtml, escapeAttr } from './panelUtils';

/**
 * Opens a WebviewPanel in the editor area showing all skills in a grid.
 * Each card shows icon, name, description, category badge, and status.
 * Clicking a card opens the SkillDetailPanel for that skill.
 */
export class SkillsListPanel {
  static readonly panelType = 'skills-list';
  static readonly panelId = 'list';

  static show(
    extensionUri: vscode.Uri,
    panelManager: PanelManager,
    skills: Skill[]
  ): vscode.WebviewPanel {
    const panel = panelManager.openPanel(
      SkillsListPanel.panelType,
      SkillsListPanel.panelId,
      'Skills',
      (webview) => SkillsListPanel.getHtml(webview, extensionUri, skills)
    );

    panel.webview.onDidReceiveMessage((message) => {
      if (message.type === 'openSkill') {
        vscode.commands.executeCommand('pmcode.openSkill', message.id);
      }
    });

    return panel;
  }

  private static getHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    skills: Skill[]
  ): string {
    const stylesUri = getStylesUri(webview, extensionUri);
    const nonce = getNonce();

    const cardsHtml = skills
      .map((skill) => {
        const category = skill.metadata.category || 'general';
        return `<div class="card" data-id="${escapeAttr(skill.id)}">
          <div class="card-header">
            <div class="card-icon">&#9889;</div>
            <div>
              <div class="card-title">${escapeHtml(skill.name)}</div>
            </div>
          </div>
          <div class="card-description">${escapeHtml(skill.description)}</div>
          <div class="card-footer">
            <span class="badge">${escapeHtml(category)}</span>
            <span class="badge">${escapeHtml(skill.source)}</span>
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
      <h1>Skills</h1>
      <p>${skills.length} skill${skills.length !== 1 ? 's' : ''} installed</p>
    </div>
    <div class="panel-grid">
      ${cardsHtml}
    </div>
  </div>
  <script nonce="${nonce}">
    var vscode = acquireVsCodeApi();
    document.querySelectorAll('.card').forEach(function(card) {
      card.addEventListener('click', function() {
        vscode.postMessage({ type: 'openSkill', id: card.dataset.id });
      });
    });
  </script>
</body>
</html>`;
  }
}
