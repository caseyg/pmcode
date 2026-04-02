# PM Code Visual Audit

**Date:** 2026-04-02  
**Branch:** implement-mvp  
**Method:** Agent-browser CDP automation against VS Code Extension Development Host

---

## Journey Results

### Journey 1: Skills

#### `skills-list.png`
**What I saw:** The Skills panel opened correctly in a new editor tab. It shows "3 skills installed" with cards for:
- `idea-triage` — planning, bundled tags, correct description
- `prd-writer` — planning, bundled tags, correct description
- `sprint-retro` — agile, bundled tags, correct description

Each card has a yellow star icon, title, description, and tag badges. The layout is clean and the panel header/grid renders correctly.

**What worked:** Panel opens, all 3 skills listed, tags render as badges, descriptions are accurate.

**Bugs:** None observed.

---

#### `skill-detail-idea-triage.png`
**What I saw:** The idea-triage skill detail panel opened in a new tab. It shows:
- Skill name with a lightning bolt icon
- Description and tags (planning, bundled)
- "Requirements" section listing jira, aha, and monday — all shown as "Not configured" in red
- "How it works" section
- "Instructions" section with numbered steps (Gather ideas, Categorize, Evaluate)

**What worked:** Panel opens from quickpick selection, requirements section correctly shows unconfigured status, instructions render with proper list formatting.

**Bugs:** None observed in this panel.

---

### Journey 2: Connectors

#### `connectors-list.png`
**What I saw:** The Connectors panel opened showing "5 connectors available". The connector cards appear with their names and status. However, the icon area for each card renders the raw VS Code codicon syntax as plain text rather than as icons:
- `$(issues)` — shown as literal text instead of a Jira/issues icon
- `$(github)` — shown as literal text instead of the GitHub icon
- `$(checklist)` — shown as literal text instead of a checklist icon
- `$(lightbulb)` — shown as literal text instead of a lightbulb icon
- `$(search)` — shown as literal text instead of a search icon

Status indicators render correctly (GitHub shows "Connected", others show "Not configured" or "Needs attention"). Badge labels (mcp-server, cli-tool) render correctly.

**What worked:** Panel opens, 5 connectors listed, status indicators work, badge labels work.

**Bugs:**
- **BUG-001 (P1):** Connector icons render as raw text `$(icon-name)` instead of rendered icons. Root cause: `src/panels/ConnectorsListPanel.ts` line 57 and `src/panels/ConnectorDetailPanel.ts` line 166 both call `escapeHtml(connector.icon)` and place the result directly in HTML. VS Code codicon syntax `$(name)` only works in VS Code native UI elements (labels, QuickPick, StatusBar) — not in webview HTML. The fix is to either map icon IDs to emoji/SVG/Unicode characters, use the VS Code codicons CSS font in the webview (load `@vscode/codicons` via a bundled stylesheet), or replace with emoji equivalents.

---

#### `connector-detail.png`
**What I saw:** The Jira connector detail panel shows:
- Header with `$(issues)` rendered as literal text (same icon bug as list panel)
- "Not configured" status badge
- Configuration form: Jira Instance URL, API Token, Default Project Key fields with placeholder text and helper links
- Save and Test Connection action buttons
- Actions section: Disable, Remove buttons
- "What you can do" section with two example prompt buttons

**What worked:** Configuration form renders correctly with all fields, action buttons are present, example prompts section is visible.

**Bugs:**
- **BUG-001 (repeated):** Icon in detail header shows `$(issues)` as literal text.

---

### Journey 3: Guides

#### `guides-list.png`
**What I saw:** The Guides panel shows "4 guides available":
1. "Getting Started with PM Code" — Walkthrough, 10 min, progress bar shown, **"5 / 4 steps"** label
2. "Projects, Files & Context" — Walkthrough, 10 min, progress bar shown, "1 / 6 steps"
3. "Sharing Product Context with Your Team" — Step-by-step, 20 min, no progress bar
4. "Triage Ideas Like a Pro" — partially visible at bottom

Each guide has a document icon, title, description, badge (Walkthrough/Step-by-step), estimated time, and optional progress bar.

**What worked:** Panel opens, guides listed, progress bars render, badges render correctly.

**Bugs:**
- **BUG-002 (P2):** "Getting Started with PM Code" shows "5 / 4 steps" — completed step count (5) exceeds total step count (4). This indicates stale progress data persisted from a prior version of the guide that had more steps. The guide has since been updated to 4 steps but persisted progress records 5 completed steps. `src/panels/GuidesListPanel.ts` line 66 renders `${completedSteps} / ${totalSteps} steps` without capping `completedSteps` at `totalSteps`. Fix: cap completed steps at total steps when rendering, and/or clean up stale progress on guide load.

---

#### `guide-detail.png`
**What I saw:** "Getting Started with PM Code" guide detail shows:
- Title and description
- All steps listed with green checkmark icons (all complete)
- Progress counter showing steps completed
- "Previous" and "Complete guide" action buttons

**What worked:** Guide detail opens, steps render with checkmarks, navigation buttons present.

**Bugs:**
- **BUG-002 (repeated):** Over-counted steps visible in progress display (5 of 4 completed).

---

### Journey 4: Dashboard

#### `dashboard.png`
**What I saw:** The PM Code dashboard/welcome panel shows:
- Wave emoji "Welcome to PM Code" heading
- "Let's get your AI-powered PM workspace set up." subtitle
- "Quick Start" section with "0 of 4 available" counter
- Numbered steps:
  1. Meet your AI assistant — with a "Try Trellis AI" button
  2. Connect your first tool
  3. You're talking to your AI
  4. You're ready to go

