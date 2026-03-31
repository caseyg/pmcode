import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';

/**
 * The canonical FTUE step IDs, shared across all three onboarding surfaces:
 * - VS Code walkthrough (package.json completionEvents)
 * - Sidebar Quick Start (SidebarProvider.updateFtueProgress)
 * - Dashboard Quick Start (CompanionPanel companion phase)
 */
export const FTUE_STEPS = ['meetAI', 'connectTool', 'firstPrompt', 'explore'] as const;
export type FtueStepId = (typeof FTUE_STEPS)[number];

/**
 * Update all FTUE surfaces after a state change.
 */
async function syncFtueState(deps: ExtensionDeps): Promise<void> {
  const config = await deps.configManager.getConfig();
  const count = config.ftue.completedSteps.length;

  // Update sidebar progress bar
  deps.sidebarProvider.updateFtueProgress(count, FTUE_STEPS.length);

  // Refresh dashboard if it's open — close and re-open with fresh data
  if (deps.panelManager.has('companion', 'dashboard')) {
    deps.panelManager.closePanel('companion', 'dashboard');
    void vscode.commands.executeCommand('pmcode.openDashboard');
  }
}

/**
 * Mark an FTUE step complete and update all surfaces.
 */
export async function completeFtueStep(
  stepId: FtueStepId,
  deps: ExtensionDeps
): Promise<void> {
  const config = await deps.configManager.getConfig();
  const steps = new Set(config.ftue.completedSteps);

  if (steps.has(stepId)) {
    return; // already completed
  }

  steps.add(stepId);
  const completedSteps = [...steps];
  const allDone = FTUE_STEPS.every((s) => steps.has(s));

  await deps.configManager.updateConfig({
    ftue: {
      completedSteps,
      completed: allDone,
      phase: allDone ? 'command-center' : config.ftue.phase,
    },
  });

  await syncFtueState(deps);
}

/**
 * Mark an FTUE step incomplete and update all surfaces.
 */
export async function uncompleteFtueStep(
  stepId: FtueStepId,
  deps: ExtensionDeps
): Promise<void> {
  const config = await deps.configManager.getConfig();
  const steps = new Set(config.ftue.completedSteps);

  if (!steps.has(stepId)) {
    return; // already not completed
  }

  steps.delete(stepId);
  const completedSteps = [...steps];

  await deps.configManager.updateConfig({
    ftue: {
      completedSteps,
      completed: false,
      phase: 'companion',
    },
  });

  await syncFtueState(deps);
}

/**
 * Register the FTUE walkthrough completion commands.
 *
 * These commands serve double duty:
 * 1. They fire VS Code walkthrough completionEvents (package.json)
 * 2. They persist progress to config.ftue.completedSteps
 */
export function registerFtueCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  // pmcode.openRooSidebar — "Meet your AI assistant" step
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openRooSidebar', async () => {
      try {
        await vscode.commands.executeCommand('roocode.sidebar.focus');
      } catch {
        // Roo Code may not be installed
      }
      await completeFtueStep('meetAI', deps);
    })
  );

  // pmcode.connectorConfigured — "Connect your first tool" step
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.connectorConfigured', async () => {
      await completeFtueStep('connectTool', deps);
    })
  );

  // pmcode.firstPrompt — trigger the first prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.firstPrompt', async () => {
      await vscode.commands.executeCommand(
        'pmcode.sendPrompt',
        'Show me a summary of recent activity across my connected tools.'
      );
    })
  );

  // pmcode.firstPromptSent — marks the firstPrompt step complete
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.firstPromptSent', async () => {
      await completeFtueStep('firstPrompt', deps);
    })
  );

  // pmcode.ftue.completeExplore — marks the explore step complete
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.ftue.completeExplore', async () => {
      await completeFtueStep('explore', deps);
    })
  );

  // pmcode.ftue.toggle — toggle a step complete/incomplete (from dashboard)
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.ftue.toggle', async (stepId?: string) => {
      if (!stepId || !FTUE_STEPS.includes(stepId as FtueStepId)) {
        return;
      }
      const config = await deps.configManager.getConfig();
      if (config.ftue.completedSteps.includes(stepId)) {
        await uncompleteFtueStep(stepId as FtueStepId, deps);
      } else {
        await completeFtueStep(stepId as FtueStepId, deps);
      }
    })
  );
}

/**
 * Send initial FTUE progress to sidebar on startup.
 */
export async function initFtueProgress(deps: ExtensionDeps): Promise<void> {
  const config = await deps.configManager.getConfig();
  const completed = config.ftue.completedSteps.length;
  deps.sidebarProvider.updateFtueProgress(completed, FTUE_STEPS.length);
}
