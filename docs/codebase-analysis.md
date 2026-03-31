# PM Code Codebase Analysis

**Date:** 2026-03-31
**Branch:** `implement-mvp`
**Tests:** 443 passing (28 test files), 908ms
**Commit:** `dde92c6` (HEAD)

---

## What's Fully Implemented

### Extension Scaffolding & Activation
- **Entry point** (`src/extension.ts`): Clean dependency injection via `ExtensionDeps` bag. All managers instantiated, sidebar registered, 8 command groups wired, background startup with FTUE auto-open, dependency check, Roo detection, sidebar count updates, and marketplace status. Lines 41-161.
- **package.json contributes**: 34 commands registered, 1 walkthrough with 4 steps (including completion events), activity bar icon, sidebar webview view. All commands map to real handlers.
- **Build pipeline**: esbuild bundling to `dist/extension.js`, vitest for unit tests, `@vscode/test-electron` for integration/E2E. Scripts for compile, watch, test:unit, test:integration, test:e2e, and coverage.

### Configuration System (`src/config/`)
- **ConfigManager** (`ConfigManager.ts`): Full implementation with `~/.pmcode/config.json` persistence, `globalState` fallback, deep merge for partial updates, directory structure creation (`skills/`, `connectors/`, `guides/`, `memory/`, `history/`). 16 unit tests passing.
- **EnvManager** (`EnvManager.ts`): Reads/writes `~/.pmcode/.env` via `dotenv` package. Handles quoting for special characters. CRUD for token keys. 14 unit tests.
- **ConfigVersioning** (`ConfigVersioning.ts`): Timestamped JSON snapshots in `~/.pmcode/history/`, max 50 with auto-pruning, rollback creates pre-rollback snapshot. Note: only stores env key *names*, not values.

### Sidebar (`src/sidebar/SidebarProvider.ts`)
- Full webview with search bar, debounced search (200ms), filter chips (All/Skills/Connectors/Guides), navigation buttons with live counts, Roo Code connection status footer, Quick Start progress bar (hides when FTUE complete), marketplace section with browse/sync buttons.
- Bidirectional message passing: sidebar sends search queries to extension, extension pushes back results, counts, FTUE progress, and marketplace status.
- CSP nonce on all scripts/styles.

### Connectors System (`src/connectors/`)
- **ConnectorManager** (`ConnectorManager.ts`): Full CRUD lifecycle -- `configure()`, `enable()`, `disable()`, `remove()`, `testConnection()`, `getStatus()`. Separates secrets (password fields to `.env`) from settings (JSON file per connector). Writes MCP server definitions to Roo Code's `cline_mcp_settings.json`.
- **5 Adapter definitions**: Jira (MCP, 3 fields), GitHub (CLI tool, auto-detected via `gh auth status`), Monday (MCP, 1 field), Aha! (MCP, 2 fields), Tavily (MCP, 1 field). Each includes example prompts, related skills/guides.
- **HealthChecker** (`HealthChecker.ts`): Delegates to `ConnectorManager.testConnection()`.
- MCP server testing checks `which <command>` with a warning that npx may still work.

### Skills System (`src/skills/`)
- **SkillParser** (`SkillParser.ts`): Uses `gray-matter` for YAML frontmatter. Parses `name`, `description`, `license`, `metadata` (author, version, category, connectors), `allowed-tools`. Validates required fields.
- **SkillLoader** (`SkillLoader.ts`): 5-location priority loading: `.pmcode/skills/` (project) > `.agents/skills/` (project) > `~/.pmcode/skills/` (global) > `~/.agents/skills/` (global) > `skills/` (bundled). Deduplicates by id, highest priority wins.
- **SkillManager** (`SkillManager.ts`): Caching layer over SkillLoader. Install (copies directory to `~/.pmcode/skills/`), remove, search, filter-by-connector. `refresh()` clears cache.
- **3 bundled skills**: `idea-triage`, `sprint-retro`, `prd-writer` (in `/skills/` directory with proper SKILL.md frontmatter).

