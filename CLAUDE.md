# CLAUDE.md

## Project

PM Code is a VS Code extension for non-technical users (PMs, designers) to onboard to AI IDEs. It provides skills (SKILL.md format), connectors (Jira, GitHub, Monday, Aha!, Tavily), guided walkthroughs, and a marketplace.

## Build & Test

```bash
npm install              # install dependencies
npm run compile          # esbuild bundle → dist/extension.js
npm test                 # vitest (299 tests, ~700ms)
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
- `src/marketplace/` — MarketplaceRegistry (git clone/pull, plugin.json manifest)
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
