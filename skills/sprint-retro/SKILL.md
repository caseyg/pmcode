---
name: sprint-retro
description: Generate a sprint retrospective from sprint data and team activity. Pulls completed work from Jira and code contributions from GitHub to build a structured retro with wins, misses, and action items.
license: MIT
metadata:
  author: pmcode
  version: "1.0"
  category: agile
  connectors: jira github
allowed-tools: Bash(git:*) Bash(gh:*) Read
---

## Instructions

When the user asks to run a sprint retrospective, follow these steps:

1. **Identify the sprint**: Ask which sprint to review, or default to the most recently completed sprint in Jira. Confirm the sprint name, dates, and team.

2. **Gather sprint data from Jira**:
   - Pull all issues in the sprint (completed, incomplete, removed)
   - Note the sprint goal and whether it was met
   - Identify stories that spilled over or were descoped
   - Calculate velocity (story points completed vs. committed)

3. **Gather activity from GitHub**:
   - List pull requests merged during the sprint window
   - Note PR review turnaround times
   - Identify any reverts or hotfixes that suggest quality issues
   - Summarize commit activity by contributor

4. **Build the retro summary**:
   - **What went well**: Completed goals, high-velocity items, smooth PRs
   - **What didn't go well**: Missed commitments, long review cycles, scope changes
   - **Surprises**: Unplanned work that entered the sprint, unexpected blockers
   - **Metrics**: Velocity trend, completion rate, average PR cycle time

5. **Generate action items**: Propose 3-5 specific, assignable action items based on patterns observed. Each action item should name a responsible person or role and a target date.

6. **Format for sharing**: Present the retro in a clean format suitable for pasting into Confluence, Notion, or a Slack message. Offer to create a Jira ticket for each action item.
