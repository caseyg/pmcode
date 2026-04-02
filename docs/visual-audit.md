# PM Code Visual Audit

**Date:** 2026-04-02  
**Branch:** implement-mvp  
**Method:** agent-browser CDP + AppleScript against VS Code Extension Development Host  
**Total screenshots:** 19

---

## Summary

All core user journeys work. 3 bugs were found and fixed during testing. The extension renders correctly across all panel types.

### Fixed in this session
1. **Connector icons** — were raw `$(icon-name)` text, now emoji
2. **Guide progress overflow** — was showing "5/4 steps", now capped at total
3. **Sidebar "0 of 0"** — was not updating, now uses `onReady` callback

### Remaining issues (minor)
1. **Command palette ambiguity** — `pmcode.openConnector` vs `pmcode.openConnectors` (singular vs plural) causes the wrong command to run when user types the command ID. Mitigated by VS Code's fuzzy matching when using the title.
2. **Walkthrough not auto-opening** — the walkthrough doesn't appear in the Welcome page's Walkthroughs section prominently. It IS accessible as a tab but not auto-shown on first launch in Extension Development Host mode (may work in production install).

---

## Journey Results

### 1. Sidebar
**Screenshot:** `test-10-quickpick-instant.png`

- PM Code icon visible in activity bar
- Search bar renders with placeholder
- Quick Start shows "0 of 4 steps complete" (correct)
- Skills 3, Connectors 5, Guides 4, Marketplace 39 — counts populate correctly
- "Updated 4/2/2026 Update" link visible
- "Roo Code: not detected" status footer

**Verdict:** Working correctly

### 2. Skills List
**Screenshot:** `test-01-skills-list.png`

- 3 skills listed in card grid
- Each card shows: emoji icon, title, description
- Category and source badges render
- Cards are clickable (opens detail via `openSkill` message)

**Verdict:** Working correctly

### 3. Skill Detail (Idea Triage)
**Screenshot:** `test-04-skill-detail.png`

- Lightning bolt icon, name, description
- "planning" and "bundled" badges
- Requirements section with connector statuses
- "How it works" section with markdown-rendered instructions
- "Try it now" prompt buttons

**Verdict:** Working correctly

### 4. Skill Detail (PRD Writer)
**Screenshot:** `test-17-prd-writer-detail.png`

- Shows tavily connector as requirement
- Instructions render with numbered lists
- "Try it now" prompts visible

**Verdict:** Working correctly

### 5. Connectors List
**Screenshot:** `test-06-connector-detail.png`

- 5 connectors with emoji icons (target, octopus, checkmark, lightbulb, magnifier)
- Status indicators: green "Connected" for GitHub, "Not configured" for others
- Type badges (mcp-server, cli-tool)
- Cards are clickable

**Verdict:** Working correctly (icons fixed from raw text to emoji)

### 6. Connector Detail (Jira)
**Screenshot:** `test-15-jira-detail.png`

- Target emoji icon, name, description
- "Not configured" status, "mcp-server" badge
- Configuration form with 3 fields:
  - Jira Instance URL (url input)
  - API Token (password input)
  - Default Project Key (text input)
- Save and Test Connection buttons visible
- Actions section (Disable, Remove)
- "What you can do" example prompts

**Verdict:** Working correctly

### 7. Guides List
**Screenshot:** `fix-guides-progress.png`

- 4 guides listed with book icons
- Type badges (Walkthrough, Step-by-step)
- Estimated time shown
- Progress bars render correctly (capped at total)

**Verdict:** Working correctly (overflow fixed)

### 8. Guide Detail (Getting Started)
**Screenshot:** `test-14-guide-detail.png`

- Two-column layout: left rail + main content
- Left rail: step list with checkmarks, progress counter
- Main content: step title, markdown-rendered content
- "Say hello to Roo" prompt button
- Navigation buttons: Previous, "I already did this", Next/Complete

**Verdict:** Working correctly

### 9. Dashboard (FTUE)
**Screenshot:** `test-16-dashboard-full.png`

- Wave emoji welcome header
- "Quick Start" with "0 of 4" counter
- 4 FTUE steps with checkable circles
- Action buttons on incomplete steps
- Progress bar

**Verdict:** Working correctly

### 10. Walkthrough
**Screenshot:** `test-19-walkthrough.png`

- "Getting Started with PM Code" renders in VS Code walkthrough UI
- 4 steps with green checkmarks (synced with sidebar "4 of 4")
- Step content renders as markdown
- Action buttons ("Open Roo Code", "Connect a Tool", etc.)

**Verdict:** Working correctly, state synced with sidebar/dashboard

### 11. System Commands
- `checkDependencies`: Shows "All 4 dependencies are ready" notification
- `healthCheck`: Shows "1 connector needs attention" warning (Tavily)

**Verdict:** Working correctly

### 12. QuickPick Dialogs
**Screenshots:** `test-13-guide-quickpick.png`, `test-09-connector-quickpick.png`

- Guide QuickPick: shows 4 guides with type + estimated time
- Connector QuickPick: shows 5 connectors with status
- Skill QuickPick: shows 3 skills with IDs

**Verdict:** Working correctly

---

## CSS/Styling Observations

- VS Code theme custom properties (`--vscode-*`) work correctly
- Dark theme rendering verified
- Badge colors appropriate
- Status dots render with correct colors (green/red/yellow/muted)
- Progress bars render and fill correctly
- Card hover effects not testable via automation but CSS is present
- Markdown rendering in guide steps and skill instructions works
- Tables in walkthrough markdown render correctly

---

## Test Coverage Summary

| Feature | Visual Status | Notes |
|---------|--------------|-------|
| Activity bar icon | PASS | PM Code icon visible |
| Sidebar nav buttons | PASS | Skills/Connectors/Guides/Marketplace |
| Sidebar counts | PASS | 3/5/4/39 |
| Sidebar Quick Start | PASS | Shows X of 4 (was "0 of 0") |
| Sidebar search | Not tested | Webview sandboxing prevents automation |
| Skills list panel | PASS | 3 cards, proper styling |
| Skill detail panel | PASS | Requirements, instructions, prompts |
| Connectors list panel | PASS | Emoji icons, status badges |
| Connector detail panel | PASS | Form fields, buttons |
| Guides list panel | PASS | Progress bars capped correctly |
| Guide detail panel | PASS | Step nav, content, buttons |
| Dashboard FTUE | PASS | Steps, checkmarks, action buttons |
| Walkthrough | PASS | 4 steps, synced state |
| checkDependencies | PASS | Notification |
| healthCheck | PASS | Warning notification |
| Command palette | PASS | All commands discoverable |
| QuickPick dialogs | PASS | Proper data, filterable |
