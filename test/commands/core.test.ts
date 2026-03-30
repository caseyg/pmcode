import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerCoreCommands } from '../../src/commands/core';

// Extract the vscode mock helpers
const { _createMockContext } = vscode as any;

function createMockDeps() {
  return {
    providerAdapter: {
      injectPrompt: vi.fn(async () => {}),
      detect: vi.fn(async () => true),
    },
    sidebarProvider: {
      focus: vi.fn(),
      setSearchQuery: vi.fn(),
      updateCounts: vi.fn(),
      updateStatus: vi.fn(),
    },
    panelManager: {
      openPanel: vi.fn(() => ({
        webview: { html: '', onDidReceiveMessage: vi.fn() },
        dispose: vi.fn(),
        reveal: vi.fn(),
        onDidDispose: vi.fn(),
      })),
    },
    configManager: {},
    envManager: {},
    configVersioning: {},
    connectorManager: {},
    skillManager: {},
    guideEngine: {},
  } as any;
}

describe('core commands', () => {
  let context: any;
  let deps: any;
  let registeredCommands: Map<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.clearAllMocks();
    context = _createMockContext();
    deps = createMockDeps();
    registeredCommands = new Map();

    // Capture registered commands
    vi.mocked(vscode.commands.registerCommand).mockImplementation(
      (id: string, cb: (...args: any[]) => any) => {
        registeredCommands.set(id, cb);
        return { dispose: () => {} };
      }
    );

    registerCoreCommands(context, deps);
  });

  it('all commands register without errors', () => {
    expect(registeredCommands.has('pmcode.sendPrompt')).toBe(true);
    expect(registeredCommands.has('pmcode.focusSidebar')).toBe(true);
    expect(registeredCommands.has('pmcode.search')).toBe(true);
    expect(registeredCommands.has('pmcode.openDashboard')).toBe(true);
    expect(registeredCommands.has('pmcode.openSettings')).toBe(true);
    expect(context.subscriptions.length).toBe(5);
  });

  it('sendPrompt calls providerAdapter.injectPrompt', async () => {
    const handler = registeredCommands.get('pmcode.sendPrompt')!;
    await handler('Hello AI');

    expect(deps.providerAdapter.injectPrompt).toHaveBeenCalledWith('Hello AI');
  });

  it('focusSidebar calls sidebarProvider.focus', () => {
    const handler = registeredCommands.get('pmcode.focusSidebar')!;
    handler();

    expect(deps.sidebarProvider.focus).toHaveBeenCalled();
  });

  it('search focuses sidebar and sets query', () => {
    const handler = registeredCommands.get('pmcode.search')!;
    handler('test query');

    expect(deps.sidebarProvider.focus).toHaveBeenCalled();
    expect(deps.sidebarProvider.setSearchQuery).toHaveBeenCalledWith('test query');
  });
});
