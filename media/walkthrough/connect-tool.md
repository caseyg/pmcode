## Connect Your First Tool

Connect a tool you already use so your AI assistant can access real project data. This is what makes PM Code powerful — Roo can read your actual tickets, PRs, and boards instead of working from scratch.

### Supported tools

| Tool | What Roo can access | Setup time |
|------|-------------------|------------|
| **Jira** | Issues, sprints, backlogs, epics | ~2 min |
| **GitHub** | Repos, PRs, issues, code | Auto-detected |
| **Monday.com** | Boards, items, updates | ~2 min |
| **Aha!** | Features, releases, ideas | ~2 min |
| **Tavily** | Web search and competitive research | ~1 min |

### How to connect

1. Click **Connect a Tool** above to open the Connectors panel
2. Click a connector to open its configuration page
3. Enter your API credentials (API key or token)
4. Click **Test Connection** to verify it works
5. You're done! Roo can now access your data

### Where are my credentials stored?

Your API keys are stored locally on your machine in `~/.pmcode/.env`. They never leave your computer and are never sent to any server. PM Code only passes them to the tools' own APIs.

### Don't have an API key?

Each connector's configuration page has a **Learn more** link that takes you to the tool's API key setup page. Most tools let you generate a key in under a minute from their settings.
