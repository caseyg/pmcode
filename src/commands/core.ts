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
    vscode.commands.registerCommand('pmcode.openDashboard', async () => {
      const data = await gatherDashboardData(deps);
      CompanionPanel.show(context.extensionUri, deps.panelManager, data);
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
