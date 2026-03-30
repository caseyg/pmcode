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
| **Sidebar** | Hybrid: native TreeView for navigation + WebviewView for search bar | Browse and navigate Skills, Connectors, Guides. Lightweight index, not detail. | Always available when PM Code icon selected |
| **Center Panels** | WebviewPanel (editor area) | Rich detail views: FTUE wizard, connector config forms, skill detail with interactive prompts, step-by-step guides with visuals. | Opened on click from sidebar or walkthrough |

### Layout

```
┌─────────┬──────────────┬──────────────────────────────────┐
│Activity │  PM Code     │  Center Panel (Editor Area)       │
│  Bar    │  Sidebar     │                                   │
│         │              │  FTUE Wizard / Connector Form /   │
│  [📁]   │ 🔍 Search    │  Skill Detail / Guide Steps /     │
│  [🔍]   │              │  Companion Dashboard              │
│  [PM]◄──│ ▼ QUICK START│                                   │
│  [🤖]   │ ▼ SKILLS     │                                   │
│  Roo    │ ▼ CONNECTORS │                                   │
│         │ ▼ GUIDES     │                                   │
└─────────┴──────────────┴──────────────────────────────────┘
```

- **Activity Bar**: PM Code icon (purple "PM") + Roo Code icon as separate sidebar entries.
- **PM Code Sidebar** (~260px): Search input (WebviewView), then TreeView sections for Quick Start, Skills, Connectors, Guides.
- **Center Panels**: Open in the editor area. The FTUE companion panel opens automatically on first launch. Subsequent panels open on user interaction.
- **Roo Code**: Lives in its own sidebar position. PM Code hands off to Roo via prompt injection (clipboard + focus, or API if available).

### Progressive Disclosure (C → B → A)

| Phase | Timeframe | Behavior |
|-------|-----------|----------|
| **C — Learning Companion** | Week 1 | Companion panel auto-opens on launch. Quick Start section prominent in sidebar. Guides recommended proactively. VS Code tips embedded in every panel. |
| **B — Command Center** | Month 1 | Quick Start complete and hidden. Panel becomes contextual dashboard (connector health, recently used skills, suggested guides). Opens on click, not automatically. |
| **A — Invisible Plumbing** | Month 3+ | Panel stays closed. Sidebar collapsed. Surfaces only via notifications ("Jira token expiring") or explicit open. The agent just works. |

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
- **Existing MCP config**: `.mcp.json`, `mcp.json` in workspace and home directory
- **Workspace type**: `package.json`, `.git` presence, project structure

---

## Sidebar Design

### Information Architecture

```
PM Code (Activity Bar Icon)
├── 🔍 Search (WebviewView — input at top)
├── ▼ QUICK START (collapsible, hides after FTUE)
│   └── [Progress: 2/4 steps complete]
│       ├── → Meet your AI assistant
│       ├── ○ Connect your first tool
│       ├── ○ Try talking to your AI
│       └── ○ You're ready to go
├── ▼ SKILLS (TreeView)
│   ├── Installed (badge: count)
│   │   ├── Idea Triage          ● active
│   │   ├── Sprint Retrospective ● active
│   │   ├── PRD Writer           ● active
│   │   └── ... (8 total)
│   └── Browse More...
├── ▼ CONNECTORS (TreeView)
│   ├── Connected (badge: count)
│   │   ├── Jira               ✓ healthy
│   │   ├── GitHub (gh CLI)    ✓ healthy
│   │   ├── Monday             ⚠ needs auth
│   │   ├── Aha!               ✓ healthy
│   │   └── Tavily             ✓ healthy
│   └── + Add Custom...
└── ▼ GUIDES (TreeView)
    ├── Recommended (badge: count)
    │   ├── "Sharing Product Context"  ◻ not started
    │   └── "Triage Ideas Like a Pro"  ◻ not started
    ├── All Guides
    └── Completed
```

### Search

