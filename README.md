# PM Code

A VS Code extension that helps non-technical users (Product Managers, Designers) onboard to AI IDEs, manage Agent Skills and Connectors, and follow in-app guides with step-by-step instructions.

PM Code targets users with zero VS Code familiarity entering the IDE for the first time to work with AI agents. It progresses from a guided onboarding companion to a command center to invisible plumbing as users gain confidence.

## Install

**All platforms (macOS, Linux, Windows):**

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

## Design

See [docs/superpowers/specs/2026-03-30-pmcode-extension-design.md](docs/superpowers/specs/2026-03-30-pmcode-extension-design.md) for the full design spec.

## License

Private — not yet published.
