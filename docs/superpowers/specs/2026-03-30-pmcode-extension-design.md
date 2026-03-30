# PM Code — VS Code Extension Design Spec

**Date:** 2026-03-30
**Status:** Approved design, pending implementation plan

## Overview

PM Code is a VS Code extension that helps non-technical users (Product Managers, Designers) onboard to an AI IDE, manage Agent Skills and Connectors (MCP, CLI, API), and follow in-app guides with step-by-step instructions and visuals. It targets users with zero VS Code familiarity who are entering the IDE for the first time to work with AI agents.

### Core Principles

1. **Learning companion first, command center second, invisible plumbing third** — the extension progresses from guided onboarding (C) to a contextual dashboard (B) to background infrastructure (A) as users gain confidence.
2. **Zero JSON, zero terminal** in the default user path. Forms for everything, with an Advanced escape hatch.
3. **Works with VS Code, not against it** — coexists with native UI, teaches VS Code concepts implicitly through use rather than hiding them.
4. **Client-focused on Roo Code** — MVP targets Roo Code as the primary AI provider. Architecture supports adding providers later via an adapter layer.
5. **Pre-installed defaults** — ships with a curated stack of skills and connectors. Users start productive, not from scratch.
6. **Command-driven architecture** — every screen and action is a VS Code command, enabling agent automation, keyboard shortcuts, and command palette access.
7. **Open standards** — skills use the agentskills.io SKILL.md format. Configuration is compatible with Anthropic's plugin marketplace manifest. Cross-compatible with skills.sh and ~/.agents.

### Non-Goals

- Does not implement agent chat (client-agnostic — works with different AI extension providers).
- Does not replace or wrap the Roo Code UI.
- Does not expose raw MCP server configuration to default users.

---

## Architecture

### Three Surfaces

PM Code uses three surfaces within VS Code, each with a distinct role:

| Surface | Implementation | Role | Lifecycle |
|---------|---------------|------|-----------|
| **Activity Bar Icon** | `contributes.viewsContainers` | Entry point. Always visible. Badge count for items needing attention. | Permanent |
| **Sidebar** | Full WebviewViewProvider | Search bar + navigation buttons (Skills, Connectors, Guides) + status. Search takes over view when active. | Always available when PM Code icon selected |
| **Center Panels** | WebviewPanel (editor area) | All list views (Skills list, Connectors list, Guides list), all detail views (each skill/connector/guide opens its own webview tab), FTUE wizard, companion dashboard. | Opened on click from sidebar, command, or walkthrough |

### Layout

```
┌─────────┬──────────────┬──────────────────────────────────┐
│Activity │  PM Code     │  Center Panel (Editor Area)       │
│  Bar    │  Sidebar     │                                   │
│         │              │  Skills List / Skill Detail /     │
│  [📁]   │ 🔍 Search    │  Connectors List / Connector /    │
│  [🔍]   │              │  Guides List / Guide Steps /      │
│  [PM]◄──│ [⚡ Skills]   │  FTUE Wizard / Dashboard          │
│  [🤖]   │ [🔌 Connect] │                                   │
│  Roo    │ [📖 Guides]  │                                   │
│         │ ● Roo status │                                   │
└─────────┴──────────────┴──────────────────────────────────┘
```

- **Activity Bar**: PM Code icon (purple "PM") + Roo Code icon as separate sidebar entries.
- **PM Code Sidebar** (~280px): Full webview with search input, Quick Start progress (during FTUE), three navigation buttons, and Roo connection status. No tree views — all webview for layout flexibility.
- **Center Panels**: All content opens in the editor area as WebviewPanels. Clicking "Skills" in the sidebar opens a Skills list panel. Clicking a skill in that list opens a dedicated skill detail webview tab. Multiple panels can be open simultaneously.
- **Roo Code**: Lives in its own sidebar position. PM Code hands off to Roo via prompt injection.

### Sidebar States

The sidebar has only two states:

1. **Default**: Search bar + Quick Start (during FTUE) + three navigation buttons (Skills, Connectors, Guides) with counts and status badges + Roo connection indicator.
2. **Search active**: Typing in the search bar replaces everything below with filtered results grouped by category (Skills, Connectors, Guides, Commands) with match highlighting and filter chips. Clear (✕ or Escape) returns to default.

Clicking any navigation button or search result opens the corresponding center panel.

### Progressive Disclosure (C → B → A)

