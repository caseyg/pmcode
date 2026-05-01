import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';

/**
 * Register guide commands: start, completeStep, reset.
 */
export function registerGuideCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  // pmcode.guide.start — start or resume a guide
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.guide.start', async (id?: string) => {
      if (!id) {
        const guides = deps.guideEngine.getGuides();
        const pick = await vscode.window.showQuickPick(
          guides.map((g) => ({
            label: g.title,
            description: `${g.type} - ~${g.estimatedMinutes} min`,
            id: g.id,
          })),
          { placeHolder: 'Select a guide to start' }
        );
        id = pick?.id;
      }
      if (!id) {
        return;
      }

      const guide = deps.guideEngine.getGuide(id);
      if (!guide) {
        void vscode.window.showWarningMessage(`Guide "${id}" not found.`);
        return;
      }

      // Track that the guide has been started
      const progress = await deps.guideEngine.getProgress(id);
      if (!progress.startedAt) {
        await deps.guideEngine.completeStep(id, -1); // triggers startedAt without marking any step
        // Reset: the -1 step trick just sets startedAt. Let's use a cleaner approach:
        // Actually just open the guide panel, the progress is initialized on first completeStep.
      }

      // Open the guide detail panel
      await vscode.commands.executeCommand('pmcode.openGuide', id);
    })
  );

  // pmcode.guide.completeStep — mark a step as completed
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'pmcode.guide.completeStep',
      async (guideId?: string, step?: number) => {
        if (!guideId || step === undefined) {
          void vscode.window.showWarningMessage(
            'Usage: pmcode.guide.completeStep requires a guide id and step number.'
          );
          return;
        }

        const guide = deps.guideEngine.getGuide(guideId);
        if (!guide) {
          void vscode.window.showWarningMessage(`Guide "${guideId}" not found.`);
          return;
        }

        if (step < 0 || step >= guide.steps.length) {
          void vscode.window.showWarningMessage(
            `Step ${step} is out of range for guide "${guideId}" (0-${guide.steps.length - 1}).`
          );
          return;
        }

        await deps.guideEngine.completeStep(guideId, step);

        // Check if all steps are now complete
        const progress = await deps.guideEngine.getProgress(guideId);
        if (progress.completedSteps.length === guide.steps.length) {
          void vscode.window.showInformationMessage(
            `Congratulations! You completed "${guide.title}".`
          );
        }
      }
    )
  );

  // pmcode.guide.reset — reset guide progress
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.guide.reset', async (id?: string) => {
      if (!id) {
        const guides = deps.guideEngine.getGuides();
        const pick = await vscode.window.showQuickPick(
          guides.map((g) => ({ label: g.title, id: g.id })),
          { placeHolder: 'Select a guide to reset' }
        );
        id = pick?.id;
      }
      if (!id) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Reset progress for this guide? You will start from the beginning.`,
        { modal: true },
        'Reset'
      );

      if (confirm !== 'Reset') {
        return;
      }

      await deps.guideEngine.resetProgress(id);
      void vscode.window.showInformationMessage('Guide progress has been reset.');
    })
  );
}
