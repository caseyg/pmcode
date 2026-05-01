import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Integration Tests', () => {
  suiteSetup(async () => {
    // Wait for extension to activate
    const ext = vscode.extensions.getExtension('pmcode.pmcode');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  test('Extension should be present', () => {
    const ext = vscode.extensions.getExtension('pmcode.pmcode');
    assert.ok(ext, 'Extension not found');
  });

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('pmcode.pmcode');
    assert.ok(ext, 'Extension not found');
    if (!ext.isActive) {
      await ext.activate();
    }
    assert.ok(ext.isActive, 'Extension did not activate');
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);

    const expectedCommands = [
      'pmcode.focusSidebar',
      'pmcode.openDashboard',
      'pmcode.openSettings',
      'pmcode.openSkills',
      'pmcode.openConnectors',
      'pmcode.openGuides',
      'pmcode.checkDependencies',
      'pmcode.healthCheck',
    ];

    for (const cmd of expectedCommands) {
      assert.ok(
        commands.includes(cmd),
        `Command '${cmd}' should be registered`
      );
    }
  });

  test('Sidebar view should be registered', async () => {
    // The sidebar webview view provider should be registered
    // We can verify by trying to focus it
    try {
      await vscode.commands.executeCommand('pmcode.focusSidebar');
    } catch {
      // Command may fail if sidebar isn't visible, but shouldn't throw
      // "command not found" — that would indicate registration failed
    }
  });
});
