# PM Code Roadmap & Implementation Plan

**Date:** 2026-03-31
**Inputs:** Codebase analysis, user journey audit (72/72 E2E tests passing), competitive landscape research (10 products analyzed)

---

## Executive Summary

PM Code has solid infrastructure (443 unit tests, clean architecture, 5 connector adapters, 4 guides, 3 bundled skills, marketplace registry). But the critical gap preventing real usage is that **rich panel classes are not wired to commands** -- users see simplified read-only HTML instead of interactive forms and step navigation. The highest-leverage work is connecting existing code, not building new features.

Competitively, PM Code occupies a unique niche: no competitor is a VS Code extension purpose-built for PM workflows. Claude Cowork (standalone desktop app) is the closest threat. The defensible advantage is the SKILL.md marketplace content moat.

---

## Now: Ship a Usable MVP

**Goal:** A PM can install the extension, complete the walkthrough, connect Jira, run a skill, and see results -- all through the UI.

### P0: Wire Rich Panels to Commands (1-2 days)

The biggest bang-for-buck fix. Six panel classes with interactive UIs exist but are never called.

| Task | Files | What changes |
|------|-------|-------------|
| Wire `openSkill` to `SkillDetailPanel.show()` | `src/commands/navigation.ts` | Replace inline `getSkillDetailHtml()` with `SkillDetailPanel.show()`. Users get requirements checks, sample prompts, "Send to Roo" buttons. |
| Wire `openConnector` to `ConnectorDetailPanel.show()` | `src/commands/navigation.ts` | Replace inline `getConnectorDetailHtml()` with `ConnectorDetailPanel.show()`. Users get config form, save/test/disable/remove buttons. |
| Wire `openGuide` to `GuideDetailPanel.show()` | `src/commands/navigation.ts` | Replace inline `getGuideDetailHtml()` with `GuideDetailPanel.show()`. Users get left-rail step nav, progress bar, prompt buttons, pro tips. |
| Wire `openSkills` to `SkillsListPanel.show()` | `src/commands/navigation.ts` | Replace inline `getSkillsListHtml()` with `SkillsListPanel.show()`. |
| Wire `openConnectors` to `ConnectorsListPanel.show()` | `src/commands/navigation.ts` | Replace inline `getConnectorsListHtml()` with `ConnectorsListPanel.show()`. |
| Wire `openGuides` to `GuidesListPanel.show()` | `src/commands/navigation.ts` | Replace inline `getGuidesListHtml()` with list panel. |
| Delete inline HTML generators from `navigation.ts` | `src/commands/navigation.ts` | Remove ~150 lines of duplicate HTML. |

### P0: Fix Connector Configure Flow (1 day)

Currently `connector.configure` just opens a read-only view. Needs to:
1. Wire `ConnectorDetailPanel` form "Save" to `connectorManager.configure()`
2. Wire "Test Connection" button to `connectorManager.testConnection()`
3. Fire `pmcode.connectorConfigured` on successful save (FTUE step)

| Task | Files |
|------|-------|
| Fix configure message handler to call `connectorManager.configure()` directly | `src/panels/ConnectorDetailPanel.ts` |
| Pass current field values when opening connector detail | `src/commands/navigation.ts` |
| Fire `connectorConfigured` after successful configure | `src/panels/ConnectorDetailPanel.ts` |

### P0: Record Skill Usage (< 1 hour)

`config.skills.used` is read by dashboard "Recently Used" but never written. Add one line to `skill.run` command.

| Task | Files |
|------|-------|
| After running a skill, push `skillId` to `config.skills.used` | `src/commands/skills.ts` |

### P1: Populate Marketplace with Anthropic Skills (1 day)

The `anthropics/knowledge-work-plugins` marketplace has 8 PM skills (write-spec, competitive-brief, sprint-planning, etc.). Need to make sync work end-to-end.

| Task | Files |
|------|-------|
| Test marketplace sync with real repo | `src/marketplace/MarketplaceRegistry.ts` |
| Verify skill install copies SKILL.md correctly | `src/marketplace/MarketplaceRegistry.ts` |
| Add installed marketplace skills to SkillManager discovery | `src/skills/SkillLoader.ts` |
| Handle git auth failure gracefully (already done) | `src/commands/marketplace.ts` |

### P1: Polish Walkthrough Content (< 1 day)

The 4 walkthrough markdown files exist but are minimal. Enrich with screenshots, step-by-step instructions, and links to commands.

### P1: Add `out/` to `.gitignore` (1 minute)

### P1: Verify MCP Server Package Names (research)

