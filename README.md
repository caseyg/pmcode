# PM Code

A VS Code extension that helps non-technical users (Product Managers, Designers) onboard to AI IDEs, manage Agent Skills and Connectors, and follow in-app guides with step-by-step instructions.

PM Code targets users with zero VS Code familiarity entering the IDE for the first time to work with AI agents. It progresses from a guided onboarding companion to a command center to invisible plumbing as users gain confidence.

## Install

### From source (any machine)

Requires: git, Node.js (v18+), VS Code (or Cursor/Windsurf)

```bash
git clone https://github.com/caseyg/pmcode.git
cd pmcode
npm install
npm run compile
npx @vscode/vsce package --no-dependencies
code --install-extension pmcode-0.1.0.vsix
```

For Cursor or Windsurf, replace `code` with `cursor` or `windsurf`.

After installing, restart your editor and look for the purple **PM** icon in the Activity Bar.

### One-liner (macOS, Linux, Windows)

```bash
curl -fsSL https://raw.githubusercontent.com/caseyg/pmcode/main/install.sh | bash
```

On Windows, run from Git Bash — the script auto-detects the platform and bootstraps PowerShell if available.

**Windows (PowerShell directly):**

```powershell
iwr -useb https://raw.githubusercontent.com/caseyg/pmcode/main/install.ps1 | iex
```

## What it does

- **Skills** — Pre-built AI workflows for common PM tasks (idea triage, sprint retro, PRD writing, competitive research). Uses the [agentskills.io](https://agentskills.io) SKILL.md format.
- **Connectors** — Zero-config setup for Jira, GitHub, Monday, Aha!, and Tavily. Forms for everything, no JSON editing.
- **Guides** — Step-by-step walkthroughs that teach VS Code concepts implicitly through use: getting started, project context, team collaboration, idea triage.
- **Marketplace** — Install skills and connectors from a git-based marketplace. Update from the sidebar.
- **Dashboard** — Companion panel showing connector health, recently used skills, guide progress, and quick action prompts.

## Architecture

```
┌─────────┬──────────────┬──────────────────────────────────┐
│Activity │  PM Code     │  Center Panel (Editor Area)       │
│  Bar    │  Sidebar     │                                   │
│         │              │  Skills List / Skill Detail /     │
│  [PM]◄──│ Search       │  Connectors / Guides /            │
│         │ Skills       │  Dashboard / Marketplace          │
│         │ Connectors   │                                   │
│         │ Guides       │                                   │
│         │ Marketplace  │                                   │
│         │ Roo status   │                                   │
└─────────┴──────────────┴──────────────────────────────────┘
```

- **Sidebar**: WebviewViewProvider with search, navigation buttons, marketplace update, Roo Code status
- **Center Panels**: WebviewPanels for all list and detail views — skills, connectors, guides, dashboard, marketplace browse
- **Provider Adapter**: Pluggable AI provider integration (Roo Code for MVP)

## Development

```bash
npm install
npm run compile    # esbuild bundle
npm test           # vitest (299 tests)
```

### Project structure

```
src/
├── extension.ts           # Entry point
├── commands/              # Command handlers (core, navigation, connectors, skills, guides, system, marketplace)
├── sidebar/               # WebviewViewProvider
├── panels/                # All center panel WebviewPanels + shared utils
├── connectors/            # ConnectorManager + 5 adapter definitions
├── skills/                # SkillParser, SkillLoader, SkillManager
├── guides/                # GuideEngine with 4 bundled guides
├── providers/             # ProviderAdapter interface + RooCodeAdapter
├── config/                # ConfigManager, EnvManager, ConfigVersioning
├── marketplace/           # MarketplaceRegistry (git-based)
└── system/                # DependencyChecker, SetupProgress
```

## Configuration

All state lives in `~/.pmcode/`:

```
~/.pmcode/
├── .env              # API tokens (JIRA_API_TOKEN, etc.)
├── config.json       # UI state, FTUE progress, preferences
├── skills/           # Installed skills (SKILL.md format)
├── connectors/       # Connector settings (non-secret)
├── guides/           # Guide progress
├── marketplace/      # Git clone of marketplace repo
└── history/          # Config snapshots for rollback
```

## Testing with Claude computer use

You can use Claude with computer use to visually test the extension end-to-end. Launch the Extension Development Host, then have Claude interact with the UI via screenshots and mouse/keyboard actions.

### Setup

1. Clone and build:
   ```bash
   git clone https://github.com/caseyg/pmcode.git
   cd pmcode
   npm install
   npm run compile
   ```

2. Launch the Extension Development Host:
   ```bash
   code --extensionDevelopmentPath="$(pwd)"
   ```
   This opens a new VS Code window with PM Code loaded. Leave it in the foreground.

### What to test

Give Claude these instructions along with a screenshot of the VS Code window:

**Sidebar:**
- Click the purple **PM** icon in the Activity Bar (left edge). Verify the sidebar opens with search bar, Skills/Connectors/Guides/Marketplace buttons, and Roo Code status.
- Type in the search bar. Verify filter chips appear and results update.
- Click the **Update** button in the Marketplace section.

**Skills panel:**
- Click **Skills** in the sidebar. Verify a center panel opens showing skill cards (Idea Triage, Sprint Retro, PRD Writer).
- Click a skill card. Verify the detail panel opens with description, connector requirements, and "Send to Roo" buttons.

**Connectors panel:**
- Click **Connectors** in the sidebar. Verify cards appear for Jira, GitHub, Monday, Aha!, Tavily with status dots.
- Click a connector card. Verify the config form renders with fields (URL, API token), Test Connection button, and example prompts.

**Guides panel:**
- Click **Guides** in the sidebar. Verify guide cards appear with step counts and estimated time.
- Click a guide. Verify the left rail shows numbered steps and the main area shows step content with "Send to Roo" prompt buttons and Previous/Next navigation.

**Dashboard:**
- Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P), type "PM Code: Open Dashboard".
- If FTUE not completed: verify Quick Start checklist, Roo Code status, system dependencies, recommended guides.
- If FTUE completed: verify connector health grid, recently used skills, guide progress, quick action buttons.

**FTUE Walkthrough:**
- Open Command Palette, type "PM Code: Reset First-Time Experience", then "PM Code: Open Dashboard".
- Verify the companion phase renders with the 4-step Quick Start checklist.

### Command palette smoke test

Open Command Palette and verify these commands are registered (type "PM Code"):
- PM Code: Open Skills / Open Connectors / Open Guides
- PM Code: Open Dashboard
- PM Code: Browse Marketplace / Update Marketplace
- PM Code: Send Prompt to Roo
- PM Code: Health Check
- PM Code: Check Dependencies

### Tips for Claude computer use

- After clicking a sidebar button, wait ~500ms for the center panel to render before taking a screenshot.
- Webview panels use VS Code theme colors — dark/light theme both work.
- If the PM icon doesn't appear in the Activity Bar, the extension may not have activated. Check the Output panel (View → Output → select "PM Code" from dropdown) for errors.
- To reset all state: `rm -rf ~/.pmcode` and reload the window.

## Design

See [docs/superpowers/specs/2026-03-30-pmcode-extension-design.md](docs/superpowers/specs/2026-03-30-pmcode-extension-design.md) for the full design spec.

## License

Private — not yet published.
