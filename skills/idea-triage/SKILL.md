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

When the user asks to triage ideas, follow these steps:

1. **Gather ideas**: Pull recent items from the connected project management tool (Jira backlog, Aha! ideas, or Monday items). Focus on items without a priority or status.

2. **Categorize**: Group ideas by theme (e.g., user experience, infrastructure, growth, compliance). Present the grouping for review.

3. **Evaluate**: For each idea, assess:
   - User impact (who benefits, how many)
   - Strategic alignment (does it support current goals?)
   - Effort estimate (small/medium/large)
   - Dependencies (blocked by anything?)

4. **Prioritize**: Suggest a priority ranking using ICE (Impact, Confidence, Ease) or RICE (Reach, Impact, Confidence, Effort) framework. Ask which framework the user prefers.

5. **Act**: Update the items in the source tool with priorities and labels. Create a summary of decisions made.