The adapter definitions reference `@anthropic/mcp-server-jira`, etc. These may not exist on npm. Verify and update to real packages or HTTP MCP endpoints (like the ones in the anthropics/knowledge-work-plugins `.mcp.json`).

---

## Next: Growth & Retention (1-2 months)

**Goal:** Team adoption, broader connector coverage, workflow automation.

### P1: Clean Up Technical Debt

| Task | Impact |
|------|--------|
| Remove duplicate `escapeHtml` / `getNonce` implementations | 3 duplicates → use `panelUtils.ts` exports everywhere |
| Add CSP nonces to any remaining inline HTML | Security hardening |
| Remove unused config fields or wire them up | Reduce confusion about source of truth |
| Fix config dual-track problem (connector/guide state in both config and manager files) | Pick one source of truth per domain |

### P1: MCP Server Compatibility Layer

MCP is the universal connector standard. Allow PM Code to consume any MCP server definition, not just the 5 hardcoded adapters. This instantly unlocks hundreds of integrations.

| Task | Files |
|------|-------|
| Add "Custom MCP Server" connector type | `src/connectors/ConnectorManager.ts` |
| Import MCP config from `.mcp.json` | `src/connectors/ConnectorManager.ts` |
| Auto-discover MCP servers from marketplace plugins | `src/marketplace/MarketplaceRegistry.ts` |

### P1: Skill Chaining / Multi-Step Workflows

PMs should chain skills: "Research competitors -> Generate PRD -> Create Jira tickets."

### P1: Monday.com + Aha! Connector Stabilization

Adapters exist but MCP server packages need verification. Update to use real HTTP MCP endpoints.

### P2: Natural Language Command Palette

PMs type "write a PRD" instead of knowing `pmcode.skill.run`. Add a fuzzy-match layer over the search command.

### P2: Skill Output Export

Export skill results to clipboard, markdown file, Jira ticket format, or Slack message.

### P2: Team Skill Sharing

Share custom skills via marketplace or shared config repo.

### P2: Slack/Teams Connector

Post skill outputs to channels. High-value for PM workflows.

### P2: Analytics Dashboard

Show PMs which skills they use most, connector activity, time saved.

---

## Later: Competitive Moat (3+ months)

**Goal:** Autonomous PM agents, cross-provider support, enterprise features.

| Priority | Feature | Rationale |
|---|---|---|
| P2 | AI agent mode for autonomous PM workflows | "Morning briefing" agents that pull standup notes, check Jira, draft updates |
| P2 | Multi-model support (OpenAI, Gemini, etc.) | Don't lock to single provider |
| P2 | Community marketplace with ratings/reviews | Content flywheel |
| P3 | Visual workflow builder | Drag-and-drop skill chains for non-technical users |
| P3 | Prototype preview panel | Render UI mockups from PRD skills |
| P3 | PostHog/Amplitude analytics connector | PMs analyzing funnels inside VS Code |
| P3 | Linear/Notion bidirectional sync | Embed PM Code in existing PM workflows |
| P3 | Enterprise admin controls + private marketplace | Required for enterprise sales |
| P3 | "Invisible" phase (Phase A month 3+) | Sidebar collapses, surfaces only via notifications |

---

## Implementation Order (Recommended)

```
Week 1:  Wire rich panels to commands (P0)
         Fix connector configure flow (P0)
         Record skill usage (P0)
         Add out/ to .gitignore

Week 2:  Marketplace sync end-to-end (P1)
         Verify/fix MCP server packages (P1)
         Polish walkthrough content (P1)
         Clean up technical debt (P1)

Week 3:  MCP compatibility layer (P1)
         Natural language command palette (P2)
         Skill output export (P2)

Week 4+: Skill chaining (P1)
         Monday/Aha! stabilization (P1)
         Team sharing (P2)
         Slack/Teams connector (P2)
```

---

## Test Coverage Summary

| Layer | Tests | Status |
|-------|-------|--------|
| Unit tests (vitest) | 443 | All passing |
| Integration tests (@vscode/test-electron) | 4 | All passing |
| E2E tests (real VS Code) | 54 | All passing |
| User journey tests | 72 | All passing |
| **Total** | **573** | **All passing** |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Claude Cowork adds VS Code extension | Medium | High | Ship marketplace skills moat fast |
| MCP server packages don't exist | High | High | Use HTTP MCP endpoints from anthropics repo |
| Non-technical users find VS Code too complex | Medium | Medium | Walkthroughs + invisible phase + simplified UI |
| Marketplace skills are low quality | Medium | Medium | Curate Anthropic-authored skills first |
