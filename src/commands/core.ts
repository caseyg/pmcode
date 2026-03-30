import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';

/**
 * Register core commands: sendPrompt, focusSidebar, search, openDashboard, openSettings.
 */
export function registerCoreCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  // pmcode.sendPrompt — inject prompt text into the AI provider
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.sendPrompt', async (text?: string) => {
      if (!text) {
        text = await vscode.window.showInputBox({
          prompt: 'Enter a prompt to send to your AI assistant',
          placeHolder: 'e.g., Show me open bugs in the current sprint',
        });
      }

      if (!text) {
        return;
      }

      try {
        await deps.providerAdapter.injectPrompt(text);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to send prompt: ${message}`);
      }
    })
  );

  // pmcode.focusSidebar — focus the PM Code sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.focusSidebar', () => {
      deps.sidebarProvider.focus();
    })
  );

  // pmcode.search — open sidebar with search query pre-filled
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.search', (query?: string) => {
      deps.sidebarProvider.focus();
      if (query) {
        deps.sidebarProvider.setSearchQuery(query);
      }
    })
  );

  // pmcode.openDashboard — open the companion dashboard panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openDashboard', () => {
      deps.panelManager.openPanel('dashboard', 'main', 'PM Code Dashboard', () => {
        return getDashboardHtml();
      });
    })
  );

  // pmcode.openSettings — open PM Code settings
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openSettings', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:pmcode.pmcode'
      );
    })
  );
}

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PM Code Dashboard</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      margin: 0;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { opacity: 0.7; margin-bottom: 24px; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .card {
      padding: 16px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: var(--vscode-editor-background);
    }
    .card h3 { margin: 0 0 8px; font-size: 16px; }
    .card p { margin: 0; font-size: 13px; opacity: 0.8; }
  </style>
</head>
<body>
  <h1>PM Code</h1>
  <p class="subtitle">Your AI-powered product management command center</p>
  <div class="card-grid">
    <div class="card">
      <h3>Skills</h3>
      <p>Pre-built workflows for common PM tasks. Browse and run skills to supercharge your productivity.</p>
    </div>
    <div class="card">
      <h3>Connectors</h3>
      <p>Connect your project management tools so your AI can access real data.</p>
    </div>
    <div class="card">
      <h3>Guides</h3>
      <p>Step-by-step walkthroughs to help you master AI-assisted product management.</p>
    </div>
  </div>
</body>
</html>`;
}
