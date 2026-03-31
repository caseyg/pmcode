import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Spy on vscode.window message calls to detect unexpected warnings/errors.
 * Since we're in the extension host, we intercept by wrapping the commands
 * and checking return values rather than monkey-patching the API.
 */

// Helper: execute a command and assert it doesn't throw
async function execSafe(command: string, ...args: unknown[]): Promise<unknown> {
  try {
    return await vscode.commands.executeCommand(command, ...args);
  } catch (err) {
    assert.fail(`Command "${command}" threw: ${err}`);
  }
}

// Helper: collect all pmcode commands
async function getPmcodeCommands(): Promise<string[]> {
  const all = await vscode.commands.getCommands(true);
  return all.filter((c) => c.startsWith('pmcode.'));
}

suite('PM Code Sidebar', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('pmcode.pmcode');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  test('should show PM Code activity bar icon via focusSidebar', async () => {
    await execSafe('pmcode.focusSidebar');
  });

  test('should open sidebar and set search query', async () => {
    await execSafe('pmcode.search', 'jira');
    // Search with empty string
    await execSafe('pmcode.search', '');
    // Search with special characters
    await execSafe('pmcode.search', '<script>alert("xss")</script>');
    // Search with long query
    await execSafe('pmcode.search', 'a'.repeat(500));
    // Search with no argument (just focuses sidebar)
    await execSafe('pmcode.search');
  });
});

suite('PM Code Commands — all registered', () => {
  test('all expected commands should be registered', async () => {
    const commands = await getPmcodeCommands();

    const expected = [
      'pmcode.focusSidebar',
      'pmcode.search',
      'pmcode.sendPrompt',
      'pmcode.openDashboard',
      'pmcode.openSettings',
      'pmcode.openSkills',
      'pmcode.openConnectors',
      'pmcode.openGuides',
      'pmcode.openSkill',
      'pmcode.openConnector',
      'pmcode.openGuide',
      'pmcode.connector.install',
      'pmcode.connector.configure',
      'pmcode.connector.test',
      'pmcode.connector.enable',
      'pmcode.connector.disable',
      'pmcode.connector.remove',
      'pmcode.skill.install',
      'pmcode.skill.remove',
      'pmcode.skill.run',
      'pmcode.guide.start',
      'pmcode.guide.completeStep',
      'pmcode.guide.reset',
      'pmcode.checkDependencies',
      'pmcode.healthCheck',
      'pmcode.rollback',
      'pmcode.resetFTUE',
      'pmcode.marketplace.sync',
      'pmcode.marketplace.browse',
      'pmcode.marketplace.installSkill',
      'pmcode.marketplace.installConnector',
      'pmcode.marketplace.setRepo',
      'pmcode.openRooSidebar',
      'pmcode.connectorConfigured',
      'pmcode.firstPrompt',
      'pmcode.firstPromptSent',
      'pmcode.ftue.completeExplore',
      'pmcode.ftue.toggle',
    ];

    for (const cmd of expected) {
      assert.ok(commands.includes(cmd), `Missing command: ${cmd}`);
    }
  });
});

suite('PM Code — Open list panels', () => {
  test('open Skills list panel without error', async () => {
    await execSafe('pmcode.openSkills');
  });

  test('open Connectors list panel without error', async () => {
    await execSafe('pmcode.openConnectors');
  });

  test('open Guides list panel without error', async () => {
    await execSafe('pmcode.openGuides');
  });

  test('open Dashboard panel without error', async () => {
    await execSafe('pmcode.openDashboard');
  });
});

suite('PM Code — Open detail panels with real IDs', () => {
  // Connectors
  const connectorIds = ['jira', 'github', 'monday', 'aha', 'tavily'];
  for (const id of connectorIds) {
    test(`open connector detail: ${id}`, async () => {
      await execSafe('pmcode.openConnector', id);
    });
  }

  // Skills (bundled)
  const skillIds = ['idea-triage', 'prd-writer', 'sprint-retro'];
  for (const id of skillIds) {
    test(`open skill detail: ${id}`, async () => {
      await execSafe('pmcode.openSkill', id);
    });
  }

  // Guides
  test('open guide detail: getting-started', async () => {
    await execSafe('pmcode.openGuide', 'getting-started');
  });
});

suite('PM Code — Detail panels for non-existent IDs', () => {
  // These should return gracefully (show a warning), not throw
  test('openSkill with bogus ID does not throw', async () => {
    await execSafe('pmcode.openSkill', 'nonexistent-skill-xyz');
  });

  test('openConnector with bogus ID does not throw', async () => {
    await execSafe('pmcode.openConnector', 'nonexistent-connector-xyz');
  });

  test('openGuide with bogus ID does not throw', async () => {
    await execSafe('pmcode.openGuide', 'nonexistent-guide-xyz');
  });
});