| Phase | Timeframe | Behavior |
|-------|-----------|----------|
| **C — Learning Companion** | Week 1 | Companion panel auto-opens on launch. Quick Start section prominent in sidebar. Guides recommended proactively. VS Code tips embedded in every panel. |
| **B — Command Center** | Month 1 | Quick Start complete and hidden. Dashboard panel shows connector health, recently used skills, suggested guides. Opens on click, not automatically. |
| **A — Invisible Plumbing** | Month 3+ | Panels stay closed. Sidebar collapsed. Surfaces only via notifications ("Jira token expiring") or explicit open. The agent just works. |

Transition is automatic based on completion signals (FTUE done, N connectors configured, N skills used) with a manual toggle in settings.

---

## First-Time User Experience (FTUE)

### Dual Mechanism

1. **VS Code Walkthrough** (`contributes.walkthroughs`) — the platform-native onboarding checklist. 4 steps, auto-opens on install, appears in Welcome tab.
2. **Companion Panel** (WebviewPanel) — rich interactive content launched by walkthrough step commands. This is where forms, tool pickers, and guided interactions live.

The walkthrough is the spine; the companion panels are the muscles.

### Walkthrough Steps

| Step | Title | Action | Completion Event | VS Code Concept Taught |
|------|-------|--------|-----------------|----------------------|
| 1 | Meet your AI assistant | Opens Roo Code sidebar | `onView:roocode.sidebar` | Sidebars |
| 2 | Connect your first tool | Opens Connector picker panel | `onCommand:pmcode.connectorConfigured` | Editor panels |
| 3 | Try talking to your AI | Copies prompt + opens Roo | `onCommand:pmcode.firstPromptSent` | Chat interaction |
| 4 | You're ready to go | Opens companion dashboard | `onView:pmcode.dashboard` | Activity bar navigation |

Every step is skippable. Skipped steps appear in the sidebar's Quick Start section for later.

### Background System Dependency Check

During FTUE, the extension checks and installs system dependencies in the background:

**What it checks:** Xcode CLI tools, Node.js (via nvm if missing), Python (via pyenv if missing), gh CLI (via Homebrew).

**UX:** Subtle progress section pinned to the bottom of the companion panel. Human-friendly labels:
- "Developer tools ready" (not "xcode-select installed")
- "Node.js ready" (not "node v22.14.0 detected in PATH")
- "Installing default connectors..." (not "running npx @anthropic/mcp-server-jira")

Expandable "Show details" for curious users. Dismissible completion message: "All set! 5 connectors and 8 skills are ready to use."

### Auto-Detection

On activation, the extension detects:
- **Roo Code**: `vscode.extensions.getExtension('rooveterinaryinc.roo-cline')` or similar
- **App environment**: `vscode.env.appName` for Cursor/Windsurf forks
- **Existing MCP config**: Roo's `cline_mcp_settings.json` and `.roo/mcp.json`
- **Workspace type**: `package.json`, `.git` presence, project structure

---

## Sidebar Design

The sidebar is a single WebviewViewProvider — no tree views.

### Default State

- **Search bar**: Always visible at top. Activates search mode on focus/type.
- **Quick Start** (FTUE only): Compact progress card showing step count and next action. Hides after FTUE completion.
- **Navigation buttons**: Three large buttons — Skills (with installed count), Connectors (with connected count + attention badge), Guides (with available count). Each opens a center panel.
- **Status footer**: Roo Code connection indicator (green dot = connected).

### Search State

- **Filter chips**: [All] [Skills] [Connectors] [Guides] below the search input.
- **Grouped results**: Results grouped by category with match highlighting. Each result shows icon + name + brief description.
- **Commands included**: Slash commands (e.g., `/retro`) appear in search results under a Commands category.
- **Clear**: ✕ button or Escape returns to default state.

### Status Indicators

| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| Active/Connected | Filled circle | Green | Working, no action needed |
| Disabled | Open circle | Muted | Intentionally off |
| Warning | Triangle ! | Yellow | Needs user action (re-auth, update) |
| Error | Circle x | Red | Broken, blocking |
| Loading | Spinner | Default | Operation in progress |

Activity bar badge shows count of items needing attention.

---

## Center Panels

All lists and detail views open as WebviewPanels in the editor area. Each item (skill, connector, guide) opens its own webview tab.

### Skills List Panel

Opens via `pmcode.openSkills` command or sidebar button click.

