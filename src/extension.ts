import * as vscode from 'vscode';
import { ConfigManager } from './config/ConfigManager';
import { EnvManager } from './config/EnvManager';
import { ConfigVersioning } from './config/ConfigVersioning';
import { RooCodeAdapter } from './providers/RooCodeAdapter';
import { ConnectorManager } from './connectors/ConnectorManager';
import { SkillManager } from './skills/SkillManager';
import { GuideEngine } from './guides/GuideEngine';
import { SidebarProvider } from './sidebar/SidebarProvider';
import { PanelManager } from './panels/PanelManager';
import { DependencyChecker } from './system/DependencyChecker';
import { ProviderAdapter } from './providers/ProviderAdapter';

import { registerCoreCommands } from './commands/core';
import { registerNavigationCommands } from './commands/navigation';
import { registerConnectorCommands } from './commands/connectors';
import { registerSkillCommands } from './commands/skills';
import { registerGuideCommands } from './commands/guides';
import { registerSystemCommands } from './commands/system';
import { registerMarketplaceCommands } from './commands/marketplace';
import { MarketplaceRegistry } from './marketplace/MarketplaceRegistry';

// ── Shared dependency bag passed to all command registration functions ──────

export interface ExtensionDeps {
  configManager: ConfigManager;
  envManager: EnvManager;
  configVersioning: ConfigVersioning;
  providerAdapter: ProviderAdapter;
  connectorManager: ConnectorManager;
  skillManager: SkillManager;
  guideEngine: GuideEngine;
  sidebarProvider: SidebarProvider;
  panelManager: PanelManager;
  marketplace: MarketplaceRegistry;
}

// ── Activation ─────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 1. Core infrastructure
  const configManager = new ConfigManager(context);
  await configManager.ensureDirectoryStructure();

  const envManager = new EnvManager();
  const configVersioning = new ConfigVersioning(configManager, envManager);

  // 2. Provider adapter (Roo Code for MVP)
  const providerAdapter = new RooCodeAdapter();

  // 3. Domain managers
  const connectorManager = new ConnectorManager(envManager, providerAdapter);
  const skillManager = new SkillManager(context);
  const guideEngine = new GuideEngine();
  const marketplace = new MarketplaceRegistry();

  // 4. UI components
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  const panelManager = new PanelManager(context.extensionUri);

  // Register the sidebar webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  // 5. Build the dependency bag
  const deps: ExtensionDeps = {
    configManager,
    envManager,
    configVersioning,
    providerAdapter,
    connectorManager,
    skillManager,
    guideEngine,
    sidebarProvider,
    panelManager,
    marketplace,
  };

  // 6. Register all commands
  registerCoreCommands(context, deps);
  registerNavigationCommands(context, deps);
  registerConnectorCommands(context, deps);
  registerSkillCommands(context, deps);
  registerGuideCommands(context, deps);
  registerSystemCommands(context, deps);
  registerMarketplaceCommands(context, deps);

  // 7. Background startup tasks (deferred, non-blocking)
  setTimeout(() => {
    void runBackgroundStartup(deps, context);
  }, 500);
}

// ── Deactivation ───────────────────────────────────────────────────────────

export function deactivate(): void {
  // Cleanup is handled via context.subscriptions and panel dispose handlers.
  // Nothing additional needed.
}

// ── Background startup ─────────────────────────────────────────────────────

async function runBackgroundStartup(
  deps: ExtensionDeps,
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    // Check if this is the first activation (auto-open walkthrough)
    const config = await deps.configManager.getConfig();
    if (!config.ftue.completed && config.ftue.completedSteps.length === 0) {
      // First install: open the VS Code walkthrough
      void vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'pmcode.pmcode#pmcode.gettingStarted',
        false
      );
    }

    // Run dependency check in background
    const checker = new DependencyChecker();
    const depResults = await checker.checkAll();
    const allReady = depResults.every((d) => d.installed);

    if (!allReady) {
      const missing = depResults.filter((d) => !d.installed);
      console.log(
        `PM Code: ${missing.length} dependencies not found:`,
        missing.map((d) => d.id).join(', ')
      );
    }

    // Detect Roo Code and update sidebar status
    const rooDetected = await deps.providerAdapter.detect();
    deps.sidebarProvider.updateStatus(rooDetected);

    // Update sidebar counts
    const skills = await deps.skillManager.getInstalledSkills();
    const connectors = await deps.connectorManager.getConnectors();
    const guides = deps.guideEngine.getGuides();
    deps.sidebarProvider.updateCounts(skills.length, connectors.length, guides.length);

    // Update marketplace status in sidebar
    try {
      const mpStatus = await deps.marketplace.getStatus();
      deps.sidebarProvider.updateMarketplaceStatus(mpStatus);
    } catch {
      // Marketplace not yet cloned — that's fine
    }
  } catch (err) {
    console.warn('PM Code: Background startup error:', err);
  }
}
