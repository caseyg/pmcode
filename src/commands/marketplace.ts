import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';

/**
 * Register marketplace commands: sync, browse, install skill/connector.
 */
export function registerMarketplaceCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  // pmcode.marketplace.sync — pull latest from marketplace repo
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.marketplace.sync', async () => {
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'PM Code: Updating marketplace...',
            cancellable: false,
          },
          async () => {
            const updated = await deps.marketplace.sync();
            if (updated) {
              const manifest = await deps.marketplace.getManifest();
              void vscode.window.showInformationMessage(
                `Marketplace updated: ${manifest.skills.length} skills, ${manifest.connectors.length} connectors available.`
              );
            } else {
              void vscode.window.showInformationMessage('Marketplace is already up to date.');
            }

            // Refresh sidebar counts
            const skills = await deps.skillManager.getInstalledSkills();
            const connectors = await deps.connectorManager.getConnectors();
            const guides = deps.guideEngine.getGuides();
            deps.sidebarProvider.updateCounts(skills.length, connectors.length, guides.length);
            deps.sidebarProvider.updateMarketplaceStatus(await deps.marketplace.getStatus());
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Marketplace sync failed: ${message}`);
      }
    })
  );

  // pmcode.marketplace.browse — open marketplace panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.marketplace.browse', async () => {
      try {
        const cloned = await deps.marketplace.isCloned();
        if (!cloned) {
          const action = await vscode.window.showInformationMessage(
            'The marketplace hasn\'t been set up yet. Download it now?',
            'Download',
            'Cancel'
          );
          if (action === 'Download') {
            await vscode.commands.executeCommand('pmcode.marketplace.sync');
          }
          return;
        }

        const [skills, connectors] = await Promise.all([
          deps.marketplace.getAvailableSkills(),
          deps.marketplace.getAvailableConnectors(),
        ]);

        // Check which are already installed
        const installedStatuses = new Map<string, boolean>();
        for (const skill of skills) {
          installedStatuses.set(skill.id, await deps.marketplace.isSkillInstalled(skill.id));
        }

        deps.panelManager.openPanel(
          'marketplace',
          'browse',
          'Marketplace',
          (webview) => getMarketplaceHtml(webview, context.extensionUri, skills, connectors, installedStatuses)
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to open marketplace: ${message}`);
      }
    })
  );

  // pmcode.marketplace.installSkill — install a skill from marketplace
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.marketplace.installSkill', async (skillId?: string) => {
      if (!skillId) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Installing skill: ${skillId}...`,
            cancellable: false,
          },
          async () => {
            await deps.marketplace.installSkill(skillId);
            deps.skillManager.refresh();
            void vscode.window.showInformationMessage(`Skill "${skillId}" installed.`);
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to install skill: ${message}`);
      }
    })
  );

  // pmcode.marketplace.installConnector — install connector from marketplace
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.marketplace.installConnector', async (connectorId?: string) => {
      if (!connectorId) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Installing connector: ${connectorId}...`,
            cancellable: false,
          },
          async () => {
            await deps.marketplace.installConnector(connectorId);
            void vscode.window.showInformationMessage(`Connector "${connectorId}" installed.`);
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to install connector: ${message}`);
      }
    })
  );

  // pmcode.marketplace.setRepo — configure marketplace repo URL
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.marketplace.setRepo', async (url?: string) => {
      if (!url) {
        url = await vscode.window.showInputBox({
          prompt: 'Enter the marketplace git repo URL',
          placeHolder: 'https://github.com/org/marketplace.git',
          value: deps.marketplace.getRepoUrl(),
        });
      }
      if (!url) {
        return;
      }
      deps.marketplace.setRepoUrl(url);
      await deps.configManager.updateConfig({
        preferences: { marketplaceRepoUrl: url },
      } as any);
      void vscode.window.showInformationMessage(
        `Marketplace repo set to: ${url}. Run "PM Code: Update Marketplace" to sync.`
      );
    })
  );
}

// ── Marketplace panel HTML ─────────────────────────────────────────────────

function getMarketplaceHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  skills: import('../marketplace/MarketplaceRegistry').MarketplaceSkillEntry[],
  connectors: import('../marketplace/MarketplaceRegistry').MarketplaceConnectorEntry[],
  installedStatuses: Map<string, boolean>
): string {
  const stylesUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview-ui', 'styles.css')
  );

  let skillCards = '';
  for (const skill of skills) {
    const installed = installedStatuses.get(skill.id) ?? false;
    skillCards += `
      <div class="card">
        <div class="card-header">
          <span class="card-icon">&#9889;</span>
          <div>
            <div class="card-title">${esc(skill.name)}</div>
            <div class="card-description">${esc(skill.description)}</div>
          </div>
        </div>
        <div class="card-footer">
          <span class="badge">${esc(skill.category)}</span>
          <span class="badge">v${esc(skill.version)}</span>
          ${installed
            ? '<span class="badge" style="background:var(--vscode-testing-iconPassed,#4caf50);color:#fff">Installed</span>'
            : `<button class="btn btn-primary" onclick="install('skill','${esc(skill.id)}')">Install</button>`
          }
        </div>
      </div>`;
  }

  let connectorCards = '';
  for (const conn of connectors) {
    connectorCards += `
      <div class="card">
        <div class="card-header">
          <span class="card-icon">&#128268;</span>
          <div>
            <div class="card-title">${esc(conn.name)}</div>
            <div class="card-description">${esc(conn.description)}</div>
          </div>
        </div>
        <div class="card-footer">
          <span class="badge">${esc(conn.type)}</span>
          <span class="badge">v${esc(conn.version)}</span>
          <button class="btn btn-primary" onclick="install('connector','${esc(conn.id)}')">Install</button>
        </div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${stylesUri}" rel="stylesheet" />
  <title>Marketplace</title>
</head>
<body>
  <div class="panel-container">
    <div class="panel-header">
      <h1>Marketplace</h1>
      <p>Browse and install skills and connectors from the community.</p>
    </div>

    ${skills.length > 0 ? `
    <div class="detail-section">
      <h2>Skills (${skills.length})</h2>
      <div class="panel-grid">${skillCards}</div>
    </div>` : ''}

    ${connectors.length > 0 ? `
    <div class="detail-section">
      <h2>Connectors (${connectors.length})</h2>
      <div class="panel-grid">${connectorCards}</div>
    </div>` : ''}

    ${skills.length === 0 && connectors.length === 0
      ? '<p class="text-muted" style="text-align:center;padding:40px">No items in the marketplace yet.</p>'
      : ''}
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function install(type, id) {
      vscode.postMessage({ type: 'install', itemType: type, id: id });
    }
  </script>
</body>
</html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