### Guide Engine (`src/guides/GuideEngine.ts`)
- **4 hardcoded guides** with rich, multi-step content:
  1. "Getting Started with PM Code" (4 steps, 10 min)
  2. "Projects, Files & Context" (6 steps, 15 min)
  3. "Sharing Product Context with Your Team" (7 steps, 20 min)
  4. "Triage Ideas Like a Pro" (6 steps, 25 min)
- Each step has title, markdown content, optional prompts (label + text), optional proTip.
- Progress persisted to `~/.pmcode/guides/progress.json`. Step completion, reset, current-step tracking all work.

### Provider Adapter (`src/providers/`)
- **ProviderAdapter interface** (`ProviderAdapter.ts`): `detect()`, `getGlobalMcpConfigPath()`, `getProjectMcpConfigPath()`, `readMcpConfig()`, `writeMcpConfig()`, `injectPrompt()`.
- **RooCodeAdapter** (`RooCodeAdapter.ts`): Cross-platform paths (macOS/Windows/Linux) to Roo Code globalStorage. Detection via `vscode.extensions.getExtension()`. Prompt injection via clipboard + focus command (with fallback chain). MCP config merge preserves user-added servers.

### FTUE System (`src/commands/ftue.ts`)
- 4-step FTUE: meetAI, connectTool, firstPrompt, explore.
- Syncs across 3 surfaces: VS Code walkthrough (context keys), sidebar (progress bar), dashboard (Quick Start checkboxes).
- Toggle support: dashboard checkboxes can mark steps complete/incomplete.
- `onContext:pmcode.ftue.<stepId>` completion events in walkthrough.
- Walkthrough auto-opens on first activation (when no steps completed).

### Panels (6 dedicated panel classes + CompanionPanel)
All panels in `src/panels/` have full HTML generation with:
- CSP nonce on script and style tags
- Shared `styles.css` from `webview-ui/`
- XSS escaping via `escapeHtml()`/`escapeAttr()`
- Bidirectional webview message handling
- Proper `data-action` delegation pattern

Panel classes implemented:
- **CompanionPanel** (`CompanionPanel.ts`): Dual-phase dashboard (companion FTUE vs. command center). Shows connector health, skills, guides with progress, quick actions, dependency status.
- **ConnectorsListPanel** (`ConnectorsListPanel.ts`): Grid of connector cards with status dots.
- **ConnectorDetailPanel** (`ConnectorDetailPanel.ts`): Full config form with field types, help links, save/test/disable/remove buttons, example prompts, related items.
- **SkillsListPanel** (`SkillsListPanel.ts`): Grid of skill cards with category/source badges.
- **SkillDetailPanel** (`SkillDetailPanel.ts`): Requirements check (connector statuses), rendered markdown instructions, generated sample prompts, related connectors.
- **GuidesListPanel** (`GuidesListPanel.ts`): Grid of guide cards with progress bars.
- **GuideDetailPanel** (`GuideDetailPanel.ts`): Left rail step list with checkmarks, main content with markdown + prompts + pro tips, prev/next/skip navigation.

### Marketplace (`src/marketplace/MarketplaceRegistry.ts`)
- Git-based marketplace: clone/pull from configurable repo URL (default: `anthropics/knowledge-work-plugins`).
- Reads `.claude-plugin/marketplace.json` catalog format.
- Install plugins by copying from local clone (relative-path sources only).
- Legacy manifest wrapper maps plugins to skills/connectors format.
- State persisted to `~/.pmcode/marketplace-state.json`.
- Sidebar integration with browse button and sync/update button.
- Git auth error handling with `gh auth login` guidance.

### System Checks (`src/system/`)
- **DependencyChecker** (`DependencyChecker.ts`): Checks 4 dependencies -- xcode-select, Node.js, Python3, gh CLI. Extended PATH for homebrew/nvm/pyenv.
- **SetupProgress** (`SetupProgress.ts`): Phased progress tracking with listener callbacks.

### Test Coverage
- **443 tests across 28 files**, all passing.
- Coverage spans: all commands, all panels, all config modules, all connectors (adapters + manager + health checker), all skills modules, guide engine, marketplace, dependency checker, setup progress, panel utilities, extension activation.
- Test infrastructure: vitest with vscode mock (`test/__mocks__/vscode.ts`), integration tests via `@vscode/test-electron`, E2E tests in `test/ui/`.
- Walkthrough media files exist: `media/walkthrough/{meet-ai,connect-tool,first-prompt,ready}.md`.

