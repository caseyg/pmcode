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
 * Sync all context keys to match the current FTUE state.
 * VS Code walkthrough uses `onContext:pmcode.ftue.<stepId>` completionEvents
 * which re-evaluate whenever the context key changes.
 * Setting to true checks the step, false unchecks it.
 */
async function syncWalkthroughContext(completedSteps: string[]): Promise<void> {
  const completed = new Set(completedSteps);
  for (const stepId of FTUE_STEPS) {
    void vscode.commands.executeCommand('setContext', `pmcode.ftue.${stepId}`, completed.has(stepId));
  }
}

/**
 * Refresh sidebar, dashboard, and walkthrough to reflect current FTUE state.
 */
async function refreshFtueUI(deps: ExtensionDeps): Promise<void> {
  const config = await deps.configManager.getConfig();
  const count = config.ftue.completedSteps.length;

  // Update sidebar progress bar
  deps.sidebarProvider.updateFtueProgress(count, FTUE_STEPS.length);

  // Update walkthrough context keys
  await syncWalkthroughContext(config.ftue.completedSteps);

  // Refresh dashboard if it's open
  if (deps.panelManager.has('companion', 'dashboard')) {
    deps.panelManager.closePanel('companion', 'dashboard');
    void vscode.commands.executeCommand('pmcode.openDashboard');
  }
}

/**
 * Mark an FTUE step complete and update all surfaces.
 * Called from walkthrough commands — does NOT re-fire walkthrough commands.
 */
export async function completeFtueStep(
  stepId: FtueStepId,
  deps: ExtensionDeps
): Promise<void> {
  const config = await deps.configManager.getConfig();
  const steps = new Set(config.ftue.completedSteps);

  if (steps.has(stepId)) {
    return; // already completed — no-op
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

  await refreshFtueUI(deps);
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
    return; // already not completed — no-op
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

  await refreshFtueUI(deps);
}

/**
 * Toggle a step complete/incomplete.
 * Entry point for user-initiated toggles (dashboard checkboxes).
 */
async function toggleFtueStep(
  stepId: FtueStepId,
  deps: ExtensionDeps
): Promise<void> {
  const config = await deps.configManager.getConfig();
  const isCompleted = config.ftue.completedSteps.includes(stepId);

  if (isCompleted) {
    await uncompleteFtueStep(stepId, deps);
  } else {
    await completeFtueStep(stepId, deps);
  }
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

  // pmcode.ftue.toggle — toggle a step from the dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.ftue.toggle', async (stepId?: string) => {
      if (!stepId || !FTUE_STEPS.includes(stepId as FtueStepId)) {
        return;
      }
      await toggleFtueStep(stepId as FtueStepId, deps);
    })
  );
}

/**
 * Send initial FTUE progress to sidebar and walkthrough on startup.
 */
export async function initFtueProgress(deps: ExtensionDeps): Promise<void> {
  const config = await deps.configManager.getConfig();
  deps.sidebarProvider.updateFtueProgress(config.ftue.completedSteps.length, FTUE_STEPS.length);
  await syncWalkthroughContext(config.ftue.completedSteps);
}
