import * as vscode from 'vscode';
import { Skill } from '../skills/SkillParser';
import { PanelManager } from './PanelManager';
import {
  ConnectorStatus,
  getNonce,
  getStylesUri,
  escapeHtml,
  escapeAttr,
  statusDotClass,
} from './panelUtils';

/**
 * Opens a WebviewPanel for a single skill.
 *
 * Shows: header (icon + name + description), requirements check (required
 * connectors with status), "How it works" instructions, "Try it now" prompt
 * buttons with "Send to Roo", and related items.
 */
export class SkillDetailPanel {
  static readonly panelType = 'skill-detail';

  static show(
    extensionUri: vscode.Uri,
    panelManager: PanelManager,
    skill: Skill,
    connectorStatuses: Map<string, ConnectorStatus>
  ): vscode.WebviewPanel {
    const panel = panelManager.openPanel(
      SkillDetailPanel.panelType,
      skill.id,
      skill.name,
      (webview) =>
        SkillDetailPanel.getHtml(webview, extensionUri, skill, connectorStatuses)
    );

    panel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'sendPrompt':
          vscode.commands.executeCommand('pmcode.sendPrompt', message.text);
          break;
        case 'openConnector':
          vscode.commands.executeCommand('pmcode.openConnector', message.id);
          break;
      }
    });

    return panel;
  }

  private static getHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    skill: Skill,
    connectorStatuses: Map<string, ConnectorStatus>
  ): string {
    const stylesUri = getStylesUri(webview, extensionUri);
    const nonce = getNonce();

    const connectors = skill.metadata.connectors || [];
    const category = skill.metadata.category || 'general';

    // Requirements section
    let requirementsHtml = '';
    if (connectors.length > 0) {
      const items = connectors
        .map((cId) => {
          const status = connectorStatuses.get(cId) || 'unconfigured';
          const isOk = status === 'connected';
          const dotClass = statusDotClass(status);
          const statusText = isOk ? 'Connected' : 'Not configured';
          const statusClass = isOk ? 'connected' : 'missing';
          return `<div class="requirement-item" data-connector="${escapeAttr(cId)}">
            <span class="status-dot ${dotClass}"></span>
            <span class="req-label">${escapeHtml(cId)}</span>
            <span class="req-status ${statusClass}">${statusText}</span>
          </div>`;
        })
        .join('\n');

      requirementsHtml = `
        <div class="detail-section">
          <h2>Requirements</h2>
          <div class="requirements-list">${items}</div>
        </div>`;
    }

    // Instructions / How it works
    const instructionsHtml = skill.instructions
      ? `<div class="detail-section">
          <h2>How it works</h2>
          <div class="step-content">${simpleMarkdown(skill.instructions)}</div>
        </div>`
      : '';

    // Try it now — generate sample prompts from the skill name
    const samplePrompts = generateSamplePrompts(skill);
    const tryItHtml =
      samplePrompts.length > 0
        ? `<div class="detail-section">
            <h2>Try it now</h2>
            <div class="prompt-buttons">
              ${samplePrompts
                .map(
                  (p) =>
                    `<button class="btn btn-send" data-prompt="${escapeAttr(p)}">${escapeHtml(p)}</button>`
                )
                .join('\n')}
            </div>
          </div>`
        : '';

    // Related items
    let relatedHtml = '';
    if (connectors.length > 0) {
      const chips = connectors
        .map(
          (cId) =>
            `<button class="related-item" data-connector="${escapeAttr(cId)}">${escapeHtml(cId)}</button>`
        )
        .join('');
      relatedHtml = `
        <div class="detail-section">
          <h2>Related</h2>
          <div class="related-items">${chips}</div>
        </div>`;
    }

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
    <div class="detail-header">
      <div class="detail-icon">&#9889;</div>
      <div class="detail-info">
        <h1>${escapeHtml(skill.name)}</h1>
        <p>${escapeHtml(skill.description)}</p>
        <div class="mt-8">
          <span class="badge">${escapeHtml(category)}</span>
          <span class="badge">${escapeHtml(skill.source)}</span>
        </div>
      </div>
    </div>

    ${requirementsHtml}
    ${instructionsHtml}
    ${tryItHtml}
    ${relatedHtml}
  </div>

  <script nonce="${nonce}">
    var vscode = acquireVsCodeApi();

    // Send prompt buttons
    document.querySelectorAll('.btn-send').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ type: 'sendPrompt', text: btn.dataset.prompt });
      });
    });

    // Requirement items -> open connector
    document.querySelectorAll('.requirement-item').forEach(function(item) {
      item.addEventListener('click', function() {
        vscode.postMessage({ type: 'openConnector', id: item.dataset.connector });
      });
    });

    // Related items -> open connector
    document.querySelectorAll('.related-item[data-connector]').forEach(function(item) {
      item.addEventListener('click', function() {
        vscode.postMessage({ type: 'openConnector', id: item.dataset.connector });
      });
    });
  </script>
</body>
</html>`;
  }
}

/**
 * Very simple markdown to HTML conversion for skill instructions.
 * Handles paragraphs, headings, bold, inline code, and lists.
 */
function simpleMarkdown(md: string): string {
  return md
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) {
        return '';
      }
      if (trimmed.startsWith('### ')) {
        return `<h3>${escapeHtml(trimmed.slice(4))}</h3>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h3>${escapeHtml(trimmed.slice(3))}</h3>`;
      }
      if (trimmed.startsWith('# ')) {
        return `<h2>${escapeHtml(trimmed.slice(2))}</h2>`;
      }
      // Simple list detection
      if (/^[-*]\s/.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((line) => /^[-*]\s/.test(line.trim()))
          .map((line) => `<li>${escapeHtml(line.trim().replace(/^[-*]\s/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      // Numbered list
      if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((line) => /^\d+\.\s/.test(line.trim()))
          .map((line) => `<li>${escapeHtml(line.trim().replace(/^\d+\.\s/, ''))}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join('\n');
}

/**
 * Generate sample prompts based on the skill name and description.
 */
function generateSamplePrompts(skill: Skill): string[] {
  const prompts: string[] = [];
  const name = skill.name.toLowerCase();

  if (name.includes('triage') || name.includes('idea')) {
    prompts.push('Triage the top 10 ideas in my backlog');
    prompts.push('Prioritize open feature requests by impact');
  } else if (name.includes('retro') || name.includes('retrospective')) {
    prompts.push('Generate a sprint retrospective from the last sprint');
    prompts.push('Summarize what went well and what to improve');
  } else if (name.includes('prd') || name.includes('requirements')) {
    prompts.push('Draft a PRD for a new user onboarding flow');
    prompts.push('Write product requirements based on recent user feedback');
  } else if (name.includes('competitive') || name.includes('research')) {
    prompts.push('Research our top 3 competitors');
    prompts.push('Compare feature sets across competing products');
  } else if (name.includes('sprint') && name.includes('plan')) {
    prompts.push('Plan the next sprint from the current backlog');
    prompts.push('Estimate capacity and suggest sprint scope');
  } else if (name.includes('standup') || name.includes('summary')) {
    prompts.push('Summarize team activity for today\'s standup');
    prompts.push('What did the team work on yesterday?');
  } else if (name.includes('story') || name.includes('breakdown')) {
    prompts.push('Break this epic into user stories with acceptance criteria');
    prompts.push('Create stories for the checkout redesign epic');
  } else if (name.includes('roadmap')) {
    prompts.push('Review the current roadmap and flag risks');
    prompts.push('Show roadmap progress for this quarter');
  } else {
    prompts.push(`Run the ${skill.name} skill`);
  }

  return prompts;
}