---

## What's Partially Implemented

### Dedicated Panel Classes Are Unused by Commands
**Files:** `src/panels/ConnectorsListPanel.ts`, `SkillsListPanel.ts`, `GuidesListPanel.ts`, `ConnectorDetailPanel.ts`, `SkillDetailPanel.ts`, `GuideDetailPanel.ts`

These 6 panel classes with rich UIs are never imported or called from the command files. Instead, `src/commands/navigation.ts` generates its own simpler inline HTML (lines 136-277) using local `getSkillsListHtml()`, `getConnectorsListHtml()`, etc. functions. The navigation commands call `deps.panelManager.openPanel()` directly with inline HTML generators rather than using the dedicated panel class `show()` methods.

**Impact:** Users see the simpler inline-generated HTML rather than the feature-rich panel UIs. For example:
- `ConnectorDetailPanel` has a full configuration form with save/test/disable/remove buttons, but `navigation.ts:getConnectorDetailHtml()` (line 192) renders a read-only view with status and example prompts only -- no form.
- `SkillDetailPanel` shows requirements checks and sample prompts, but `navigation.ts:getSkillDetailHtml()` (line 183) shows just description and rendered instructions.
- `GuideDetailPanel` has a left-rail step navigation with progress, but `navigation.ts:getGuideDetailHtml()` (line 208) renders all steps linearly with no interactivity.

### SetupProgress Class Is Defined but Not Wired
**File:** `src/system/SetupProgress.ts`

The `SetupProgress` class is fully implemented with phased progress tracking and listener callbacks, but it is never instantiated or used in `src/extension.ts` or any command file. The `CompanionPanel` accepts `setupStatus?: SetupStatus` in its `DashboardData` (line 21) but `gatherDashboardData()` in `src/commands/core.ts` always passes `dependencies: []` (line 151) and never sets `setupStatus`.

### Config Fields Declared but Never Read/Written
**File:** `src/config/ConfigManager.ts`

The `PmCodeConfig` interface defines several fields that are declared with defaults but never read or written anywhere in the codebase:
- `ui.sidebarCollapsed` (line 13) -- never toggled
- `ui.lastOpenedPanel` (line 14) -- never updated when panels open
- `ui.searchHistory` (line 15) -- never populated from search queries
- `preferences.autoOpenCompanion` (line 19) -- never checked in startup logic
- `preferences.telemetryEnabled` (line 20) -- no telemetry system exists
- `preferences.provider` (line 18) -- hardcoded to 'roo-code', never used for provider selection
- `connectors.configured` (line 23) -- ConnectorManager tracks this independently via JSON files
- `connectors.disabled` (line 24) -- ConnectorManager tracks this independently via JSON files
- `guides.completed` (line 27) -- GuideEngine tracks this independently via progress.json
- `guides.inProgress` (line 28) -- GuideEngine tracks this independently via progress.json
- `skills.used` (line 25) -- read by dashboard but never written to (no code records skill usage)

### Phase "Invisible" (Phase A) Not Implemented
**File:** `src/config/ConfigManager.ts` line 8, `src/commands/ftue.ts` line 69

The config supports three phases: `companion`, `command-center`, and `invisible`. The FTUE system transitions from `companion` to `command-center` when all steps are done (line 69). But the `invisible` phase described in the spec (month 3+ behavior where sidebar collapses and surfaces only via notifications) has no implementation -- no code ever sets `phase: 'invisible'` and no behavior changes based on it.

### Connector "Configure" Command Doesn't Actually Save
**File:** `src/commands/connectors.ts` lines 44-59

The `pmcode.connector.configure` command just redirects to `pmcode.openConnector` (line 58), which opens the simple read-only view from `navigation.ts` rather than the `ConnectorDetailPanel` with its form. Even if the `ConnectorDetailPanel` form were used, the form's "configure" message sends `{ type: 'configure', values }` but the message handler in `ConnectorDetailPanel.show()` calls `pmcode.connector.configure` recursively rather than calling `connectorManager.configure()` directly.

