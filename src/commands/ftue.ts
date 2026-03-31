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
 * Map FTUE step IDs to the walkthrough completion commands.
 * VS Code listens for these via onCommand completionEvents in package.json.
 */
const STEP_TO_WALKTHROUGH_COMMAND: Record<string, string> = {
  meetAI: 'pmcode.openRooSidebar',
  connectTool: 'pmcode.connectorConfigured',
  firstPrompt: 'pmcode.firstPromptSent',
  explore: 'pmcode.ftue.completeExplore',
};

/**
 * Refresh sidebar and dashboard to reflect current FTUE state.
 * Does NOT fire walkthrough commands — that's the caller's job.
 */
async function refreshFtueUI(deps: ExtensionDeps): Promise<void> {
  const config = await deps.configManager.getConfig();
  const count = config.ftue.completedSteps.length;

  // Update sidebar progress bar
  deps.sidebarProvider.updateFtueProgress(count, FTUE_STEPS.length);

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
 * Toggle a step and fire the walkthrough command if completing.
 * This is the entry point for user-initiated toggles (dashboard checkboxes).
 */
async function toggleFtueStep(
  stepId: FtueStepId,
  deps: ExtensionDeps
): Promise<void> {
  const config = await deps.configManager.getConfig();
  const isCompleted = config.ftue.completedSteps.includes(stepId);

  if (isCompleted) {
    await uncompleteFtueStep(stepId, deps);
    // Can't "uncomplete" a VS Code walkthrough step — that's a VS Code limitation
  } else {
    await completeFtueStep(stepId, deps);
    // Fire the walkthrough command so VS Code marks the step done
    const cmd = STEP_TO_WALKTHROUGH_COMMAND[stepId];
    if (cmd) {
      // The command will call completeFtueStep again, but it will no-op
      // because the step is already in completedSteps
      void vscode.commands.executeCommand(cmd);
    }
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
 * Send initial FTUE progress to sidebar on startup.
 * Also fires walkthrough commands for any already-completed steps
 * so the VS Code walkthrough reflects persisted state.
 */
export async function initFtueProgress(deps: ExtensionDeps): Promise<void> {
  const config = await deps.configManager.getConfig();
  const completed = config.ftue.completedSteps.length;
  deps.sidebarProvider.updateFtueProgress(completed, FTUE_STEPS.length);

  // Sync persisted state to VS Code walkthrough
  for (const stepId of config.ftue.completedSteps) {
    const cmd = STEP_TO_WALKTHROUGH_COMMAND[stepId];
    if (cmd) {
      void vscode.commands.executeCommand(cmd);
    }
  }
}
