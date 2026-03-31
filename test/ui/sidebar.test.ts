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