### Marketplace Connector Install Has No Integration
**File:** `src/marketplace/MarketplaceRegistry.ts` lines 311-323

`installConnector()` copies files from the marketplace clone to `~/.pmcode/connectors/marketplace/`, but there is no mechanism to make those installed connectors appear in the `ConnectorManager`'s definitions. The `ConnectorManager` only loads from `loadBuiltinDefinitions()` (5 hardcoded adapters, line 62). Marketplace-installed connectors would be copied to disk but invisible to the system.

---

## What's Missing / Stubbed

### No Connector Configuration UI Flow
While `ConnectorDetailPanel` has a configuration form with save/test buttons, users can never reach it because:
1. `pmcode.openConnector` uses inline HTML from `navigation.ts` (read-only view)
2. `pmcode.connector.configure` just calls `pmcode.openConnector`
3. The only way to actually call `connectorManager.configure()` is programmatically

Users cannot configure connectors through the UI. They would need to manually create JSON files in `~/.pmcode/connectors/` and `.env` entries.

### No "Send to Roo" Integration on Guide Steps
Guide step prompts in the `GuideEngine` data include `prompts` arrays with label/text pairs. The `GuideDetailPanel` renders "Send to Roo" buttons that work. But the simpler guide view from `navigation.ts:getGuideDetailHtml()` (which is what users actually see) renders steps as static markdown with no prompt buttons, no step navigation, and no progress tracking interaction.

### No Skill Usage Tracking
`config.skills.used` is read by the dashboard (`src/commands/core.ts` line 149) to show "Recently used" skills, but no code ever writes to this array. The `pmcode.skill.run` command (line 75-101 of `src/commands/skills.ts`) sends a prompt but never records the skill id to config.

### No Badge Count on Activity Bar Icon
The spec (line 37 of the design spec) mentions "Badge count for items needing attention" on the activity bar icon. No code sets a badge on the viewsContainer.

### No "Notification-Only" Behaviors
The spec describes Phase A behaviors like "Jira token expiring" notifications. No notification/warning system exists for credential expiry or connector health degradation.

### No VS Code Settings Integration
`package.json` has no `contributes.configuration` section. The `pmcode.openSettings` command (line 119 of `src/commands/core.ts`) opens VS Code settings filtered to `@ext:pmcode.pmcode`, which would show nothing since no settings are contributed.

### Walkthrough Markdown Files Are Stubs
The 4 walkthrough media files (`media/walkthrough/*.md`) exist but their content was not verified -- they may be minimal placeholders.

### Empty Test Directories
`test/journeys/`, `test/fixtures/`, `test/sidebar/` are empty directories, suggesting planned but unwritten test categories.

---

## Technical Debt

### Duplicate HTML Generation (Navigation vs. Panel Classes)
The biggest structural issue: `src/commands/navigation.ts` contains its own HTML generators (lines 136-285) that duplicate the functionality of the 6 dedicated panel classes in `src/panels/`. The panel classes are more feature-rich (forms, interactive elements, CSP nonces) while the navigation inline HTML is simpler and lacks interactivity. One set should be removed and the other used consistently.

**Recommendation:** Delete the inline HTML from `navigation.ts` and wire the commands to use the panel classes (`ConnectorsListPanel.show()`, `SkillsListPanel.show()`, etc.).

### Duplicate `escapeHtml` Implementations
- `src/panels/panelUtils.ts` lines 27-33 (exported utility)
- `src/commands/navigation.ts` lines 279-284 (local copy)
- `src/commands/marketplace.ts` lines 279-285 (local copy, also escapes single quotes)
- `src/sidebar/SidebarProvider.ts` line 399 (inline JS using DOM `textContent`)

### Duplicate `getNonce` Implementations
- `src/panels/panelUtils.ts` lines 6-12 (exported utility)
- `src/sidebar/SidebarProvider.ts` lines 473-479 (local copy)

