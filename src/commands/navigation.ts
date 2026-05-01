import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';
import { SkillsListPanel } from '../panels/SkillsListPanel';
import { ConnectorsListPanel } from '../panels/ConnectorsListPanel';
import { GuidesListPanel } from '../panels/GuidesListPanel';
import { SkillDetailPanel } from '../panels/SkillDetailPanel';
import { ConnectorDetailPanel } from '../panels/ConnectorDetailPanel';
import { GuideDetailPanel } from '../panels/GuideDetailPanel';
import type { ConnectorStatus } from '../panels/panelUtils';

/**
 * Register navigation commands: openSkills, openConnectors, openGuides,
 * openSkill, openConnector, openGuide.
 */
export function registerNavigationCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  // pmcode.openSkills — open the Skills list panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openSkills', async () => {
      const skills = await deps.skillManager.getInstalledSkills();
      SkillsListPanel.show(context.extensionUri, deps.panelManager, skills);
    })
  );

  // pmcode.openConnectors — open the Connectors list panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openConnectors', async () => {
      const connectors = await deps.connectorManager.getConnectors();
      ConnectorsListPanel.show(context.extensionUri, deps.panelManager, connectors);
    })
  );

  // pmcode.openGuides — open the Guides list panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openGuides', async () => {
      const guides = deps.guideEngine.getGuides();
      const progress = new Map<string, import('../panels/panelUtils').GuideProgress>();
      for (const guide of guides) {
        progress.set(guide.id, await deps.guideEngine.getProgress(guide.id));
      }
      GuidesListPanel.show(context.extensionUri, deps.panelManager, guides, progress);
    })
  );

  // pmcode.openSkill — open a specific skill detail panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openSkill', async (id?: string) => {
      if (!id) {
        const skills = await deps.skillManager.getInstalledSkills();
        const pick = await vscode.window.showQuickPick(
          skills.map((s) => ({ label: s.name, description: s.id, id: s.id })),
          { placeHolder: 'Select a skill' }
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

      // Gather connector statuses for the skill's required connectors
      const connectorStatuses = new Map<string, ConnectorStatus>();
      for (const cId of skill.metadata.connectors || []) {
        const status = await deps.connectorManager.getStatus(cId);
        connectorStatuses.set(cId, status);
      }

      SkillDetailPanel.show(context.extensionUri, deps.panelManager, skill, connectorStatuses);
    })
  );

  // pmcode.openConnector — open a specific connector detail panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openConnector', async (id?: string) => {
      if (!id) {
        const connectors = await deps.connectorManager.getConnectors();
        const pick = await vscode.window.showQuickPick(
          connectors.map((c) => ({ label: c.name, description: c.status, id: c.id })),
          { placeHolder: 'Select a connector' }
        );
        id = pick?.id;
      }
      if (!id) {
        return;
      }
      const connector = await deps.connectorManager.getConnector(id);
      if (!connector) {
        void vscode.window.showWarningMessage(`Connector "${id}" not found.`);
        return;
      }

      // Get current field values for the config form
      const currentValues = await deps.connectorManager.getFieldValues(id);

      ConnectorDetailPanel.show(context.extensionUri, deps.panelManager, connector, currentValues);
    })
  );

  // pmcode.openGuide — open a specific guide panel
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.openGuide', async (id?: string) => {
      if (!id) {
        const guides = deps.guideEngine.getGuides();
        const pick = await vscode.window.showQuickPick(
          guides.map((g) => ({ label: g.title, description: `${g.type} · ~${g.estimatedMinutes} min`, id: g.id })),
          { placeHolder: 'Select a guide' }
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

      const progress = await deps.guideEngine.getProgress(id);

      GuideDetailPanel.show(context.extensionUri, deps.panelManager, guide, progress);
    })
  );
}
