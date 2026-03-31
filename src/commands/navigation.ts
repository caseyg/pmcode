import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';

/**
 * Register navigation commands: openSkills, openConnectors, openGuides,
 * openSkill, openConnector, openGuide.
 */
export function registerNavigationCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  // pmcode.openSkills — open the Skills list panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openSkills', async () => {
      const skills = await deps.skillManager.getInstalledSkills();
      const panel = deps.panelManager.openPanel('skills-list', 'list', 'Skills', () => {
        return getSkillsListHtml(skills);
      });
      panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'openItem' && message.id) {
          vscode.commands.executeCommand('pmcode.openSkill', message.id);
        }
      });
    })
  );

  // pmcode.openConnectors — open the Connectors list panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openConnectors', async () => {
      const connectors = await deps.connectorManager.getConnectors();
      const panel = deps.panelManager.openPanel('connectors-list', 'list', 'Connectors', () => {
        return getConnectorsListHtml(connectors);
      });
      panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'openItem' && message.id) {
          vscode.commands.executeCommand('pmcode.openConnector', message.id);
        }
      });
    })
  );

  // pmcode.openGuides — open the Guides list panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openGuides', () => {
      const guides = deps.guideEngine.getGuides();
      const panel = deps.panelManager.openPanel('guides-list', 'list', 'Guides', () => {
        return getGuidesListHtml(guides);
      });
      panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'openItem' && message.id) {
          vscode.commands.executeCommand('pmcode.openGuide', message.id);
        }
      });
    })
  );

  // pmcode.openSkill — open a specific skill detail panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openSkill', async (id?: string) => {
      if (!id) {
        id = await vscode.window.showInputBox({ prompt: 'Enter skill id' });
      }
      if (!id) {
        return;
      }
      const skill = await deps.skillManager.getSkill(id);
      if (!skill) {
        void vscode.window.showWarningMessage(`Skill "${id}" not found.`);
        return;
      }
      deps.panelManager.openPanel('skill-detail', id, skill.name, () => {
        return getSkillDetailHtml(skill);
      });
    })
  );

  // pmcode.openConnector — open a specific connector detail panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openConnector', async (id?: string) => {
      if (!id) {
        id = await vscode.window.showInputBox({ prompt: 'Enter connector id' });
      }
      if (!id) {
        return;
      }
      const connector = await deps.connectorManager.getConnector(id);
      if (!connector) {
        void vscode.window.showWarningMessage(`Connector "${id}" not found.`);
        return;
      }
      deps.panelManager.openPanel('connector-detail', id, connector.name, () => {
        return getConnectorDetailHtml(connector);
      });
    })
  );

  // pmcode.openGuide — open a specific guide panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openGuide', async (id?: string) => {
      if (!id) {
        id = await vscode.window.showInputBox({ prompt: 'Enter guide id' });
      }
      if (!id) {
        return;
      }
      const guide = deps.guideEngine.getGuide(id);
      if (!guide) {
        void vscode.window.showWarningMessage(`Guide "${id}" not found.`);
        return;
      }
      deps.panelManager.openPanel('guide-detail', id, guide.title, () => {
        return getGuideDetailHtml(guide);
      });
    })
  );
}

// ── HTML generators (basic placeholders for webview content) ───────────────

function getSkillsListHtml(skills: Array<{ id: string; name: string; description: string }>): string {
  const items = skills
    .map(
      (s) =>
        `<div class="list-item" data-id="${s.id}">
          <h3>${escapeHtml(s.name)}</h3>
          <p>${escapeHtml(s.description)}</p>
        </div>`
    )
    .join('');

  return wrapHtml('Skills', items || '<p>No skills installed yet.</p>');
}

function getConnectorsListHtml(
  connectors: Array<{ id: string; name: string; description: string; status: string }>
): string {
  const items = connectors
    .map(
      (c) =>
        `<div class="list-item" data-id="${c.id}">
          <h3>${escapeHtml(c.name)} <span class="status-badge">${c.status}</span></h3>
          <p>${escapeHtml(c.description)}</p>
        </div>`
    )
    .join('');

  return wrapHtml('Connectors', items || '<p>No connectors available.</p>');
}

function getGuidesListHtml(
  guides: Array<{ id: string; title: string; description: string; estimatedMinutes: number; type: string }>
): string {
  const items = guides
    .map(
      (g) =>
        `<div class="list-item" data-id="${g.id}">
          <h3>${escapeHtml(g.title)}</h3>
          <p>${escapeHtml(g.description)}</p>
          <span class="meta">${g.type} &middot; ~${g.estimatedMinutes} min</span>
        </div>`
    )
    .join('');

  return wrapHtml('Guides', items || '<p>No guides available.</p>');
}

function getSkillDetailHtml(skill: { name: string; description: string; instructions: string }): string {
  return wrapHtml(
    skill.name,
    `<p>${escapeHtml(skill.description)}</p>
     <hr />
     <div class="markdown">${escapeHtml(skill.instructions)}</div>`
  );
}

function getConnectorDetailHtml(
  connector: { name: string; description: string; status: string; examplePrompts: string[] }
): string {
  const prompts = connector.examplePrompts
    .map((p) => `<li>${escapeHtml(p)}</li>`)
    .join('');

  return wrapHtml(
    connector.name,
    `<p>${escapeHtml(connector.description)}</p>
     <p><strong>Status:</strong> ${connector.status}</p>
     <h3>Example prompts</h3>
     <ul>${prompts}</ul>`
  );
}

function getGuideDetailHtml(
  guide: { title: string; description: string; steps: Array<{ title: string; content: string }> }
): string {
  const steps = guide.steps
    .map(
      (s, i) =>
        `<div class="guide-step">
          <h3>Step ${i + 1}: ${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.content)}</p>
        </div>`
    )
    .join('');

  return wrapHtml(
    guide.title,
    `<p>${escapeHtml(guide.description)}</p><hr />${steps}`
  );
}

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      margin: 0;
      max-width: 800px;
    }
    h1 { font-size: 22px; margin-bottom: 16px; }
    h3 { font-size: 16px; margin-top: 16px; }
    .list-item {
      padding: 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 10px;
      cursor: pointer;
    }
    .list-item:hover { background: var(--vscode-list-hoverBackground); }
    .list-item h3 { margin: 0 0 4px; font-size: 15px; }
    .list-item p { margin: 0; font-size: 13px; opacity: 0.8; }
    .status-badge {
      font-size: 11px; padding: 2px 6px; border-radius: 4px;
      background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
    }
    .meta { font-size: 12px; opacity: 0.6; }
    .guide-step { margin-bottom: 20px; }
    hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 16px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
  <script>
    var vscode = acquireVsCodeApi();
    document.querySelectorAll('.list-item[data-id]').forEach(function(item) {
      item.addEventListener('click', function() {
        vscode.postMessage({ type: 'openItem', id: item.dataset.id });
      });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
