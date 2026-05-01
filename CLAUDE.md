# CLAUDE.md

## Project

PM Code is a VS Code extension for non-technical users (PMs, designers) to onboard to AI IDEs. It provides skills (SKILL.md format), connectors (Jira, GitHub, Monday, Aha!, Tavily), guided walkthroughs, and a marketplace.

## Build & Test

```bash
npm install              # install dependencies
npm run compile          # esbuild bundle → dist/extension.js
npm test                 # vitest unit + vscode-test integration
npm run test:unit        # vitest only (fast, ~800ms)
npm run test:e2e         # compile + vscode-test UI tests (real VS Code)
npx tsc --noEmit         # type-check only
```

## Architecture

- `src/extension.ts` — entry point, wires all managers and registers commands
- `src/commands/` — one file per command group (core, navigation, connectors, skills, guides, system, marketplace)
- `src/panels/` — WebviewPanel classes, one per panel type. HTML generated via template literals with CSP nonces
- `src/sidebar/` — single WebviewViewProvider for the sidebar
- `src/connectors/` — ConnectorManager + adapters/ with one file per connector (Jira, GitHub, Monday, Aha, Tavily)
- `src/skills/` — SkillParser (gray-matter), SkillLoader (5-location priority), SkillManager
- `src/guides/` — GuideEngine with 4 hardcoded guides
- `src/providers/` — ProviderAdapter interface + RooCodeAdapter (cross-platform paths)
- `src/config/` — ConfigManager (~/.pmcode/config.json), EnvManager (.env), ConfigVersioning (history snapshots)
- `src/marketplace/` — MarketplaceRegistry (git clone/pull, reads `.claude-plugin/marketplace.json` catalog per Claude Code plugin format, installs to `~/.pmcode/plugins/` and extracts skills to `~/.pmcode/skills/`)
- `src/system/` — DependencyChecker, SetupProgress

## Key patterns

- All panels use `panelUtils.ts` for shared types, `getNonce()`, `escapeHtml()`, `getStylesUri()`
- Commands receive an `ExtensionDeps` bag (defined in extension.ts) with all managers
- Webview ↔ extension communication via `postMessage`/`onDidReceiveMessage`
- Config lives in `~/.pmcode/`, secrets in `~/.pmcode/.env`, MCP config written to Roo's globalStorage
- Tests mock `vscode` module via `test/__mocks__/vscode.ts` (aliased in vitest.config.ts)

## Style

- TypeScript strict mode, esbuild bundler
- `import * as vscode from 'vscode'` (not destructured)
- No unnecessary abstractions — inline template literals for webview HTML
- CSS uses VS Code theme custom properties (`--vscode-*`)

## Writing Tests

### Test types

1. **Unit tests** (`test/**/*.test.ts`) — vitest, mock vscode module, fast. Run with `npm run test:unit`.
2. **Integration tests** (`test/integration/`) — run inside a real VS Code instance via `@vscode/test-electron`. Configured in `.vscode-test.mjs`.
3. **E2E tests** (`test/ui/`) — also run inside real VS Code. Exercise every command, panel, and search flow. Run with `npm run test:e2e`.

### Writing unit tests for commands

Commands are tested by capturing the callbacks passed to `vscode.commands.registerCommand`, then calling them directly with controlled arguments. Pattern:

```typescript
import { vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const { _createMockContext } = vscode as any;

function createMockDeps() {
  return {
    // Mock each manager your command file uses
    skillManager: { getInstalledSkills: vi.fn(async () => []), getSkill: vi.fn() },
    connectorManager: { getConnectors: vi.fn(async () => []) },
    guideEngine: { getGuides: vi.fn(() => []) },
    panelManager: {
      openPanel: vi.fn(() => ({
        webview: { html: '', onDidReceiveMessage: vi.fn(() => ({ dispose: () => {} })) },
      })),
    },
    // ...add other deps as needed
  } as any;
}

let registeredCommands: Map<string, (...args: any[]) => any>;

beforeEach(() => {
  vi.clearAllMocks();
  registeredCommands = new Map();
  vi.mocked(vscode.commands.registerCommand).mockImplementation(
    (id: string, cb: (...args: any[]) => any) => {
      registeredCommands.set(id, cb);
      return { dispose: () => {} };
    }
  );
  registerYourCommands(_createMockContext(), createMockDeps());
});

// Then call: const handler = registeredCommands.get('pmcode.yourCommand')!;
```

### Writing unit tests for panels

Panel tests verify the HTML output by calling `PanelClass.show(extensionUri, panelManager, data)` and inspecting `panel.webview.html`. The mock `createWebviewPanel` captures the HTML. Test:

- All expected content appears (names, descriptions, buttons, form fields)
- XSS escaping works (`<script>` → `&lt;script&gt;`)
- CSP meta tag is present with nonce
- Conditional sections show/hide based on data (empty states, optional sections)
- Message handlers dispatch correct commands (use `panel._simulateMessage({...})`)

### Writing unit tests for services (managers, registries)

Services that use `fs`, `child_process`, or `os` should mock those modules at the top of the test file:

```typescript
vi.mock('fs/promises');
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: vi.fn(() => '/mock/home') };
});
```

### Writing E2E tests (test/ui/)

E2E tests run in real VS Code via `@vscode/test-electron`. They use mocha's `tdd` UI (`suite`/`test`) and Node `assert`. They can:

- Execute any registered command via `vscode.commands.executeCommand()`
- Verify commands don't throw
- Check command registration via `vscode.commands.getCommands()`
- Verify package integrity (walkthrough files exist, icons exist)
- Cannot access webview DOM directly (it's sandboxed)

### What to test for every new feature

- **New command**: unit test the handler with args and without (QuickPick/InputBox path). Test error cases. Add to E2E `sidebar.test.ts` command list.
- **New panel**: unit test HTML output, conditional sections, message handlers, XSS escaping. Add E2E test that opens it.
- **New service/manager**: unit test with mocked fs/child_process. Test happy path, error paths, caching.
- **New webview message type**: test the `onDidReceiveMessage` handler dispatches the right command.
- **New file reference in package.json** (icons, walkthrough markdown): add to package integrity test in `test/ui/sidebar.test.ts`.