**Layout:** Grid or list of all installed skills with icon, name, description, and status. Click opens the skill's own detail webview.

### Connector List Panel

Opens via `pmcode.openConnectors` command or sidebar button click.

**Layout:** Grid or list of all connectors with health status, icon, name. Click opens the connector's own config webview.

### Guide List Panel

Opens via `pmcode.openGuides` command or sidebar button click.

**Layout:** Cards showing guide name, description, estimated time, progress bar if in progress. Click opens the guide's own webview.

### Connector Detail Panel

Opens when clicking a connector in the connectors list. Each connector gets its own webview tab.

**Layout:**
- Header: icon + name + description + status badge
- Form fields: Instance URL, API Token, project selector
- "How do I get an API token?" inline help link
- Actions: Test Connection, Disable, Remove
- "What you can do" section: example prompts showing what this connector enables
- Related section: linked Commands, Skills, and Guides

**Connector-specific forms:**
- **Jira**: Instance URL + API token + default project dropdown
- **GitHub (gh CLI)**: Auto-detected via `gh auth status`. One-click "Authorize GitHub" if not logged in.
- **Monday**: Instance URL + API token + board selector
- **Aha!**: Instance URL + API token + product selector
- **Tavily**: API key only (single field)

### Skill Detail Panel

Opens when clicking a skill in the skills list. Each skill gets its own webview tab.

**Layout:**
- Header: icon + name + description + installed status
- Requirements check: shows required connectors with connected/missing status
- "How it works" description (from SKILL.md body)
- **"Try it now"** section: interactive prompt buttons with "Send to Roo →" that inject the prompt into Roo Code's input via `pmcode.sendPrompt`
- Related section: linked Commands (slash commands), Connectors, Skills, and Guides

### Guide Panel

Opens when clicking a guide in the guides list. Each guide gets its own webview tab.

**Layout:**
- Left rail: numbered step list with completion checkmarks and progress bar
- Main content: step title, description (2-3 paragraphs max), visual/screenshot area, interactive prompt buttons ("Send to Roo →"), pro tips
- Bottom nav: Previous / Next step buttons
- Related section: linked Connectors, Skills, Commands, other Guides

**Interactive elements:**
- "Send to Roo →" buttons inject prompts into Roo Code via `pmcode.sendPrompt`
- "Open [panel]" buttons navigate within PM Code via commands
- Copy buttons for prompts and code snippets
- "I already did this" skip option per step

**Progress:** Stored in `~/.pmcode/guides/progress.json`. Resumable — "Continue from Step 3" on re-open.

---

## Default Stack

### Pre-Installed Connectors (5)

| Connector | Type | Auth | What It Enables |
|-----------|------|------|----------------|
| Jira | MCP Server | API token | Read/manage issues, sprints, boards |
| GitHub (gh CLI) | CLI Tool | OAuth via `gh auth` | PRs, issues, repo info, code search |
| Monday | MCP Server | API token | Boards, items, updates |
| Aha! | MCP Server / REST API | API token | Roadmaps, ideas, features, releases |
| Tavily | MCP Server | API key | AI-powered web search for research |

All installed in background during FTUE. Each requires user authentication (API tokens) — the FTUE Step 2 guides through connecting the first one, with remaining connectors configurable later.

### Pre-Installed Skills (8)

| Skill | Description | Required Connectors |
|-------|-------------|-------------------|
| Idea Triage | Evaluate, prioritize, and organize feature ideas | Aha! or Jira or Monday |
| Sprint Retrospective | Generate retro from sprint data and team activity | Jira + GitHub |
| PRD Writer | Draft product requirements documents | Tavily (for research) |
| Competitive Research | Research competitors and market landscape | Tavily |
| Sprint Planning | Plan sprint scope from backlog and capacity | Jira or Monday |
| Standup Summary | Summarize recent team activity for standups | Jira + GitHub |
| User Story Breakdown | Break epics into user stories with acceptance criteria | Jira or Monday |
| Roadmap Review | Analyze roadmap progress and flag risks | Aha! or Jira |

### Guides (4)

| Guide | Type | Steps | Description |
|-------|------|-------|-------------|
| Getting Started with PM Code | VS Code Walkthrough | 4 | FTUE: detect AI, connect first tool, try first prompt |
| Projects, Files & Context | VS Code Walkthrough | 6 | What workspaces are, how AI reads files, context engineering for PMs |
| Sharing Product Context with Your Team | Step-by-step Guide | 7 | Git as collaboration: save, share, branch, review. Product context as AI steering. |
| Triage Ideas Like a Pro | Step-by-step Guide | 6 | Pull ideas from tools, group by theme, prioritize, create next steps |