WebviewView pinned to the top of the sidebar container. As-you-type filtering across Skills, Connectors, and Guides with category headers in results. Scope filter chips: [All] [Skills] [Connectors] [Guides].

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

### Connector Detail Panel

Opens when clicking a connector in the sidebar. Form-based configuration, no JSON.

**Layout:**
- Header: icon + name + description + status badge
- Form fields: Instance URL, API Token (stored in SecretStorage), project selector
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

All secrets use `vscode.SecretStorage` (OS keychain). Never stored in settings.json or .mcp.json.

### Skill Detail Panel

Opens when clicking a skill in the sidebar.

**Layout:**
- Header: icon + name + description + installed status
- Requirements check: shows required connectors with connected/missing status
- "How it works" description
- **"Try it now"** section: interactive prompt buttons with "Send to Roo →" that inject the prompt into Roo Code's input
- Related section: linked Commands (slash commands), Connectors, Skills, and Guides

**Installation:** One-click "Install Skill" button. Validates required connectors first — prompts to install missing ones before proceeding. Installation writes provider-specific config (Roo Code's settings format).

### Guide Panel

Opens when clicking a guide in the sidebar.

**Layout:**
- Left rail: numbered step list with completion checkmarks and progress bar
- Main content: step title, description (2-3 paragraphs max), visual/screenshot area, interactive prompt buttons ("Send to Roo →"), pro tips
- Bottom nav: Previous / Next step buttons
- Related section: linked Connectors, Skills, Commands, other Guides

**Interactive elements:**
- "Send to Roo →" buttons inject prompts into Roo Code
- "Open [panel]" buttons navigate within PM Code
- Copy buttons for prompts and code snippets
- "I already did this" skip option per step

**Progress:** Stored in `globalState` with `setKeysForSync()`. Resumable — "Continue from Step 3" on re-open.

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

All installed in background during FTUE. Each requires user authentication (API tokens) — the FTUE Step 2 guides through connecting the first one, with remaining connectors configurable later via sidebar.

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

## Technical Architecture

### Extension Structure

```
pmcode/
├── package.json              # Extension manifest, contributions
├── src/
│   ├── extension.ts          # Activation, registration
│   ├── sidebar/
│   │   ├── SearchViewProvider.ts    # WebviewView for search
│   │   ├── SkillsTreeProvider.ts    # TreeDataProvider
│   │   ├── ConnectorsTreeProvider.ts
│   │   └── GuidesTreeProvider.ts
│   ├── panels/
│   │   ├── CompanionPanel.ts        # FTUE + dashboard WebviewPanel
│   │   ├── ConnectorPanel.ts        # Config forms
│   │   ├── SkillPanel.ts            # Skill detail + interactive prompts
│   │   └── GuidePanel.ts            # Step-by-step guide renderer
│   ├── connectors/
│   │   ├── ConnectorManager.ts      # Lifecycle: install, configure, test, health
│   │   ├── adapters/               # Per-connector implementations
│   │   │   ├── JiraAdapter.ts
│   │   │   ├── GitHubAdapter.ts
│   │   │   ├── MondayAdapter.ts
│   │   │   ├── AhaAdapter.ts
│   │   │   └── TavilyAdapter.ts
│   │   └── HealthChecker.ts         # Periodic health monitoring
│   ├── skills/
│   │   ├── SkillManager.ts          # Install, configure, remove
│   │   ├── SkillRegistry.ts         # Bundled + future remote registry
│   │   └── skills/                  # Bundled skill definitions (JSON)
│   ├── guides/
│   │   ├── GuideEngine.ts           # Markdown parser + step navigation
│   │   └── guides/                  # Bundled guide content (Markdown)
│   ├── providers/
│   │   ├── ProviderAdapter.ts       # Interface for AI provider integration
│   │   └── RooCodeAdapter.ts        # Roo Code-specific: config paths, prompt injection
│   ├── system/
│   │   ├── DependencyChecker.ts     # Check/install Xcode CLT, Node, Python, gh
│   │   └── SetupProgress.ts         # Background progress tracking
│   └── state/
│       ├── StateManager.ts          # Centralized state management
│       └── ConfigVersioning.ts      # Rollback/undo for connector configs
├── media/                           # Icons, walkthrough images (light/dark)
├── webview-ui/                      # Shared webview assets (CSS, components)
└── test/
```

### State Management

| Data | Storage | Syncs Across Machines | Rationale |
|------|---------|----------------------|-----------|
| User preferences | `contributes.configuration` | Yes | Standard VS Code settings |
| Connector configs (non-secret) | `globalStorageUri/connectors.json` | No | Machine-specific paths |
| Secrets (API keys, tokens) | `context.secrets` (SecretStorage) | No | OS keychain encryption |
| Installed skills list | `globalState` + `setKeysForSync` | Yes | Same skills everywhere |
| Guide progress | `globalState` + `setKeysForSync` | Yes | Resume on any machine |
| FTUE completion | `globalState` + `setKeysForSync` | Yes | Don't repeat onboarding |
| Connector health cache | `globalState` (no sync) | No | Ephemeral, re-checked |
| Config version history | `globalStorageUri/config-history/` | No | Local rollback support |

### Provider Adapter Pattern

```typescript
interface ProviderAdapter {
  readonly provider: string;
  detect(): Promise<boolean>;
  getMcpConfigPath(): string;
  writeMcpConfig(servers: McpServerConfig[]): Promise<void>;
  readMcpConfig(): Promise<McpServerConfig[]>;
  injectPrompt(text: string): Promise<void>;  // Send text to AI chat input
}
```

MVP implements `RooCodeAdapter`. Architecture supports adding Copilot, Cursor, Continue adapters later.

### Connector Abstraction

```typescript
interface Connector {
  id: string;
  type: 'mcp-server' | 'cli-tool' | 'rest-api';
  name: string;
  description: string;
  status: 'not-installed' | 'installed' | 'configured' | 'active' | 'error';
  configSchema: ConfigField[];
  healthCheck(): Promise<HealthResult>;
  install(): Promise<void>;
  configure(values: Record<string, string>): Promise<void>;
  test(): Promise<TestResult>;
}
```

### Rollback / Undo

Every connector configuration change creates a timestamped snapshot in `globalStorageUri/config-history/`. Users can:
- Undo the last change via a command or notification action
- "Reset to working state" from the connector panel when things break
- View configuration history (power user feature)

### Performance

- Activation target: under 100ms
- Activation events: `onView:pmcode.sidebar`, `onCommand:pmcode.*`, `onStartupFinished` (for background dependency check)
- Heavy operations (health checks, registry fetches, dependency installs) deferred to after activation
- Webview panels lazy-loaded on first open

---

## Missing Features for Future Versions

### V1.1
- **Team sharing**: Export/import config bundles. `.pmcode/team-config.json` committed to repo for team defaults.
- **More connectors**: Slack, Confluence, Figma, and user-submitted connectors.
- **Connector marketplace**: Remote registry for community connectors.

### V2
- **Multi-provider support**: Copilot, Cursor, Continue adapters.
- **Cost awareness**: AI API usage tracking and spending alerts.
- **Skill authoring**: Let users create and share custom skills.
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

- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Walkthroughs API](https://code.visualstudio.com/api/ux-guidelines/walkthroughs)
- [VS Code SecretStorage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
- [GitLens extension](https://github.com/gitkraken/vscode-gitlens) — hybrid TreeView + WebviewView pattern
- [CodeTour extension](https://github.com/microsoft/codetour) — step-by-step guided walkthroughs
- [Simon Willison: Using Git with Coding Agents](https://simonwillison.net/guides/agentic-engineering-patterns/using-git-with-coding-agents/) — reference for Git guide content