Steps 3 and 4 appear to have green checkmarks (complete state). Steps 1 and 2 appear incomplete.

**What worked:** Dashboard opens, steps render, buttons present, emoji renders.

**Bugs:**
- **BUG-003 (P3):** Quick Start counter in the sidebar shows "0 of 0 steps complete" while the dashboard panel itself shows "0 of 4 available". The sidebar's placeholder text `0 of 0 steps complete` (hardcoded in `src/sidebar/SidebarProvider.ts` line 206) should be updated dynamically on load but may have a timing issue where the message to update it arrives before/after the webview is ready. The sidebar consistently shows "0 of 0" across sessions.

---

### Journey 5: Sidebar

#### `sidebar.png`
**What I saw:** The PM Code sidebar panel shows:
- "PM CODE" header
- Search input: "Search skills, connectors, guides..."
- "Quick Start" section with "0 of 0 steps complete" progress label (see BUG-003)
- Navigation items: Skills, Connectors, Guides, Marketplace (each with an icon and label)
- "Update" button at the bottom

The sidebar layout is clean and functional. The search input placeholder is visible.

**What worked:** Sidebar renders, navigation items all present, icons render correctly (unlike connectors — sidebar likely uses native VS Code UI elements).

**Bugs:**
- **BUG-003 (repeated):** "0 of 0 steps complete" label never updates to reflect actual progress.
- **BUG-004 (P3):** The search input is inside a webview iframe — agent automation could not interact with it. This is expected behavior for webviews, but worth noting that search functionality was not testable via CDP automation.

---

### Journey 6: System

#### `dependencies.png`
**What I saw:** `pmcode.checkDependencies` does not open a panel — it shows a VS Code notification: **"All 4 dependencies are ready."** The notification appears briefly at the bottom right of the window.

**What worked:** Command runs without error, notification fires correctly.

**Bugs:** None — this is working as designed (notification-based output).

---

#### `health-check.png`
**What I saw:** `pmcode.healthCheck` shows a VS Code warning notification: **"1 connector needs attention."** This refers to the Tavily connector which has a "warning" status (likely missing API key or configuration).

**What worked:** Command runs, warning fires correctly, identifies the problematic connector.

**Bugs:** None in the command behavior itself. Tavily connector status is expected to be "warning" until configured.

---

## Prioritized Bug List

### P1 — Critical (breaks visual presentation significantly)

**BUG-001: Connector icons render as raw text `$(icon-name)` in webview panels**
- Affected files: `src/panels/ConnectorsListPanel.ts` (line 57), `src/panels/ConnectorDetailPanel.ts` (line 166)
- Affected screens: Connectors list panel, Connector detail panel (all 5 connectors)
- Root cause: VS Code codicon syntax `$(icon-name)` is not valid in webview HTML — it only works in native VS Code UI label strings. The icon values (`$(issues)`, `$(github)`, `$(checklist)`, `$(lightbulb)`, `$(search)`) are passed through `escapeHtml()` and inserted into `<div>` elements where they render as literal text.
- Fix options:
  1. Map connector icon IDs to emoji (e.g., `$(issues)` → `🎯`, `$(github)` → `🐙`, `$(lightbulb)` → `💡`, `$(search)` → `🔍`, `$(checklist)` → `✅`) in connector adapters or a utility function
  2. Load VS Code codicons CSS font in webviews by bundling `@vscode/codicons` and referencing `codicon codicon-issues` CSS classes
  3. Use inline SVG icons per connector

---

### P2 — High (data integrity / confusing UX)

**BUG-002: Guide progress counter shows more completed steps than total steps ("5 / 4 steps")**
- Affected file: `src/panels/GuidesListPanel.ts` (line 56-66), guide progress storage
- Affected screen: Guides list panel (Getting Started with PM Code card)
- Root cause: The "Getting Started with PM Code" guide was updated to have 4 steps, but persisted progress data from a previous version records 5 completed steps. No capping logic exists.
- Fix: In `GuidesListPanel.ts`, cap `completedSteps` at `totalSteps` when calculating display. Also consider resetting/migrating stale progress when guide step counts change.

---

### P3 — Medium (cosmetic / minor confusion)

**BUG-003: Sidebar Quick Start shows "0 of 0 steps complete" instead of actual progress**
- Affected file: `src/sidebar/SidebarProvider.ts` (line 206, 443)
- Affected screen: Sidebar (persistent throughout all journeys)
- Root cause: The placeholder "0 of 0 steps complete" is hardcoded in the initial HTML. The dynamic update via `postMessage` at line 443 may have a timing issue where the message is sent before the webview's JavaScript is ready to receive it.
- Fix: Send the progress update after the webview fires a `ready` message, or have the webview request progress data on its own `load` event.

**BUG-004: Dashboard Quick Start counter shows "0 of 4 available" while sidebar shows "0 of 0"**
- Related to BUG-003. The dashboard panel and the sidebar webview are inconsistent in their step count display. The dashboard correctly shows 4 total steps; the sidebar shows 0.

---

### Observations (Not Bugs)

- `pmcode.checkDependencies` uses a notification ("All 4 dependencies are ready") rather than a panel — this is intentional and works correctly.
- `pmcode.healthCheck` uses a warning notification ("1 connector needs attention") — intentional, works correctly. The Tavily connector status "warning" is expected when not configured.
- Skills panels (list and detail) render cleanly with no bugs observed.
- Guide detail panel renders correctly aside from the over-counted steps issue.
- Connector configuration form (Jira detail) renders all fields correctly.
- The secondary sidebar (GitHub Copilot Chat) consumes significant horizontal space, making panels in the main editor area quite narrow. This is a VS Code layout concern, not a PM Code bug.
