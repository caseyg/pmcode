# PM Code Design Session Transcript

**Date:** 2026-03-30
**Participants:** User (Product), Claude (Design facilitator + 3 research agents)

---

## Session Overview

Brainstorming and design session for PM Code, a VS Code extension helping non-technical users (PMs, designers) onboard to AI IDEs, manage Agent Skills/Connectors, and follow in-app guides.

---

## Phase 1: Project Setup

- Initialized git repo and pushed to GitHub as private repo: `caseyg/pmcode`

## Phase 2: Research — Three-Agent Exploration

Dispatched three parallel research agents to explore the design from different angles:

### Agent 1: UX Designer

Key findings:
- **Non-technical users are intimidated by VS Code**: command palette, terminal, file tree, and JSON settings are all developer-native. PMs think in tasks/workflows/outcomes, not files/folders.
- **Hybrid sidebar recommended**: Native TreeView for navigation spine + WebviewView for search/detail panels. Mirrors GitLens pattern.
- **Mental models from Notion/Figma/Jira** should guide UI vocabulary: status visibility, composable blocks, properties panels.
- **Zero JSON, zero terminal** in the default path. Forms for everything.
- **Walkthroughs API** for FTUE (5 steps max), each teaching one VS Code concept implicitly.
- **Interactive guides** in WebviewPanels that can trigger VS Code commands and pre-fill forms.
- **Role-based presets** to collapse time-to-first-value.
- **Missing features identified**: team sharing, templates/presets, rollback/undo, accessibility, offline resilience.

### Agent 2: Technical Architect

Key findings:
- **VS Code API landscape**: TreeView + TreeDataProvider for sidebar lists, WebviewViewProvider for rich sidebar content, WebviewPanel for editor-area detail views, Walkthroughs API for onboarding.
- **State management**: globalState (syncs via setKeysForSync), SecretStorage (OS keychain, no sync), globalStorageUri (filesystem), workspaceState (per-workspace).
- **Provider detection**: `vscode.extensions.getExtension()` for extensions, `vscode.env.appName` for forks (Cursor, Windsurf).
- **PM Code as MCP server**: Register via `registerMcpServerDefinitionProvider()` so any AI provider can consume skills/context natively. Most elegant client-agnostic approach.
- **Provider adapter pattern**: Interface with `detect()`, `getMcpConfigPath()`, `writeMcpConfig()`, `injectPrompt()` — one implementation per provider.
- **Connector abstraction**: Unified interface across MCP servers, CLI tools, and REST APIs with lifecycle management (install, configure, test, enable/disable, update, uninstall).
- **Guide engine**: Markdown with YAML frontmatter, parsed with markdown-it/remark, rendered in WebviewPanel with custom directives for interactive elements.
- **Performance**: Activation under 100ms, lazy-load heavy dependencies, defer health checks to after activation.
- **Testing**: Unit tests (Vitest), integration tests (@vscode/test-cli), E2E (WebdriverIO + wdio-vscode-service).

### Agent 3: Devil's Advocate

Key findings:
- **Fundamental tension**: VS Code is a developer tool. The FTUE isn't competing with other extensions — it's competing with the user's instinct to close the window.
- **Scope risk**: "Skills + Connectors + Guides + FTUE + Search + Configuration" is three products in a trench coat. Need a clear MVP.
- **Client-agnostic is the biggest architectural risk**: Each provider has different config formats, MCP support levels, and skill concepts. Recommended picking one provider and going deep.
- **Platform redundancy is existential**: VS Code itself now has native MCP management. Providers are building their own setup UX. PM Code should focus on the layer above — curated capabilities and guided setup.
- **The ONE killer feature**: Zero-config agent readiness. Detect project + provider, install sane defaults, green checkmark in under 2 minutes.
- **Static guides may be obsolete**: The AI agent itself should be the guide. Consider agent-powered onboarding over static walkthroughs.
- **Missing critically: rollback/undo, credential management, workspace awareness, team sharing, cost awareness, health dashboard.**
- **Competitive landscape**: copilot-mcp extension, VS Code native MCP management, Cursor native setup, provider-specific config generators.

## Phase 3: Design Decisions

### Decision 1: Target User Profile
**Question:** Who installs this extension?
**Answer:** The PM/designer installs it themselves (self-motivated, already have VS Code + AI extension).

### Decision 2: Extension Personality
**Question:** What's the relationship between PM Code and the AI chat?
**Answer:** Progressive: starts as **learning companion** (C), becomes **command center** (B), then **invisible plumbing** (A) as users grow.

### Decision 3: Provider Focus
**Question:** How many AI providers for MVP?
**Answer:** Focus on **Roo Code** as the primary provider. Architecture supports adding others later.

### Decision 4: VS Code Familiarity
**Clarification:** Do not assume any VS Code familiarity. Target users may be opening VS Code for the first time.

### Decision 5: Design Approach
**Question:** Three approaches presented — Guided Shell (A), Companion Panel (B), Smart Sidebar (C).
**Answer:** **The Companion Panel** — works WITH VS Code rather than hiding it. Sidebar for navigation, editor panels for rich content. Natural C→B→A progression.

### Decision 6: FTUE Mechanism
**Question:** Can the FTUE use the VS Code Walkthrough provider?
**Answer:** Yes — use both. VS Code Walkthrough for the 4-step checklist spine, WebviewPanels for rich interactive content launched by walkthrough commands.

### Decision 7: Center Panels
**Feedback:** Sidebar should be navigation only. Skills, Connectors, and Guides each need dedicated center panels with rich UI.
**Result:** Three panel types designed — Connector (forms), Skill (interactive prompts), Guide (step-by-step with visuals).

### Decision 8: Default Stack
**Feedback:** Default tools should be pre-installed on load. System dependencies checked/installed in background during FTUE.
**Connectors:** Jira, GitHub (gh CLI), Monday, Aha!, Tavily
**Skills:** Idea Triage, Sprint Retrospective, PRD Writer, Competitive Research, Sprint Planning, Standup Summary, User Story Breakdown, Roadmap Review

### Decision 9: Interactive Panels
**Feedback:** Skill and guide panels need "Send to Roo →" buttons that inject prompts into Roo's input (not just copy). Show related Commands, Connectors, Skills, and Guides on each page.

### Decision 10: Guide Content
**Feedback:** Triage ideas, not bugs. Git guide should focus on collaboration and sharing product context with the team.
**Guides finalized:**
1. Getting Started with PM Code (VS Code Walkthrough)
2. Projects, Files & Context (VS Code Walkthrough) — context engineering for PMs
3. Sharing Product Context with Your Team (Step-by-step) — git as collaboration
4. Triage Ideas Like a Pro (Step-by-step) — idea prioritization workflow

## Phase 4: Spec Written

Final design spec committed to `docs/superpowers/specs/2026-03-30-pmcode-extension-design.md`.

## Visual Artifacts

All visual mockups preserved in `specs/brainstorm-designs/`:
1. `01-welcome.html` — Research agent overview
2. `02-synthesis-overview.html` — Three-agent findings synthesis
3. `03-approaches.html` — Three design approaches with trade-offs
4. `04-layout-wireframe.html` — VS Code window layout wireframe
5. `05-ftue-flow.html` — 4-step first-time user experience flow
6. `06-center-panels-overview.html` — Connector, Skill, and Guide panel mockups
7. `07-updated-design-v1.html` — Background deps, interactive panels, new guides
8. `08-updated-design-v2.html` — Revised: ideas not bugs, git as collaboration
