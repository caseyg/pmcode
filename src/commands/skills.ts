import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';

/**
 * Register skill commands: install, remove, run.
 */
export function registerSkillCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  // pmcode.skill.install
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.skill.install', async (id?: string) => {
      if (!id) {
        id = await vscode.window.showInputBox({
          prompt: 'Enter skill id to install (e.g., idea-triage)',
        });
      }
      if (!id) {
        return;
      }

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Installing skill ${id}...` },
          async () => {
            await deps.skillManager.installSkill(id!);
          }
        );
        void vscode.window.showInformationMessage(`Skill "${id}" installed.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to install skill: ${message}`);
      }
    })
  );

  // pmcode.skill.remove
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.skill.remove', async (id?: string) => {
      if (!id) {
        const skills = await deps.skillManager.getInstalledSkills();
        const pick = await vscode.window.showQuickPick(
          skills.map((s) => ({ label: s.name, description: s.id, id: s.id })),
          { placeHolder: 'Select a skill to remove' }
        );
        id = pick?.id;
      }
      if (!id) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove the "${id}" skill?`,
        { modal: true },
        'Remove'
      );

      if (confirm !== 'Remove') {
        return;
      }

      try {
        await deps.skillManager.removeSkill(id);
        void vscode.window.showInformationMessage(`Skill "${id}" removed.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to remove skill: ${message}`);
      }
    })
  );

  // pmcode.skill.run — run a skill by injecting its first prompt into the AI provider
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.skill.run', async (id?: string) => {
      if (!id) {
        const skills = await deps.skillManager.getInstalledSkills();
        const pick = await vscode.window.showQuickPick(
          skills.map((s) => ({ label: s.name, description: s.description, id: s.id })),
          { placeHolder: 'Select a skill to run' }
        );
        id = pick?.id;
      }
      if (!id) {
        return;
      }

      const skill = await deps.skillManager.getSkill(id);
      if (!skill) {
        void vscode.window.showWarningMessage(`Skill "${id}" not found.`);
        return;
      }

      // Extract the first actionable prompt from the skill instructions.
      // The instructions contain markdown; we use the description as the prompt.
      const promptText = skill.description
        ? `Use the "${skill.name}" skill: ${skill.description}`
        : `Run the "${skill.name}" skill.`;

      await vscode.commands.executeCommand('pmcode.sendPrompt', promptText);
    })
  );
}