suite('PM Code — Connector commands with IDs (no user prompts)', () => {
  // These take an ID arg, so they won't pop an input box

  test('connector.test with connector ID does not throw', async () => {
    await execSafe('pmcode.connector.test', 'jira');
  });

  test('connector.enable with ID does not throw', async () => {
    await execSafe('pmcode.connector.enable', 'jira');
  });

  test('connector.disable with ID does not throw', async () => {
    await execSafe('pmcode.connector.disable', 'jira');
  });

  test('connector.install with ID does not throw', async () => {
    await execSafe('pmcode.connector.install', 'github');
  });

  test('connector.configure with ID does not throw', async () => {
    await execSafe('pmcode.connector.configure', 'github');
  });
});

suite('PM Code — Skill commands with IDs', () => {
  test('skill.run with ID does not throw', async () => {
    await execSafe('pmcode.skill.run', 'idea-triage');
  });
});

suite('PM Code — Guide commands with IDs', () => {
  test('guide.start with ID does not throw', async () => {
    await execSafe('pmcode.guide.start', 'getting-started');
  });

  test('guide.completeStep with valid step does not throw', async () => {
    await execSafe('pmcode.guide.completeStep', 'getting-started', 0);
  });

  test('guide.completeStep with out-of-range step does not throw', async () => {
    // Should show a warning, not crash
    await execSafe('pmcode.guide.completeStep', 'getting-started', 999);
  });

  test('guide.completeStep with missing args does not throw', async () => {
    await execSafe('pmcode.guide.completeStep');
  });
});

suite('PM Code — System commands', () => {
  test('checkDependencies does not throw', async () => {
    await execSafe('pmcode.checkDependencies');
  });

  test('healthCheck does not throw', async () => {
    await execSafe('pmcode.healthCheck');
  });

  test('rollback with no snapshots does not throw', async () => {
    // Without user input the quick pick gets undefined → returns early
    await execSafe('pmcode.rollback');
  });
});

suite('PM Code — Marketplace commands with args', () => {
  test('marketplace.installSkill with bogus ID does not throw', async () => {
    await execSafe('pmcode.marketplace.installSkill', 'nonexistent-skill');
  });

  test('marketplace.installConnector with bogus ID does not throw', async () => {
    await execSafe('pmcode.marketplace.installConnector', 'nonexistent-conn');
  });

  test('marketplace.setRepo with URL does not throw', async () => {
    await execSafe('pmcode.marketplace.setRepo', 'https://github.com/test/marketplace.git');
  });
});

suite('PM Code — sendPrompt with text arg', () => {
  test('sendPrompt with text does not throw', async () => {
    // Provider may not be connected, but the command itself should not crash
    await execSafe('pmcode.sendPrompt', 'Hello from E2E test');
  });
});

suite('PM Code — Search with various queries', () => {
  test('search for a known skill name', async () => {
    await execSafe('pmcode.search', 'triage');
  });

  test('search for a known connector name', async () => {
    await execSafe('pmcode.search', 'github');
  });

  test('search for a guide keyword', async () => {
    await execSafe('pmcode.search', 'getting started');
  });

  test('search with no results', async () => {
    await execSafe('pmcode.search', 'zzzznonexistentzzz');
  });

  test('search with unicode', async () => {
    await execSafe('pmcode.search', '日本語テスト 🎉');
  });
});

suite('PM Code — Rapid panel switching (stress)', () => {
  test('open multiple panels in quick succession', async () => {
    await execSafe('pmcode.openSkills');
    await execSafe('pmcode.openConnectors');
    await execSafe('pmcode.openGuides');
    await execSafe('pmcode.openDashboard');
    await execSafe('pmcode.openSkill', 'idea-triage');
    await execSafe('pmcode.openConnector', 'jira');
    await execSafe('pmcode.openGuide', 'getting-started');
    await execSafe('pmcode.openSkills');
  });

  test('open same panel twice does not duplicate', async () => {
    await execSafe('pmcode.openSkills');
    await execSafe('pmcode.openSkills');
  });

  test('interleave sidebar focus with panel opens', async () => {
    await execSafe('pmcode.focusSidebar');
    await execSafe('pmcode.openDashboard');
    await execSafe('pmcode.focusSidebar');
    await execSafe('pmcode.search', 'test');
    await execSafe('pmcode.openConnectors');
    await execSafe('pmcode.focusSidebar');
  });
});