---

## Skills Format

### agentskills.io SKILL.md Specification

Skills use the [agentskills.io](https://agentskills.io) open format. Each skill is a directory containing a `SKILL.md` file with YAML frontmatter and markdown instructions.

```
skill-name/
├── SKILL.md            # Required: YAML frontmatter + instructions
├── scripts/            # Optional: executable code
├── references/         # Optional: supplementary docs loaded on demand
└── assets/             # Optional: templates, data files
```

**SKILL.md format:**

```markdown
---
name: idea-triage
description: Evaluate, prioritize, and organize feature ideas from Jira, Aha!, or Monday. Use when sorting a backlog, preparing for planning, or reviewing incoming requests.
license: MIT
metadata:
  author: pmcode
  version: "1.0"
  category: planning
  connectors: jira aha monday
allowed-tools: Bash(git:*) Read
---

## Instructions

When the user asks to triage ideas, follow these steps...
```

### Skill Loading Locations

PM Code reads skills from multiple locations, in priority order (highest first):

| Priority | Path | Source |
|----------|------|--------|
| 1 | `./.pmcode/skills/` | Project-local skills (workspace) |
| 2 | `./.agents/skills/` | Cross-agent project skills (skills.sh convention) |
| 3 | `~/.pmcode/skills/` | PM Code global skills |
| 4 | `~/.agents/skills/` | Cross-agent global skills (`npx skills add -g`) |
| 5 | (bundled) | Default skills shipped with the extension |

If the same skill name appears in multiple locations, highest priority wins. Bundled defaults are overridden by any user-installed version.

### Compatibility

- **skills.sh**: `npx skills add pmcode/idea-triage` installs to the appropriate location. PM Code discovers skills installed by skills.sh automatically.
- **Anthropic plugin marketplace**: The `~/.pmcode/` directory includes a `plugin.json` manifest compatible with Anthropic's plugin format. Skills in `~/.pmcode/skills/` follow the same `skills/` directory convention used by Claude Code plugins.

---

## Technical Architecture

### Configuration Home: ~/.pmcode

All PM Code state lives in `~/.pmcode/`. Plain files, portable, inspectable.

```
~/.pmcode/
├── .env                          # API tokens and keys (JIRA_API_TOKEN=xxx, etc.)
├── config.json                   # UI state, FTUE progress, preferences
├── plugin.json                   # Anthropic plugin manifest (compatible)
├── memory/                       # User memory (preferences, context, learned behavior)
│   ├── preferences.md
│   └── context.md
├── skills/                       # agentskills.io SKILL.md format
│   ├── idea-triage/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── sprint-retro/
│   │   └── SKILL.md
│   ├── prd-writer/
│   │   └── SKILL.md
│   └── ...
├── connectors/                   # Connector config (non-secret settings)
│   ├── jira.json
│   ├── github.json
│   ├── monday.json
│   ├── aha.json
│   └── tavily.json
├── guides/                       # Guide progress
│   └── progress.json
└── history/                      # Config snapshots for rollback
    ├── 2026-03-30T10-00.json
    └── 2026-03-30T11-30.json
```

### Credential Storage

- **~/.pmcode/.env**: Source of truth for API tokens and keys. Standard dotenv format. Skills and connectors read from here.
- **Roo's MCP config**: PM Code writes MCP server definitions (including tokens in the `env` block) directly to Roo's config files. No SecretStorage indirection.

### Roo Code MCP Configuration Paths (macOS)

PM Code writes MCP server definitions directly to Roo's config files:

**Global (user-level):**
```
~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json
```

**Project-level (overrides global):**
```
<project-root>/.roo/mcp.json
```

Both use the same format:
```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-jira"],
      "env": {
        "JIRA_URL": "https://myteam.atlassian.net",
        "JIRA_API_TOKEN": "xxx"
      }
    }
  }
}
```

PM Code always reads existing config, merges its servers, and preserves user-added servers. Never overwrites the whole file.

### VS Code Command Registry

Every screen and action is a VS Code command. This enables Roo Code to drive PM Code programmatically, keyboard shortcuts for power users, and command palette access.

**Core:**
| Command | Description |
|---------|-------------|
| `pmcode.sendPrompt {text}` | Send prompt to Roo Code |
| `pmcode.focusSidebar` | Focus the PM Code sidebar |
| `pmcode.search {query}` | Open sidebar with search pre-filled |
| `pmcode.openDashboard` | Open companion dashboard |
| `pmcode.openSettings` | Open PM Code settings |

**Navigation:**
| Command | Description |
|---------|-------------|
| `pmcode.openSkills` | Open Skills list center pane |
| `pmcode.openConnectors` | Open Connectors list center pane |
| `pmcode.openGuides` | Open Guides list center pane |
| `pmcode.openSkill {id}` | Open specific skill detail webview |
| `pmcode.openConnector {id}` | Open specific connector config webview |
| `pmcode.openGuide {id}` | Open specific guide webview |

**Connector Actions:**
| Command | Description |
|---------|-------------|
| `pmcode.connector.install {id}` | Install a connector |
| `pmcode.connector.configure {id}` | Open connector config form |
| `pmcode.connector.test {id}` | Test connector health |
| `pmcode.connector.enable {id}` | Enable a connector |
| `pmcode.connector.disable {id}` | Disable a connector |
| `pmcode.connector.remove {id}` | Remove a connector |

**Skill Actions:**
| Command | Description |
|---------|-------------|
| `pmcode.skill.install {id}` | Install a skill |
| `pmcode.skill.remove {id}` | Remove a skill |
| `pmcode.skill.run {id}` | Run skill (inject prompt into Roo) |

**Guide Actions:**
| Command | Description |
|---------|-------------|
| `pmcode.guide.start {id}` | Start or resume a guide |
| `pmcode.guide.completeStep {id} {step}` | Mark step complete |
| `pmcode.guide.reset {id}` | Reset guide progress |

**System:**
| Command | Description |
|---------|-------------|
| `pmcode.checkDependencies` | Run system dependency check |
| `pmcode.healthCheck` | Check all connector health |
| `pmcode.rollback` | Rollback config to previous state |
| `pmcode.resetFTUE` | Reset first-time experience |

### Extension Structure

```
pmcode/
├── package.json              # Extension manifest, contributions, command registration
├── src/
│   ├── extension.ts          # Activation, command registration
│   ├── commands/             # Command handlers (one per command group)
│   │   ├── core.ts           # sendPrompt, search, dashboard, settings
│   │   ├── navigation.ts     # openSkills, openConnectors, openGuides, openSkill, etc.
│   │   ├── connectors.ts     # connector.install, configure, test, enable, disable, remove
│   │   ├── skills.ts         # skill.install, remove, run
│   │   ├── guides.ts         # guide.start, completeStep, reset
│   │   └── system.ts         # checkDependencies, healthCheck, rollback, resetFTUE
│   ├── sidebar/
│   │   └── SidebarProvider.ts    # Single WebviewViewProvider (search + nav + status)
│   ├── panels/
│   │   ├── SkillsListPanel.ts    # Skills list WebviewPanel
│   │   ├── ConnectorsListPanel.ts
│   │   ├── GuidesListPanel.ts
│   │   ├── SkillDetailPanel.ts   # Individual skill WebviewPanel
│   │   ├── ConnectorDetailPanel.ts
│   │   ├── GuideDetailPanel.ts
│   │   ├── CompanionPanel.ts     # FTUE wizard + dashboard
│   │   └── PanelManager.ts       # Track open panels, prevent duplicates
│   ├── connectors/
│   │   ├── ConnectorManager.ts   # Lifecycle: install, configure, test, health
│   │   ├── adapters/
│   │   │   ├── JiraAdapter.ts
│   │   │   ├── GitHubAdapter.ts
│   │   │   ├── MondayAdapter.ts
│   │   │   ├── AhaAdapter.ts
│   │   │   └── TavilyAdapter.ts
│   │   └── HealthChecker.ts
│   ├── skills/
│   │   ├── SkillLoader.ts        # Load SKILL.md from all 5 locations
│   │   ├── SkillManager.ts       # Install, remove
│   │   └── SkillParser.ts        # Parse SKILL.md YAML frontmatter + markdown
│   ├── guides/
│   │   ├── GuideEngine.ts        # Markdown parser + step navigation
│   │   └── guides/               # Bundled guide content (Markdown)
│   ├── providers/
│   │   ├── ProviderAdapter.ts    # Interface for AI provider integration
│   │   └── RooCodeAdapter.ts     # Roo Code: MCP config paths, prompt injection
│   ├── config/
│   │   ├── ConfigManager.ts      # Read/write ~/.pmcode/ files
│   │   ├── EnvManager.ts         # Read/write ~/.pmcode/.env
│   │   ├── MemoryManager.ts      # Read/write ~/.pmcode/memory/
│   │   └── ConfigVersioning.ts   # Rollback/undo via ~/.pmcode/history/
│   └── system/
│       ├── DependencyChecker.ts  # Check/install Xcode CLT, Node, Python, gh
│       └── SetupProgress.ts      # Background progress tracking
├── skills/                       # Bundled default skills (copied to ~/.pmcode/skills/ on first run)
│   ├── idea-triage/SKILL.md
│   ├── sprint-retro/SKILL.md
│   └── ...
├── media/                        # Icons, walkthrough images (light/dark)
├── webview-ui/                   # Shared webview assets (CSS, components)
└── test/
```

### Provider Adapter Pattern

```typescript
interface ProviderAdapter {
  readonly provider: string;
  detect(): Promise<boolean>;
  getGlobalMcpConfigPath(): string;
  getProjectMcpConfigPath(workspaceRoot: string): string;
  readMcpConfig(path: string): Promise<McpConfig>;
  writeMcpConfig(path: string, config: McpConfig): Promise<void>;
  injectPrompt(text: string): Promise<void>;
}
```

**RooCodeAdapter** implements this for MVP:
- `getGlobalMcpConfigPath()` → `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
- `getProjectMcpConfigPath(root)` → `${root}/.roo/mcp.json`
- `injectPrompt(text)` → clipboard + focus Roo sidebar (or API if available)

### Rollback / Undo

Every configuration change creates a timestamped snapshot in `~/.pmcode/history/`. Users can:
- Undo the last change via a command (`pmcode.rollback`) or notification action
- "Reset to working state" from the connector panel when things break
- View configuration history (power user feature)

### Performance

- Activation target: under 100ms
- Activation events: `onView:pmcode.sidebar`, `onCommand:pmcode.*`, `onStartupFinished` (for background dependency check)
- Heavy operations (health checks, dependency installs) deferred to after activation
- Webview panels lazy-loaded on first open

---

## Marketplace

### Git-Based Plugin Registry

Skills and connectors are distributed via a git repository that serves as a marketplace. The repo URL is configurable (default TBD). The repo contains a `plugin.json` manifest at its root describing all available items.

**Marketplace repo structure:**
```
marketplace/
├── plugin.json                # Manifest listing all skills and connectors
├── skills/
│   ├── idea-triage/
│   │   └── SKILL.md
│   ├── sprint-retro/
│   │   └── SKILL.md
│   └── ...
└── connectors/
    ├── slack/
    │   └── connector.json
    └── ...
```

**plugin.json format:**
```json
{
  "version": "1.0",
  "skills": [
    {
      "id": "idea-triage",
      "name": "Idea Triage",
      "description": "Evaluate and prioritize ideas",
      "category": "planning",
      "version": "1.0",
      "path": "skills/idea-triage",
      "connectors": ["jira", "aha", "monday"]
    }
  ],
  "connectors": [
    {
      "id": "slack",
      "name": "Slack",
      "description": "Team messaging",
      "version": "1.0",
      "path": "connectors/slack",
      "type": "mcp-server"
    }
  ]
}
```

### Marketplace Lifecycle

1. **Initial sync**: On first use or via "PM Code: Update Marketplace" command, the repo is `git clone --depth 1` to `~/.pmcode/marketplace/`.
2. **Updates**: Subsequent syncs run `git pull --ff-only`. The sidebar shows last-updated date and an "Update" button.
3. **Browse**: The marketplace panel shows all available skills and connectors in a grid with install buttons. Already-installed items show an "Installed" badge.
4. **Install**: Copies the skill/connector directory from the local clone to `~/.pmcode/skills/` or `~/.pmcode/connectors/marketplace/`.
5. **Repo configuration**: Users can point to a private/custom marketplace repo via `pmcode.marketplace.setRepo` command.

### Marketplace State

```
~/.pmcode/
├── marketplace/              # Git clone of the marketplace repo (gitignored from user's projects)
│   ├── .git/
│   ├── plugin.json
│   ├── skills/
│   └── connectors/
└── marketplace-state.json    # Last-updated timestamp, repo URL
```

### Marketplace Commands

| Command | Description |
|---------|-------------|
| `pmcode.marketplace.sync` | Clone or pull the marketplace repo |
| `pmcode.marketplace.browse` | Open marketplace browse panel |
| `pmcode.marketplace.installSkill {id}` | Install a skill from the marketplace |
| `pmcode.marketplace.installConnector {id}` | Install a connector from the marketplace |
| `pmcode.marketplace.setRepo {url}` | Configure the marketplace git repo URL |

### Sidebar Integration

The sidebar includes a Marketplace nav button (below Skills/Connectors/Guides) showing the total count of available items. Below it, the last-synced date and an "Update" button for one-click marketplace refresh.

---

## Installation

PM Code is distributed as a `.vsix` file and installed via a cross-platform install script, since it is not published to the VS Code marketplace.

### Install Script (install.sh / install.ps1)

**Unix (macOS/Linux):**
```bash
curl -fsSL https://raw.githubusercontent.com/caseyg/pmcode/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/caseyg/pmcode/main/install.ps1 | iex
```

**The install script:**
1. Detects the operating system (macOS, Linux, Windows)
2. Detects installed VS Code variants (VS Code, Cursor, Windsurf, VS Code Insiders)
3. Downloads the latest `.vsix` release from GitHub
4. Installs the extension via the `code --install-extension` CLI
5. Creates the `~/.pmcode/` directory structure
6. Verifies the installation succeeded

### Cross-Platform Configuration Paths

| Purpose | macOS | Linux | Windows |
|---------|-------|-------|---------|
| PM Code config | `~/.pmcode/` | `~/.pmcode/` | `%USERPROFILE%\.pmcode\` |
| Roo MCP (global) | `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json` | `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json` | `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json` |
| Roo MCP (project) | `<workspace>/.roo/mcp.json` | `<workspace>/.roo/mcp.json` | `<workspace>\.roo\mcp.json` |
| VS Code extensions | `~/.vscode/extensions/` | `~/.vscode/extensions/` | `%USERPROFILE%\.vscode\extensions\` |

---

## Missing Features for Future Versions

### V1.1
- **Team sharing**: Export/import config bundles. `.pmcode/team-config.json` committed to repo for team defaults.
- **More connectors**: Slack, Confluence, Figma, and user-submitted connectors.

### V2
- **Multi-provider support**: Copilot, Cursor, Continue adapters.
- **Cost awareness**: AI API usage tracking and spending alerts.
- **Skill authoring**: Let users create and share custom skills via skills.sh.
- **PM Code as MCP server**: Register itself via `registerMcpServerDefinitionProvider()` so any AI provider can consume skills/context natively.
- **Analytics**: Track feature usage to inform product decisions (respecting `telemetry.telemetryLevel`).

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| VS Code is intimidating for non-technical users | FTUE teaches VS Code concepts implicitly. Companion panel shields from complexity. Zero JSON/terminal in default path. |
| Platform redundancy — VS Code building native MCP management | Focus on the layer above: curated capabilities, guided setup, and PM-specific skills. Not competing on raw MCP config. |
| Roo Code API changes | Provider adapter pattern isolates the extension from provider internals. Prompt injection via clipboard is the most stable fallback. |
| System dependency installation failures | Graceful degradation — dependencies are best-effort. Show what succeeded, skip what failed, provide manual instructions as fallback. |
| Guide staleness | Guides bundled with extension, updated via marketplace releases. Future: remote guide fetching for faster updates. |
| Scope creep | MVP is tightly scoped: 5 connectors, 8 skills, 4 guides, Roo Code only. Everything else is V1.1+. |

---

## Design References

- [agentskills.io Specification](https://agentskills.io/specification.md) — skill format
- [skills.sh](https://skills.sh/) — skill installation CLI and registry
- [Anthropic Claude Code Plugins](https://github.com/anthropics/claude-code/blob/main/plugins/README.md) — plugin manifest format
- [Roo Code MCP Documentation](https://docs.roocode.com/features/mcp/using-mcp-in-roo) — MCP config paths and format
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Walkthroughs API](https://code.visualstudio.com/api/ux-guidelines/walkthroughs)
- [CodeTour extension](https://github.com/microsoft/codetour) — step-by-step guided walkthroughs
- [Simon Willison: Using Git with Coding Agents](https://simonwillison.net/guides/agentic-engineering-patterns/using-git-with-coding-agents/) — reference for Git guide content
