import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';
import { CompanionPanel, DashboardData } from '../panels/CompanionPanel';

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
        // Signal FTUE completion (no-op if already completed)
        void vscode.commands.executeCommand('pmcode.firstPromptSent');
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

  // pmcode.search — search skills, connectors, guides and send results to sidebar
  // Called by sidebar webview (with query) or command palette (with optional query)
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.search', async (query?: string, fromSidebar?: boolean) => {
      if (!fromSidebar) {
        deps.sidebarProvider.focus();
        if (query) {
          deps.sidebarProvider.setSearchQuery(query);
          // setSearchQuery triggers the webview input event which calls back with fromSidebar=true
          return;
        }
      }

      if (!query) {
        deps.sidebarProvider.sendSearchResults([]);
        return;
      }

      const q = query.toLowerCase();
      const results: import('../sidebar/SidebarProvider').SearchResult[] = [];

      // Search skills
      const skills = await deps.skillManager.getInstalledSkills();
      for (const s of skills) {
        if (
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.metadata?.category || '').toLowerCase().includes(q)
        ) {
          results.push({ category: 'skills', id: s.id, name: s.name, description: s.description, icon: '\u26A1' });
        }
      }

      // Search connectors
      const connectors = await deps.connectorManager.getConnectors();
      for (const c of connectors) {
        if (
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        ) {
          results.push({ category: 'connectors', id: c.id, name: c.name, description: c.description, icon: '\uD83D\uDD17' });
        }
      }

      // Search guides
      const guides = deps.guideEngine.getGuides();
      for (const g of guides) {
        if (
          g.title.toLowerCase().includes(q) ||
          g.id.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.type.toLowerCase().includes(q)
        ) {
          results.push({ category: 'guides', id: g.id, name: g.title, description: g.description, icon: '\uD83D\uDCD6' });
        }
      }

      deps.sidebarProvider.sendSearchResults(results);
    })
  );

  // pmcode.openDashboard — open the companion dashboard panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openDashboard', async () => {
      const data = await gatherDashboardData(deps);
      CompanionPanel.show(context.extensionUri, deps.panelManager, data);
      // Signal FTUE "explore" step complete (no-op if already completed)
      void vscode.commands.executeCommand('pmcode.ftue.completeExplore');
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

async function gatherDashboardData(deps: ExtensionDeps): Promise<DashboardData> {
  const config = await deps.configManager.getConfig();
  const connectors = await deps.connectorManager.getConnectors();
  const skills = await deps.skillManager.getInstalledSkills();
  const guides = deps.guideEngine.getGuides();
  const rooConnected = await deps.providerAdapter.detect();

  const guideProgress = new Map<string, import('../panels/panelUtils').GuideProgress>();
  for (const guide of guides) {
    guideProgress.set(guide.id, await deps.guideEngine.getProgress(guide.id));
  }

  return {
    phase: config.ftue.phase,
    ftueCompleted: config.ftue.completed,
    ftueCompletedSteps: config.ftue.completedSteps,
    rooConnected,
    connectors,
    skills,
    guides,
    guideProgress,
    recentlyUsedSkills: config.skills.used,
    dependencies: [],
  };
}