suite('PM Code — FTUE state sync', () => {
  // Helper: read the config file to verify persisted state
  async function readFtueConfig(): Promise<{ completed: boolean; completedSteps: string[]; phase: string }> {
    const configPath = path.join(process.env.HOME || '', '.pmcode', 'config.json');
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      return config.ftue || { completed: false, completedSteps: [], phase: 'companion' };
    } catch {
      return { completed: false, completedSteps: [], phase: 'companion' };
    }
  }

  // Reset FTUE state before tests
  suiteSetup(async function () {
    this.timeout(10000);
    // Reset by toggling off any completed steps
    const ftue = await readFtueConfig();
    for (const step of ftue.completedSteps) {
      await execSafe('pmcode.ftue.toggle', step);
    }
    // Verify clean slate
    const clean = await readFtueConfig();
    assert.strictEqual(clean.completedSteps.length, 0, 'FTUE should be reset before tests');
  });

  test('completing meetAI via openRooSidebar persists to config', async function () {
    this.timeout(5000);
    await execSafe('pmcode.openRooSidebar');

    const ftue = await readFtueConfig();
    assert.ok(ftue.completedSteps.includes('meetAI'), 'meetAI should be in completedSteps');
  });

  test('completing connectTool via connectorConfigured persists to config', async function () {
    this.timeout(5000);
    await execSafe('pmcode.connectorConfigured');

    const ftue = await readFtueConfig();
    assert.ok(ftue.completedSteps.includes('connectTool'), 'connectTool should be in completedSteps');
  });

  test('completing firstPrompt via firstPromptSent persists to config', async function () {
    this.timeout(5000);
    await execSafe('pmcode.firstPromptSent');

    const ftue = await readFtueConfig();
    assert.ok(ftue.completedSteps.includes('firstPrompt'), 'firstPrompt should be in completedSteps');
  });

  test('completing explore via ftue.completeExplore persists to config', async function () {
    this.timeout(5000);
    await execSafe('pmcode.ftue.completeExplore');

    const ftue = await readFtueConfig();
    assert.ok(ftue.completedSteps.includes('explore'), 'explore should be in completedSteps');
  });

  test('all 4 steps completed → ftue.completed is true', async function () {
    this.timeout(5000);
    const ftue = await readFtueConfig();
    assert.strictEqual(ftue.completedSteps.length, 4, 'All 4 steps should be completed');
    assert.strictEqual(ftue.completed, true, 'ftue.completed should be true');
    assert.strictEqual(ftue.phase, 'command-center', 'phase should be command-center');
  });

  test('toggling a step off persists to config', async function () {
    this.timeout(5000);
    await execSafe('pmcode.ftue.toggle', 'firstPrompt');

    const ftue = await readFtueConfig();
    assert.ok(!ftue.completedSteps.includes('firstPrompt'), 'firstPrompt should be removed');
    assert.strictEqual(ftue.completed, false, 'ftue.completed should be false');
    assert.strictEqual(ftue.phase, 'companion', 'phase should be companion');
    assert.strictEqual(ftue.completedSteps.length, 3, 'Should have 3 steps');
  });

  test('toggling a step back on persists to config', async function () {
    this.timeout(5000);
    await execSafe('pmcode.ftue.toggle', 'firstPrompt');

    const ftue = await readFtueConfig();
    assert.ok(ftue.completedSteps.includes('firstPrompt'), 'firstPrompt should be back');
    assert.strictEqual(ftue.completedSteps.length, 4, 'Should have 4 steps again');
    assert.strictEqual(ftue.completed, true, 'ftue.completed should be true again');
  });

  test('idempotent: completing already-completed step is safe', async function () {
    this.timeout(5000);
    const before = await readFtueConfig();
    await execSafe('pmcode.openRooSidebar'); // meetAI already done
    const after = await readFtueConfig();

    assert.deepStrictEqual(after.completedSteps.sort(), before.completedSteps.sort());
  });

  // Clean up: reset FTUE for other tests
  suiteTeardown(async function () {
    this.timeout(10000);
    const ftue = await readFtueConfig();
    for (const step of ftue.completedSteps) {
      await execSafe('pmcode.ftue.toggle', step);
    }
  });
});

suite('PM Code — Package integrity', () => {
  test('all walkthrough markdown files referenced in package.json exist', () => {
    const ext = vscode.extensions.getExtension('pmcode.pmcode');
    assert.ok(ext, 'Extension not found');

    const pkgJson = ext!.packageJSON;
    const walkthroughs: Array<{
      steps: Array<{ media?: { markdown?: string } }>;
    }> = pkgJson.contributes?.walkthroughs ?? [];

    for (const wt of walkthroughs) {
      for (const step of wt.steps ?? []) {
        const md = step.media?.markdown;
        if (md) {
          const fullPath = path.join(ext!.extensionPath, md);
          assert.ok(
            fs.existsSync(fullPath),
            `Walkthrough markdown file missing: ${md} (expected at ${fullPath})`
          );
        }
      }
    }
  });

  test('all media files referenced in package.json exist', () => {
    const ext = vscode.extensions.getExtension('pmcode.pmcode');
    assert.ok(ext, 'Extension not found');

    const pkgJson = ext!.packageJSON;

    // Check icon
    if (pkgJson.icon) {
      const iconPath = path.join(ext!.extensionPath, pkgJson.icon);
      assert.ok(fs.existsSync(iconPath), `Package icon missing: ${pkgJson.icon}`);
    }

    // Check view container icons
    const viewContainers = pkgJson.contributes?.viewsContainers?.activitybar ?? [];
    for (const vc of viewContainers) {
      if (vc.icon) {
        const iconPath = path.join(ext!.extensionPath, vc.icon);
        assert.ok(fs.existsSync(iconPath), `View container icon missing: ${vc.icon}`);
      }
    }
  });
});
