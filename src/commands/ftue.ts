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
 * Mark an FTUE step complete and update all three surfaces.
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

  // Update sidebar progress
  deps.sidebarProvider.updateFtueProgress(completedSteps.length, FTUE_STEPS.length);
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
  // Opens the Roo Code sidebar and marks meetAI complete
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openRooSidebar', async () => {
      // Try to open Roo Code sidebar
      try {
        await vscode.commands.executeCommand('roocode.sidebar.focus');
      } catch {
        // Roo Code may not be installed — that's OK
      }
      await completeFtueStep('meetAI', deps);
    })
  );

  // pmcode.connectorConfigured — "Connect your first tool" step
  // Fired after a connector is successfully configured
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.connectorConfigured', async () => {
      await completeFtueStep('connectTool', deps);
    })
  );

  // pmcode.firstPrompt — "Try talking to your AI" step (trigger)
  // Sends the first prompt and fires the completion event
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.firstPrompt', async () => {
      await vscode.commands.executeCommand(
        'pmcode.sendPrompt',
        'Show me a summary of recent activity across my connected tools.'
      );
      // firstPromptSent is fired separately after the prompt is actually sent
    })
  );

  // pmcode.firstPromptSent — marks the firstPrompt step complete
  // Called after any prompt is successfully sent during FTUE
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.firstPromptSent', async () => {
      await completeFtueStep('firstPrompt', deps);
    })
  );

  // Mark "explore" complete when the dashboard is opened (after FTUE)
  // This is handled by the onView:pmcode.dashboard completionEvent in package.json,
  // but we also fire it explicitly when opening the dashboard:
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.ftue.completeExplore', async () => {
      await completeFtueStep('explore', deps);
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
