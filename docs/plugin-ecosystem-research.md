# AI Coding Tool Plugin Ecosystem Research

**Date:** April 2026
**Purpose:** Comprehensive analysis of plugin/marketplace ecosystems across AI coding tools to inform PMCode's plugin strategy.

---

## 1. Product-by-Product Analysis

### 1.1 Claude Code Plugins (Anthropic)

Claude Code has the most mature and fully-specified plugin system as of April 2026.

**Plugin structure:**
- Plugins live in a directory with an optional `.claude-plugin/plugin.json` manifest
- Components (skills, agents, hooks, MCP servers, LSP servers) live at the plugin root, NOT inside `.claude-plugin/`
- If no manifest is provided, Claude Code auto-discovers components from default locations

**Standard directory layout:**
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json           # Manifest (optional but recommended)
├── skills/
│   └── my-skill/
│       └── SKILL.md           # Skill definition
├── agents/
│   └── reviewer.md            # Subagent definition
├── commands/
│   └── deploy.md              # Legacy command format
├── hooks/
│   └── hooks.json             # Event handlers
├── output-styles/
│   └── terse.md               # Output customization
├── bin/                        # Executables added to PATH
├── scripts/                    # Utility scripts
├── settings.json               # Default plugin settings
├── .mcp.json                   # MCP server definitions
└── .lsp.json                   # Language server configs
```

**plugin.json manifest fields:**
- `name` (required, kebab-case) — unique identifier and namespace
- `version` (semver) — determines update detection
- `description`, `author`, `homepage`, `repository`, `license`, `keywords` — metadata
- `commands`, `agents`, `skills`, `hooks`, `mcpServers`, `outputStyles`, `lspServers` — component paths (string, array, or inline object)
- `userConfig` — declares values prompted at enable time (supports `sensitive: true` for keychain storage)
- `channels` — message channel declarations bound to MCP servers

**SKILL.md format:**
```markdown
---
name: my-skill
description: What this skill does and when to use it
license: MIT
compatibility: claude-code>=2.0
metadata:
  category: development
---

Instructions for Claude when this skill is invoked...
```
- `name`: 1-64 chars, lowercase alphanumeric with single hyphens, must match directory name
- `description`: 1-1024 chars, primary trigger mechanism
- Skills can include `scripts/`, `references/`, and `assets/` subdirectories

**Marketplace system:**
- A marketplace is a git repo containing `.claude-plugin/marketplace.json`
- The official marketplace (`claude-plugins-official`) is auto-loaded
- Add third-party marketplaces: `/plugin marketplace add owner/repo`
- Supports GitHub, GitLab, Bitbucket, local paths, and remote URLs
- Install: `/plugin install plugin-name@marketplace-name`
- Scopes: user (~/.claude/settings.json), project (.claude/settings.json), local, managed
- Plugins cached to `~/.claude/plugins/cache/`
- Auto-update supported per marketplace

**MCP configuration (.mcp.json):**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "${CLAUDE_PLUGIN_ROOT}/server.js",
      "args": ["--flag"],
      "env": { "KEY": "value" },
      "cwd": "${CLAUDE_PLUGIN_ROOT}"
    }
  }
}
```

**Official marketplace categories:**
- Code intelligence (LSP plugins for 11 languages)
- External integrations (GitHub, GitLab, Atlassian, Slack, Figma, Notion, Linear, Sentry, etc.)
- Development workflows (commit-commands, pr-review-toolkit)
- Output styles

