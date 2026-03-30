import * as vscode from 'vscode';
import type { ExtensionDeps } from '../extension';

/**
 * Register connector commands: install, configure, test, enable, disable, remove.
 */
export function registerConnectorCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  // pmcode.connector.install
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.connector.install', async (id?: string) => {
      if (!id) {
        const connectors = await deps.connectorManager.getConnectors();
        const pick = await vscode.window.showQuickPick(
          connectors.map((c) => ({ label: c.name, description: c.status, id: c.id })),
          { placeHolder: 'Select a connector to install' }
        );
        id = pick?.id;
      }
      if (!id) {
        return;
      }

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Installing ${id}...` },
          async () => {
            // For MCP connectors, installation is implicit (npx handles it).
            // We just open the configuration panel.
            await vscode.commands.executeCommand('pmcode.openConnector', id);
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to install connector: ${message}`);
      }
    })
  );

  // pmcode.connector.configure
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.connector.configure', async (id?: string) => {
      if (!id) {
        const connectors = await deps.connectorManager.getConnectors();
        const pick = await vscode.window.showQuickPick(
          connectors.map((c) => ({ label: c.name, description: c.status, id: c.id })),
          { placeHolder: 'Select a connector to configure' }
        );
        id = pick?.id;
      }
      if (!id) {
        return;
      }

      // Open the connector detail panel which contains the configuration form
      await vscode.commands.executeCommand('pmcode.openConnector', id);
    })
  );

  // pmcode.connector.test
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.connector.test', async (id?: string) => {
      if (!id) {
        const connectors = await deps.connectorManager.getConnectors();
        const pick = await vscode.window.showQuickPick(
          connectors
            .filter((c) => c.status !== 'unconfigured')
            .map((c) => ({ label: c.name, description: c.status, id: c.id })),
          { placeHolder: 'Select a connector to test' }
        );
        id = pick?.id;
      }
      if (!id) {
        return;
      }

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Testing ${id}...` },
        async () => {
          const result = await deps.connectorManager.testConnection(id!);
          if (result.status === 'connected') {
            void vscode.window.showInformationMessage(`${id}: ${result.message}`);
          } else {
            void vscode.window.showWarningMessage(`${id}: ${result.message}`);
          }
        }
      );
    })
  );

  // pmcode.connector.enable
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.connector.enable', async (id?: string) => {
      if (!id) {
        return;
      }
      try {
        await deps.connectorManager.enable(id);
        void vscode.window.showInformationMessage(`${id} connector enabled.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to enable connector: ${message}`);
      }
    })
  );

  // pmcode.connector.disable
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.connector.disable', async (id?: string) => {
      if (!id) {
        return;
      }
      try {
        await deps.connectorManager.disable(id);
        void vscode.window.showInformationMessage(`${id} connector disabled.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to disable connector: ${message}`);
      }
    })
  );

  // pmcode.connector.remove
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.connector.remove', async (id?: string) => {
      if (!id) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove the ${id} connector? This will delete its configuration and credentials.`,
        { modal: true },
        'Remove'
      );

      if (confirm !== 'Remove') {
        return;
      }

      try {
        await deps.connectorManager.remove(id);
        void vscode.window.showInformationMessage(`${id} connector removed.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to remove connector: ${message}`);
      }
    })
  );
}
