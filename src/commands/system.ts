import * as vscode from 'vscode';
import { DependencyChecker } from '../system/DependencyChecker';
import type { ExtensionDeps } from '../extension';

/**
 * Register system commands: checkDependencies, healthCheck, rollback, resetFTUE.
 */
export function registerSystemCommands(
  context: vscode.ExtensionContext,
  deps: ExtensionDeps
): void {
  const dependencyChecker = new DependencyChecker();

  // pmcode.checkDependencies — run system dependency check
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.checkDependencies', async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Checking system dependencies...',
          cancellable: false,
        },
        async (progress) => {
          const results = await dependencyChecker.checkAll();

          const installed = results.filter((d) => d.installed);
          const missing = results.filter((d) => !d.installed);

          progress.report({ increment: 100 });

          // Show results
          const lines: string[] = [];
          for (const dep of installed) {
            lines.push(`$(check) ${dep.label}${dep.version ? ` (${dep.version})` : ''}`);
          }
          for (const dep of missing) {
            lines.push(`$(x) ${dep.label} — install with: ${dep.installCommand ?? 'see documentation'}`);
          }

          if (missing.length === 0) {
            void vscode.window.showInformationMessage(
              `All ${installed.length} dependencies are ready.`
            );
          } else {
            const detail = missing
              .map(
                (d) =>
                  `${d.label}: ${d.installCommand ?? 'manual installation required'}`
              )
              .join('\n');

            void vscode.window.showWarningMessage(
              `${missing.length} missing dependency${missing.length > 1 ? 'ies' : 'y'}. ${installed.length} ready.`,
              { detail, modal: false },
              'Show Details'
            );
          }
        }
      );
    })
  );

  // pmcode.healthCheck — check all connector health
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.healthCheck', async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Running health check...',
          cancellable: false,
        },
        async () => {
          const connectors = await deps.connectorManager.getConnectors();
          const results: Array<{ name: string; status: string; message: string }> = [];

          for (const connector of connectors) {
            if (connector.status === 'unconfigured') {
              results.push({
                name: connector.name,
                status: 'unconfigured',
                message: 'Not configured yet',
              });
              continue;
            }

            const testResult = await deps.connectorManager.testConnection(connector.id);
            results.push({
              name: connector.name,
              status: testResult.status,
              message: testResult.message,
            });
          }

          const healthy = results.filter((r) => r.status === 'connected');
          const unhealthy = results.filter(
            (r) => r.status !== 'connected' && r.status !== 'unconfigured'
          );

          if (unhealthy.length === 0) {
            void vscode.window.showInformationMessage(
              `Health check complete: ${healthy.length} connector${healthy.length !== 1 ? 's' : ''} healthy.`
            );
          } else {
            const detail = unhealthy
              .map((r) => `${r.name}: ${r.message}`)
              .join('\n');

            void vscode.window.showWarningMessage(
              `${unhealthy.length} connector${unhealthy.length !== 1 ? 's' : ''} need attention.`,
              { detail, modal: false }
            );
          }
        }
      );
    })
  );

  // pmcode.rollback — rollback config to previous state
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.rollback', async () => {
      const snapshots = await deps.configVersioning.listSnapshots();

      if (snapshots.length === 0) {
        void vscode.window.showInformationMessage('No configuration snapshots available for rollback.');
        return;
      }

      const pick = await vscode.window.showQuickPick(
        snapshots.slice(0, 10).map((s) => ({
          label: formatTimestamp(s.timestamp),
          description: `${s.envKeys.length} tokens configured`,
          timestamp: s.timestamp,
        })),
        { placeHolder: 'Select a snapshot to rollback to' }
      );

      if (!pick) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Rollback configuration to ${pick.label}? A snapshot of the current state will be saved first.`,
        { modal: true },
        'Rollback'
      );

      if (confirm !== 'Rollback') {
        return;
      }

      try {
        await deps.configVersioning.rollback(pick.timestamp);
        void vscode.window.showInformationMessage('Configuration rolled back successfully.');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Rollback failed: ${message}`);
      }
    })
  );

  // pmcode.resetFTUE — reset first-time user experience
  context.subscriptions.push(
    vscode.commands.registerCommand('pmcode.resetFTUE', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Reset the first-time experience? This will re-show the walkthrough and Quick Start.',
        { modal: true },
        'Reset'
      );

      if (confirm !== 'Reset') {
        return;
      }

      try {
        await deps.configManager.updateConfig({
          ftue: {
            completed: false,
            completedSteps: [],
            phase: 'companion',
          },
        });

        void vscode.window.showInformationMessage(
          'First-time experience has been reset. It will appear on next activation.'
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to reset FTUE: ${message}`);
      }
    })
  );
}

function formatTimestamp(ts: string): string {
  // Snapshot timestamps look like: 2026-03-30T10-00-00-000Z
  try {
    const restored = ts.replace(/-/g, (match, offset: number) => {
      // First two dashes are date separators, keep them; replace the rest
      if (offset === 4 || offset === 7) {
        return '-';
      }
      if (offset === 10) {
        return 'T';
      }
      return ':';
    });
    const date = new Date(restored);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  } catch {
    // Fall through
  }
  return ts;
}
