---
name: prd-writer
description: Draft product requirements documents with market research, user stories, and acceptance criteria. Uses web search to ground recommendations in current market data and competitive context.
license: MIT
metadata:
  author: pmcode
  version: "1.0"
  category: planning
  connectors: tavily
allowed-tools: Bash(git:*) Read
---

## Instructions

When the user asks to write a PRD, follow these steps:

1. **Clarify scope**: Ask the user for the feature or product name, the problem it solves, and the target audience. If they provide a one-liner, ask follow-up questions to fill gaps before drafting.

2. **Research**: Use web search to gather current context:
   - How competitors solve the same problem
   - Relevant industry trends or benchmarks
   - Common user expectations in this space
   - Any regulatory or compliance considerations

3. **Draft the PRD** with these sections:
   - **Overview**: One-paragraph summary of what is being built and why
   - **Problem statement**: The user pain point, supported by research findings
   - **Goals and success metrics**: Measurable outcomes (e.g., reduce time-to-X by 30%)
   - **User stories**: 5-10 user stories in "As a [role], I want [action] so that [benefit]" format, each with acceptance criteria
   - **Scope**: What is included in this release and what is explicitly excluded
   - **Design considerations**: UX principles, accessibility requirements, platform constraints
   - **Technical notes**: Non-functional requirements, integration points, data model changes (flag for engineering review)
   - **Open questions**: Unresolved decisions that need stakeholder input
   - **Competitive landscape**: Summary table of how 2-3 competitors approach this problem, sourced from research

4. **Review and iterate**: Present the draft and ask the user to flag sections that need revision. Offer to expand any section, add diagrams (as Mermaid markup), or adjust the level of detail.

5. **Export**: Save the final PRD as a markdown file in the workspace. Offer to create a summary version suitable for a Jira epic description or a stakeholder email.