### Missing CSP Nonces in Navigation Panel HTML
The inline HTML generated by `src/commands/navigation.ts:wrapHtml()` (line 227) does not include CSP meta tags or nonces, unlike all the dedicated panel classes which properly set CSP with nonces. The inline `<script>` tag at line 267 would be blocked by a strict CSP.

### Connector Configure Message Loop
`ConnectorDetailPanel` line 42-46: The "configure" message handler calls `pmcode.connector.configure` which calls `pmcode.openConnector` which opens the *navigation* inline view (not the panel class). This creates a confusing loop where clicking "Save" in the form would open a different, simpler view.

### MCP Server Package Names May Be Fictional
The adapter definitions reference `@anthropic/mcp-server-jira`, `@anthropic/mcp-server-monday`, `@anthropic/mcp-server-aha`, and `@anthropic/mcp-server-tavily-search`. These npm packages may not exist. Only `@anthropic/mcp-server-tavily-search` has a plausible name. This needs verification before real usage.

### `out/` Directory Untracked
The `out/` directory appears in git status but is not in `.gitignore`. This is likely TypeScript compilation output that should be ignored.

### Config Dual-Track Problem
Connector state (configured/disabled), guide progress, and skill usage are tracked by their respective managers in separate files, but the `PmCodeConfig` interface also has fields for these (`connectors.configured`, `connectors.disabled`, `guides.completed`, `guides.inProgress`, `skills.used`). These config fields are never synced with the actual manager state, creating a potential confusion about source of truth.

---

## Architecture Assessment

### What's Well-Designed

1. **Dependency injection via ExtensionDeps bag**: Clean separation of concerns. Every command file receives the same deps bag, making testing straightforward (mock the bag). Extension activation is easy to follow.

2. **ProviderAdapter interface**: The abstraction over AI providers (currently only Roo Code) is well-defined with clear methods. Adding a Claude Code or Cursor adapter would be a contained change.

3. **5-location skill loading priority**: The SkillLoader's prioritized discovery (project-local > global > bundled) with deduplication is a thoughtful design that supports both individual and team workflows.

4. **FTUE state synchronization**: The 3-surface sync (walkthrough, sidebar, dashboard) with context key bidirectional binding is well-implemented and avoids recursion. The toggle mechanism allows users to re-mark steps.

5. **PanelManager deduplication**: Simple but effective -- prevents duplicate panels via composite key, auto-cleanup on dispose.

6. **Guide content quality**: The 4 bundled guides are substantial, well-written, and genuinely useful for the target audience. Each step has actionable prompts and pro tips.

7. **Test coverage**: 443 tests covering every module is strong for this stage. The testing patterns documented in CLAUDE.md are clear.

8. **CSS theming**: All panels use VS Code theme CSS custom properties (`--vscode-*`), ensuring they look native in any VS Code theme.

### What Needs Refactoring

1. **Wire panel classes to commands (Priority: High)**: The most impactful change. `navigation.ts` should import and use the dedicated panel classes instead of generating its own HTML. This would immediately give users the full interactive UI (connector forms, guide step navigation, skill requirements checks).

2. **Complete the connector configure flow (Priority: High)**: Connect the `ConnectorDetailPanel` form save action to `connectorManager.configure()`. This is the core value proposition -- users need to be able to configure connectors without touching JSON/env files.

3. **Track skill usage (Priority: Medium)**: When `pmcode.skill.run` executes, record the skill id in `config.skills.used`. Simple one-line addition in `src/commands/skills.ts`.

4. **Remove unused config fields or implement them (Priority: Medium)**: Either implement the tracking for `ui.sidebarCollapsed`, `ui.lastOpenedPanel`, `ui.searchHistory`, etc., or remove them from the config schema to reduce confusion.

5. **Wire SetupProgress into activation (Priority: Low)**: The class exists and is tested but unused. Either wire it into `runBackgroundStartup()` to feed the dashboard's dependency section, or remove it.

6. **Consolidate escapeHtml/getNonce utilities (Priority: Low)**: Import from `panelUtils.ts` everywhere instead of maintaining local copies.

7. **Add marketplace connector integration (Priority: Low)**: `ConnectorManager` needs a mechanism to discover and load connector definitions from `~/.pmcode/connectors/marketplace/` in addition to the 5 builtins.
