import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerMarketplaceCommands } from '../../src/commands/marketplace';

const { _createMockContext } = vscode as any;

function createMockDeps() {
  return {
    marketplace: {
      sync: vi.fn(async () => true),
      isCloned: vi.fn(async () => false),
      getManifest: vi.fn(async () => ({ version: '1.0', skills: [{ id: 's1' }], connectors: [] })),
      getAvailableSkills: vi.fn(async () => []),
      getAvailableConnectors: vi.fn(async () => []),
      installSkill: vi.fn(async () => '/mock/path'),
      installConnector: vi.fn(async () => '/mock/path'),
      isSkillInstalled: vi.fn(async () => false),
      getStatus: vi.fn(async () => ({ available: true, lastUpdated: null, repoUrl: 'https://example.com', manifestVersion: '1.0', skillCount: 1, connectorCount: 0 })),
      getRepoUrl: vi.fn(() => 'https://github.com/anthropics/knowledge-work-plugins.git'),
      setRepoUrl: vi.fn(),
    },
    skillManager: {
      getInstalledSkills: vi.fn(async () => []),
      refresh: vi.fn(),
    },
    connectorManager: {
      getConnectors: vi.fn(async () => []),
    },
    guideEngine: {
      getGuides: vi.fn(() => []),
    },
    sidebarProvider: {
      updateCounts: vi.fn(),
      updateMarketplaceStatus: vi.fn(),
    },
    panelManager: {
      openPanel: vi.fn(() => ({
        webview: { html: '', onDidReceiveMessage: vi.fn(() => ({ dispose: () => {} })) },
      })),
    },
    configManager: {
      updateConfig: vi.fn(async () => {}),
    },
  } as any;
}

describe('marketplace commands', () => {
  let context: any;
  let deps: any;
  let commands: Map<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.clearAllMocks();
    context = _createMockContext();
    deps = createMockDeps();
    commands = new Map();

    vi.mocked(vscode.commands.registerCommand).mockImplementation(
      (id: string, cb: (...args: any[]) => any) => {
        commands.set(id, cb);
        return { dispose: () => {} };
      }
    );

    registerMarketplaceCommands(context, deps);
  });

  it('registers all marketplace commands', () => {
    expect(commands.has('pmcode.marketplace.sync')).toBe(true);
    expect(commands.has('pmcode.marketplace.browse')).toBe(true);
    expect(commands.has('pmcode.marketplace.installSkill')).toBe(true);
    expect(commands.has('pmcode.marketplace.installConnector')).toBe(true);
    expect(commands.has('pmcode.marketplace.setRepo')).toBe(true);
  });

  describe('marketplace.sync', () => {
    it('calls marketplace.sync and shows success', async () => {
      await commands.get('pmcode.marketplace.sync')!();

      expect(deps.marketplace.sync).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('updated')
      );
    });

    it('shows up-to-date message when no changes', async () => {
      deps.marketplace.sync.mockResolvedValue(false);
      await commands.get('pmcode.marketplace.sync')!();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('up to date')
      );
    });

    it('shows git auth guidance on auth failure', async () => {
      deps.marketplace.sync.mockRejectedValue(new Error('could not read Username for'));
      vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);

      await commands.get('pmcode.marketplace.sync')!();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Git authentication'),
        'Run gh auth login',
        'Open Terminal',
        'Cancel'
      );
    });

    it('opens terminal when user picks "Run gh auth login"', async () => {
      deps.marketplace.sync.mockRejectedValue(new Error('could not read Username'));
      vi.mocked(vscode.window.showErrorMessage).mockResolvedValue('Run gh auth login' as any);

      const mockTerminal = { show: vi.fn(), sendText: vi.fn() };
      vi.mocked(vscode.window.createTerminal).mockReturnValue(mockTerminal as any);

      await commands.get('pmcode.marketplace.sync')!();

      expect(vscode.window.createTerminal).toHaveBeenCalled();
      expect(mockTerminal.sendText).toHaveBeenCalledWith('gh auth login');
    });

    it('shows generic error for non-auth failures', async () => {
      deps.marketplace.sync.mockRejectedValue(new Error('network timeout'));

      await commands.get('pmcode.marketplace.sync')!();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Marketplace sync failed')
      );
    });
  });

  describe('marketplace.installSkill', () => {
    it('installs skill and shows success', async () => {
      await commands.get('pmcode.marketplace.installSkill')!('write-spec');

      expect(deps.marketplace.installSkill).toHaveBeenCalledWith('write-spec');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('installed')
      );
    });

    it('returns early with no skill ID', async () => {
      await commands.get('pmcode.marketplace.installSkill')!();

      expect(deps.marketplace.installSkill).not.toHaveBeenCalled();
    });
  });

  describe('marketplace.installConnector', () => {
    it('returns early with no connector ID', async () => {
      await commands.get('pmcode.marketplace.installConnector')!();
      // Should not throw or call install
    });
  });

  describe('marketplace.setRepo', () => {
    it('sets repo URL and persists to config', async () => {
      await commands.get('pmcode.marketplace.setRepo')!('https://github.com/test/repo.git');

      expect(deps.marketplace.setRepoUrl).toHaveBeenCalledWith('https://github.com/test/repo.git');
      expect(deps.configManager.updateConfig).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Marketplace repo set')
      );
    });

    it('shows input box when no URL provided', async () => {
      vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
      await commands.get('pmcode.marketplace.setRepo')!();

      expect(vscode.window.showInputBox).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringContaining('repo URL') })
      );
    });
  });
});