Sources:
- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
- [Skills documentation](https://code.claude.com/docs/en/skills)

---

### 1.2 OpenAI Codex Plugins

OpenAI launched its plugin marketplace for Codex on March 27, 2026, with 20+ launch partners including Slack, Figma, Notion, Sentry, Box, Linear, Gmail, and Hugging Face.

**Plugin structure:**
- Very similar to Claude Code — plugins use a `.codex-plugin/plugin.json` manifest
- Components live at the plugin root (skills/, .app.json, .mcp.json, assets/)

**Standard directory layout:**
```
my-plugin/
├── .codex-plugin/
│   └── plugin.json           # Manifest (required)
├── skills/
│   └── skill-name/
│       └── SKILL.md           # Same SKILL.md format as Claude Code
├── .app.json                   # App/connector definitions
├── .mcp.json                   # MCP server configuration
└── assets/
    ├── icon.png
    ├── logo.png
    └── screenshots/
```

**plugin.json manifest fields:**
- `name` (kebab-case), `version` (semver), `description` — core identity
- `author`, `homepage`, `repository`, `license`, `keywords` — metadata
- `skills` — path to skills directory
- `mcpServers` — path to .mcp.json
- `apps` — path to .app.json (Codex-specific; app/connector integrations)
- `interface` — UI presentation metadata:
  - `displayName`, `shortDescription`, `longDescription`
  - `developerName`, `category`, `capabilities` (Read/Write)
  - `brandColor`, `composerIcon`, `logo`, `screenshots`
  - `websiteURL`, `privacyPolicyURL`, `termsOfServiceURL`
  - `defaultPrompt`

**SKILL.md format:** Identical to Claude Code — YAML frontmatter with `name` and `description`, followed by markdown instructions.

**Installation:**
- CLI: `/plugins` to browse, search, and install
- App: dedicated Plugin Directory interface
- Marketplace entries use `source.path` with relative paths in `marketplace.json`
- Plugins cached to `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/`
- Disable via `~/.codex/config.toml`: `[plugins."name@marketplace"] enabled = false`

**Cross-compatibility:** Codex plugins are explicitly designed to be cross-compatible with Claude Code plugins. OpenAI even published `codex-plugin-cc`, a Codex plugin that runs inside Claude Code (installed via `/plugin marketplace add openai/codex-plugin-cc`).

**Key difference from Claude Code:**
- Adds `.app.json` for app integrations (not present in Claude Code)
- `interface` block in manifest has richer UI/branding fields
- Self-serve plugin publishing not yet available (as of March 2026)

Sources:
- [Codex Plugins documentation](https://developers.openai.com/codex/plugins)
- [Build Codex plugins](https://developers.openai.com/codex/plugins/build)
- [codex-plugin-cc repo](https://github.com/openai/codex-plugin-cc)
- [OpenAI Codex Plugin Marketplace launch](https://winbuzzer.com/2026/03/31/openai-launches-plugin-marketplace-codex-enterprise-controls-xcxwbn/)

---

### 1.3 OpenCode (open source, by sst/opencode-ai)

OpenCode is an open-source terminal AI coding agent. Note: the original `opencode-ai/opencode` repo was archived in September 2025, with development continuing as "Crush" by the original author. A newer `opencode.ai` project exists with active development.

**Plugin system:**
- Plugins are JavaScript/TypeScript modules exporting async functions
- No manifest file — plugins export functions that receive a context object and return hooks
- Loaded from `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (global)
- Can also be loaded from npm via config: packages installed automatically with Bun

**Plugin API:**
```typescript
import type { Plugin } from "@opencode-ai/plugin"
export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    hooks: { /* event handlers */ },
    tools: { /* custom tool definitions */ }
  }
}
```

**Hooks:** `command.executed`, `file.edited`, `file.watcher.updated`, `message.updated`, `session.created`, `session.compacted`, `tool.execute.before`, `tool.execute.after`, `shell.env`, `tui.toast.show`, `tui.prompt.append`

**SKILL.md support:** OpenCode supports the same SKILL.md format as Claude Code, searching:
- `.opencode/skills/<name>/SKILL.md`
- `.claude/skills/<name>/SKILL.md` (Claude-compatible path)
- `.agents/skills/<name>/SKILL.md` (cross-platform path)
- `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/` (global)

**MCP configuration:** In `opencode.json`:
```json
{
  "mcp": {
    "server-name": {
      "type": "stdio",
      "command": "path/to/server",
      "args": [],
      "env": {}
    }
  }
}
```
Also supports `"type": "remote"` with a `url` field for HTTP MCP servers.

**Configuration:** JSON/JSONC format (`opencode.json`), merged from remote, global, custom (env var), project, and inline sources. Has JSON schema validation.

**No marketplace system.** Community-driven discovery via [awesome-opencode](https://github.com/awesome-opencode/awesome-opencode).

Sources:
- [OpenCode plugins documentation](https://opencode.ai/docs/plugins/)
- [OpenCode skills documentation](https://opencode.ai/docs/skills/)
- [OpenCode config documentation](https://opencode.ai/docs/config/)
- [opencode-ai/opencode GitHub](https://github.com/opencode-ai/opencode)

---

### 1.4 Goose (Block)

Goose is an open-source AI agent framework by Block (Square/Cash App). It is heavily MCP-native with 4,000+ available MCP server extensions.

**Extension system:**
- Extensions are MCP servers added via `goose configure` CLI
- Three types: built-in extensions, command-line extensions (local), remote extensions (HTTP)
- Configured in `~/.config/goose/config.yaml`
- No plugin manifest format — extensions are just MCP server configurations

**Recipe system (Goose's equivalent of "skills"):**
```yaml
version: 1.0.0
title: Code Review
description: Automated code review workflow
instructions: Review the code for security issues...

extensions:
  - name: github
    command: npx @anthropic/github-mcp
    timeout: 300

parameters:
  - key: repo_url
    input_type: string
    requirement: required
    description: Repository URL

settings:
  goose_provider: anthropic
  goose_model: claude-sonnet-4-20250514
  temperature: 0.3

retry:
  max_retries: 3
  checks:
    - type: shell
      command: "test -f review-output.md"

response:
  json_schema:
    type: object
    properties:
      issues:
        type: array
```

**Recipe distribution:**
- Recipe deeplinks (for Goose Desktop)
- Shared as `.yaml` or `.json` files
- GitHub repos (configured via `GOOSE_RECIPE_GITHUB_REPO` env var)
- Run: `goose run --recipe recipe-name`

**No SKILL.md support.** Goose uses its own YAML recipe format.

**No plugin marketplace.** Extensions are discovered through the MCP ecosystem. Goose has a community extensions portal and recipe cookbook at block.github.io/goose.

Sources:
- [Goose documentation](https://block.github.io/goose/)
- [Goose recipes](https://block.github.io/goose/docs/guides/recipes/session-recipes/)
- [Goose GitHub](https://github.com/block/goose)
- [Goose extension deep dive](https://dev.to/lymah/deep-dive-into-gooses-extension-system-and-model-context-protocol-mcp-3ehl)

---

### 1.5 Aider

Aider is an open-source terminal-based AI pair programming tool focused on Git-tracked code changes.

**Plugin/extension system:** None. Aider has no plugin, skill, or extension system. It is a focused tool for AI-assisted code editing.

**MCP support:** Aider does not natively support MCP. However, third-party MCP servers exist that wrap Aider's functionality (e.g., `aider-mcp-server`), allowing other MCP clients to use Aider as a tool. These are community-built, not official.

**Extensibility:** Limited to:
- Model configuration (supports 100+ LLMs)
- Git integration settings
- Editor/lint commands
- `.aider.conf.yml` for project-level settings

**No marketplace, no SKILL.md support, no plugin manifest.**

Sources:
- [Aider website](https://aider.chat/)
- [Aider GitHub](https://github.com/Aider-AI)
- [Aider MCP Server](https://github.com/danielscholl/aider-mcp-server)

---

### 1.6 Continue.dev

Continue is an open-source AI code assistant available as a VS Code and JetBrains extension, with a CLI, and a Hub for sharing configurations.

**Configuration system (config.yaml):**
```yaml
name: My Assistant
version: 1.0.0
schema: v1

models:
  - name: claude-sonnet
    provider: anthropic
    model: claude-sonnet-4-20250514
    roles: [chat, edit]

context:
  - provider: code
  - provider: docs

rules:
  - Always use TypeScript strict mode

mcpServers:
  - name: github
    command: npx
    args: ["@anthropic/github-mcp"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
```

**Hub and Blocks system:**
- The Continue Hub (hub.continue.dev) is a public registry of reusable "blocks"
- Blocks are individual components: models, rules, context providers, prompts, docs, MCP servers, data destinations
- Assistants compose multiple blocks into a complete configuration
- Blocks identified by slug: `owner-slug/block-slug` (e.g., `openai/gpt-4o`)
- Blocks and assistants use the same `config.yaml` format
- Import blocks with `uses:` clauses

**MCP support:** Full MCP server support in config.yaml. MCP tools only available in agent mode. Supports stdio and SSE transports.

**No SKILL.md support.** Continue uses "rules" (concatenated into system messages) and "prompts" (invokable via `/` commands) instead.

**No traditional plugin system.** Extensibility is through composable config.yaml blocks shared via the Hub, not installable plugin packages.

Sources:
- [Continue config.yaml reference](https://docs.continue.dev/reference)
- [Continue MCP setup](https://docs.continue.dev/customize/deep-dives/mcp)
- [Continue Hub blocks intro](https://docs.continue.dev/hub/blocks/intro)
- [Continue Hub](https://hub.continue.dev)

---

## 2. Manifest Format Comparison

| Feature | Claude Code | Codex | OpenCode | Goose | Aider | Continue |
|---|---|---|---|---|---|---|
| **Manifest file** | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` | None (JS export) | None (config.yaml) | None | `config.yaml` |
| **Manifest format** | JSON | JSON | N/A | YAML | N/A | YAML |
| **Required fields** | `name` | `name`, `version`, `description` | N/A | `version`, `title` | N/A | `name`, `version`, `schema` |
| **Versioning** | semver in manifest or marketplace | semver | N/A | semver in recipe | N/A | semver |
| **Skills format** | `SKILL.md` (frontmatter) | `SKILL.md` (frontmatter) | `SKILL.md` (frontmatter) | YAML recipes | N/A | Rules + Prompts |
| **MCP config** | `.mcp.json` | `.mcp.json` | `opencode.json` mcp field | `config.yaml` extensions | N/A | `config.yaml` mcpServers |
| **Hooks/events** | `hooks/hooks.json` | Not documented | JS hook functions | N/A | N/A | N/A |
| **Agents** | `agents/*.md` (frontmatter) | Not documented | Agent config in JSON | N/A | N/A | N/A |
| **App connectors** | Via MCP servers | `.app.json` | Via MCP servers | Via MCP extensions | N/A | Via MCP servers |
| **LSP support** | `.lsp.json` | Not documented | Built-in LSP config | N/A | N/A | N/A |
| **User config** | `userConfig` in manifest | Not documented | N/A | Recipe parameters | N/A | N/A |

---

## 3. Installation Mechanism Comparison

| Feature | Claude Code | Codex | OpenCode | Goose | Aider | Continue |
|---|---|---|---|---|---|---|
| **Install command** | `/plugin install name@marketplace` | `/plugins` (interactive) | npm config or local copy | `goose configure` | N/A | Hub import via `uses:` |
| **Marketplace** | Git-based marketplace repos | Plugin Directory (centralized) | None (community list) | None (MCP ecosystem) | N/A | Hub (hub.continue.dev) |
| **Scopes** | user, project, local, managed | user, project | project, global | global | N/A | local, Hub-synced |
| **Cache location** | `~/.claude/plugins/cache/` | `~/.codex/plugins/cache/` | `~/.cache/opencode/` | N/A | N/A | N/A |
| **Auto-update** | Per-marketplace toggle | Not documented | N/A | N/A | N/A | Hub sync |
| **Distribution** | Git repos, URLs, local paths | Git repos, directory | npm, local files | YAML files, deeplinks, GitHub | N/A | Hub registry |
| **Team sharing** | Project scope + `extraKnownMarketplaces` | Project-level marketplace | Project config | Shared recipes | N/A | Shared config.yaml |

---

## 4. MCP Configuration Comparison

The `.mcp.json` / `mcpServers` configuration is converging on a de facto standard across all tools that support MCP.

**Common schema:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["arg1", "arg2"],
      "env": { "KEY": "value" }
    }
  }
}
```

| Tool | Config location | Transport types | Variable substitution |
|---|---|---|---|
| **Claude Code** | `.mcp.json` (plugin) or settings | stdio, HTTP | `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` |
| **Codex** | `.mcp.json` (plugin) or config | stdio, HTTP | Similar to Claude Code |
| **OpenCode** | `opencode.json` `mcp` field | stdio, remote (HTTP) | `{env:VAR}`, `{file:path}` |
| **Goose** | `~/.config/goose/config.yaml` | stdio, HTTP (streamable) | N/A |
| **VS Code** | `.vscode/mcp.json` | stdio, HTTP | `${env:VAR}`, `${workspaceFolder}` |
| **Continue** | `config.yaml` `mcpServers` | stdio, SSE | Standard YAML references |
| **Amazon Q** | `.amazonq/mcp.json` | stdio | N/A |
| **Cursor** | `.cursor/mcp.json` | stdio, HTTP | N/A |

**Key finding:** The `mcpServers` schema with `command`/`args`/`env` fields is effectively standard. The main variation is where it lives (standalone `.mcp.json` vs. embedded in a larger config file) and what variable substitution is supported.

---

## 5. Cross-Platform Distribution Feasibility Analysis

### 5.1 What can be shared today

**SKILL.md files** — The highest-portability format. Claude Code, Codex, and OpenCode all use the exact same SKILL.md format with identical frontmatter fields (`name`, `description`, `license`, `compatibility`, `metadata`). A single `skills/` directory can be consumed by all three tools. OpenCode explicitly supports `.claude/skills/` and `.agents/skills/` paths for cross-compatibility.

**MCP server configurations** — The `mcpServers` schema is nearly identical across tools. A shared `.mcp.json` file can work across Claude Code, Codex, VS Code, Cursor, and others with minimal adaptation. The main challenge is variable substitution (each tool uses different syntax for environment variables and plugin root paths).

### 5.2 What cannot be shared today

**Plugin manifests** — Claude Code uses `.claude-plugin/plugin.json`, Codex uses `.codex-plugin/plugin.json`. The schemas are very similar but not identical (Codex adds `apps`, `interface`; Claude Code adds `channels`, `lspServers`, `userConfig`). A single plugin directory cannot be simultaneously consumed by both without one or the other ignoring the foreign manifest.

**Hooks** — Claude Code has a rich JSON-based hook system. OpenCode uses JavaScript hook functions. Goose and Continue have no equivalent. Hooks are not portable.

**Agents** — Claude Code uses markdown files with frontmatter. No other tool uses this format (though the concept of "agents" exists in OpenCode and Continue via different mechanisms).

**Recipes** — Goose's YAML recipe format is unique to Goose. It covers a different abstraction (workflow orchestration) than skills (instructions).

### 5.3 Could a single repo serve multiple tools?

**Yes, with a multi-manifest approach.** A plugin repo could contain:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json              # Claude Code manifest
├── .codex-plugin/
│   └── plugin.json              # Codex manifest
├── skills/                       # Shared (Claude Code, Codex, OpenCode)
│   └── my-skill/
│       └── SKILL.md
├── .mcp.json                     # Shared MCP config (all tools)
├── agents/                       # Claude Code specific
├── hooks/                        # Claude Code specific
├── .app.json                     # Codex specific
├── recipe.yaml                   # Goose specific
└── config.yaml                   # Continue block
```

Both Claude Code and Codex will look for their respective `.{tool}-plugin/plugin.json` and ignore the other. Skills and MCP configurations are already cross-compatible.

### 5.4 The `.agents/` convention

A nascent cross-platform convention is emerging around `.agents/` as a tool-agnostic directory:
- OpenCode supports `.agents/skills/` for skill loading
- Codex uses `$REPO_ROOT/.agents/plugins/marketplace.json` for local marketplace entries
- This suggests `.agents/` may become the cross-tool standard directory

### 5.5 Convergence trajectory

The market is clearly converging. Codex explicitly designed its plugin format to be cross-compatible with Claude Code. OpenCode adopted Claude Code's SKILL.md format and skill paths. MCP configuration is already effectively standardized.

The remaining divergences are:
1. **Manifest location and schema** — Different `.{tool}-plugin/` directories, slightly different fields
2. **Hook systems** — No convergence; each tool has its own approach
3. **Marketplace protocol** — Claude Code's git-based marketplace.json is the most developed; Codex is similar but not identical
4. **App/connector abstractions** — Codex has `.app.json`; Claude Code routes everything through MCP

---

## 6. Recommendations for PMCode's Plugin Strategy

### 6.1 Adopt the Claude Code plugin format as primary

Claude Code has the most mature, best-documented, and most widely-adopted plugin system. Codex explicitly mirrors it. PMCode should:

- Use `.claude-plugin/plugin.json` as its primary manifest format
- Support the full Claude Code plugin directory structure
- Read `marketplace.json` from Claude Code-format marketplace repos
- This ensures PMCode plugins can be installed in Claude Code and vice versa

### 6.2 Support SKILL.md as the universal skill format

SKILL.md is the clear winner for portable skill definitions. It is supported by Claude Code, Codex, and OpenCode with identical syntax. PMCode should:

- Parse SKILL.md with gray-matter (already implemented)
- Search the same directories: `.claude/skills/`, `.agents/skills/`, project `skills/`
- Enforce the same validation rules (name regex, description length)
- This is already partly implemented in PMCode's SkillParser

### 6.3 Use standard .mcp.json for MCP configuration

The `mcpServers` schema with `command`/`args`/`env` is the de facto standard. PMCode should:

- Read `.mcp.json` files from plugins using the standard schema
- Support both stdio and HTTP transports
- Support `${CLAUDE_PLUGIN_ROOT}` variable substitution for compatibility

### 6.4 Build a marketplace that serves both Claude Code and PMCode

PMCode's marketplace repo should:

- Include `.claude-plugin/marketplace.json` so it works as a Claude Code marketplace
- Include `.codex-plugin/marketplace.json` if Codex marketplace support diverges
- Each plugin in the marketplace should have both manifests if it uses tool-specific features
- Skills and MCP configs should be shared across manifests

### 6.5 Do not invest in Goose or Continue compatibility

Goose uses a fundamentally different model (MCP extensions + YAML recipes) with no plugin package system. Continue uses composable config.yaml blocks with a centralized Hub. Neither tool's format is converging toward the Claude Code/Codex standard. Supporting them would require separate abstractions without clear user demand.

### 6.6 Watch the `.agents/` convention

The `.agents/` directory is emerging as a cross-platform standard for AI tool configuration. PMCode should:

- Support reading skills from `.agents/skills/` in addition to `.claude/skills/`
- Consider writing PMCode-specific config to `.agents/pmcode/` rather than a custom location
- This positions PMCode to benefit from future standardization

### 6.7 Consider dual-manifest plugin template

For PMCode's plugin authoring tools, provide a template that generates both `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` from a single source of truth. This maximizes the distribution reach of PMCode-authored plugins.

### 6.8 Aider is not relevant to plugin strategy

Aider has no plugin system and no plans for one. It is a focused pair-programming tool. PMCode does not need to consider Aider compatibility.

---

## Summary

The AI coding tool plugin ecosystem in April 2026 has converged around two key standards:

1. **SKILL.md** — Universal skill definition format (Claude Code, Codex, OpenCode)
2. **mcpServers JSON schema** — Universal MCP server configuration (all MCP-supporting tools)

The plugin packaging layer (manifests, marketplaces, installation) has converged between Claude Code and Codex but remains fragmented elsewhere. PMCode should align with the Claude Code/Codex format as its primary target while keeping skills and MCP configs in portable formats.
