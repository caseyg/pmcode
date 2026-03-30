# PM Code Design Session — Literal Transcript

**Date:** 2026-03-30

**Session:** PM Code VS Code Extension Design Brainstorm

---


## User

initialize a new git repo here and push it to github as a private repo


## Assistant

The directory is empty. Let me initialize the repo and push it.


## Assistant

Done. Private repo created and pushed at **caseyg/pmcode**.


## User

add a statusline with claude usage:

#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
# "// empty" produces no output when rate_limits is absent
FIVE_H=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
WEEK=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')

LIMITS=""
[ -n "$FIVE_H" ] && LIMITS="5h: $(printf '%.0f' "$FIVE_H")%"
[ -n "$WEEK" ] && LIMITS="${LIMITS:+$LIMITS }7d: $(printf '%.0f' "$WEEK")%"

[ -n "$LIMITS" ] && echo "[$MODEL] | $LIMITS" || echo "[$MODEL]"


## Assistant

Statusline configured. The script is saved at `~/.claude/statusline-command.sh` and registered in your settings. It will show:

- `[Claude Opus 4.6]` — model name
- `[Claude Opus 4.6] | 5h: 42% 7d: 18%` — with rate limit data when available


## User

I'm designing a VS Code Extension that helps non-technical users e.g. Product Managers and Designers 
onboard to an AI IDE, manage Agent Skills, Connectors (MCP, CLI, API), and use in-app guides with step-by-step instructions and helpful visuals.
It should use a sidebar element for primary navigation (including search across Skills, Connectors, and Guides). And use main panels for FTUE (first time user experience), configuration, and guides. Think about what other features I might be missing but would be valuable to add.
It does not need to implement the agent chat, which should be client agnostic (e.g. work with different extension providers).
Create an agent team to explore this from different angles: one
teammate on UX, one on technical architecture, one playing devil's advocate.


## User

Base directory for this skill: /Users/cag/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.6/skills/brainstorming

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design and get user approval.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Checklist

You MUST create a task for each of these items and complete them in order:

1. **Explore project context** — check files, docs, recent commits
2. **Offer visual companion** (if topic will involve visual questions) — this is its own message, not combined with a clarifying question. See the Visual Companion section below.
3. **Ask clarifying questions** — one at a time, understand purpose/constraints/success criteria
4. **Propose 2-3 approaches** — with trade-offs and your recommendation
5. **Present design** — in sections scaled to their complexity, get user approval after each section
6. **Write design doc** — save to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and commit
7. **Spec self-review** — quick inline check for placeholders, contradictions, ambiguity, scope (see below)
8. **User reviews written spec** — ask user to review the spec file before proceeding
9. **Transition to implementation** — invoke writing-plans skill to create implementation plan

## Process Flow

```dot
digraph brainstorming {
    "Explore project context" [shape=box];
    "Visual questions ahead?" [shape=diamond];
    "Offer Visual Companion\n(own message, no other content)" [shape=box];
    "Ask clarifying questions" [shape=box];
    "Propose 2-3 approaches" [shape=box];
    "Present design sections" [shape=box];
    "User approves design?" [shape=diamond];
    "Write design doc" [shape=box];
    "Spec self-review\n(fix inline)" [shape=box];
    "User reviews spec?" [shape=diamond];
    "Invoke writing-plans skill" [shape=doublecircle];

    "Explore project context" -> "Visual questions ahead?";
    "Visual questions ahead?" -> "Offer Visual Companion\n(own message, no other content)" [label="yes"];
    "Visual questions ahead?" -> "Ask clarifying questions" [label="no"];
    "Offer Visual Companion\n(own message, no other content)" -> "Ask clarifying questions";
    "Ask clarifying questions" -> "Propose 2-3 approaches";
    "Propose 2-3 approaches" -> "Present design sections";
    "Present design sections" -> "User approves design?";
    "User approves design?" -> "Present design sections" [label="no, revise"];
    "User approves design?" -> "Write design doc" [label="yes"];
    "Write design doc" -> "Spec self-review\n(fix inline)";
    "Spec self-review\n(fix inline)" -> "User reviews spec?";
    "User reviews spec?" -> "Write design doc" [label="changes requested"];
    "User reviews spec?" -> "Invoke writing-plans skill" [label="approved"];
}
```

**The terminal state is invoking writing-plans.** Do NOT invoke frontend-design, mcp-builder, or any other implementation skill. The ONLY skill you invoke after brainstorming is writing-plans.

## The Process

**Understanding the idea:**

- Check out the current project state first (files, docs, recent commits)
- Before asking detailed questions, assess scope: if the request describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately. Don't spend questions refining details of a project that needs to be decomposed first.
- If the project is too large for a single spec, help the user decompose into sub-projects: what are the independent pieces, how do they relate, what order should they be built? Then brainstorm the first sub-project through the normal design flow. Each sub-project gets its own spec → plan → implementation cycle.
- For appropriately-scoped projects, ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**

- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**

- Once you believe you understand what you're building, present the design
- Scale each section to its complexity: a few sentences if straightforward, up to 200-300 words if nuanced
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

**Design for isolation and clarity:**

- Break the system into smaller units that each have one clear purpose, communicate through well-defined interfaces, and can be understood and tested independently
- For each unit, you should be able to answer: what does it do, how do you use it, and what does it depend on?
- Can someone understand what a unit does without reading its internals? Can you change the internals without breaking consumers? If not, the boundaries need work.
- Smaller, well-bounded units are also easier for you to work with - you reason better about code you can hold in context at once, and your edits are more reliable when files are focused. When a file grows large, that's often a signal that it's doing too much.

**Working in existing codebases:**

- Explore the current structure before proposing changes. Follow existing patterns.
- Where existing code has problems that affect the work (e.g., a file that's grown too large, unclear boundaries, tangled responsibilities), include targeted improvements as part of the design - the way a good developer improves code they're working in.
- Don't propose unrelated refactoring. Stay focused on what serves the current goal.

## After the Design

**Documentation:**

- Write the validated design (spec) to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
  - (User preferences for spec location override this default)
- Use elements-of-style:writing-clearly-and-concisely skill if available
- Commit the design document to git

**Spec Self-Review:**
After writing the spec document, look at it with fresh eyes:

1. **Placeholder scan:** Any "TBD", "TODO", incomplete sections, or vague requirements? Fix them.
2. **Internal consistency:** Do any sections contradict each other? Does the architecture match the feature descriptions?
3. **Scope check:** Is this focused enough for a single implementation plan, or does it need decomposition?
4. **Ambiguity check:** Could any requirement be interpreted two different ways? If so, pick one and make it explicit.

Fix any issues inline. No need to re-review — just fix and move on.

**User Review Gate:**
After the spec review loop passes, ask the user to review the written spec before proceeding:

> "Spec written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan."

Wait for the user's response. If they request changes, make them and re-run the spec review loop. Only proceed once the user approves.

**Implementation:**

- Invoke the writing-plans skill to create a detailed implementation plan
- Do NOT invoke any other skill. writing-plans is the next step.

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design, get approval before moving on
- **Be flexible** - Go back and clarify when something doesn't make sense

## Visual Companion

A browser-based companion for showing mockups, diagrams, and visual options during brainstorming. Available as a tool — not a mode. Accepting the companion means it's available for questions that benefit from visual treatment; it does NOT mean every question goes through the browser.

**Offering the companion:** When you anticipate that upcoming questions will involve visual content (mockups, layouts, diagrams), offer it once for consent:
> "Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams, comparisons, and other visuals as we go. This feature is still new and can be token-intensive. Want to try it? (Requires opening a local URL)"

**This offer MUST be its own message.** Do not combine it with clarifying questions, context summaries, or any other content. The message should contain ONLY the offer above and nothing else. Wait for the user's response before continuing. If they decline, proceed with text-only brainstorming.

**Per-question decision:** Even after the user accepts, decide FOR EACH QUESTION whether to use the browser or the terminal. The test: **would the user understand this better by seeing it than reading it?**

- **Use the browser** for content that IS visual — mockups, wireframes, layout comparisons, architecture diagrams, side-by-side visual designs
- **Use the terminal** for content that is text — requirements questions, conceptual choices, tradeoff lists, A/B/C/D text options, scope decisions

A question about a UI topic is not automatically a visual question. "What does personality mean in this context?" is a conceptual question — use the terminal. "Which wizard layout works better?" is a visual question — use the browser.

If they agree to the companion, read the detailed guide before proceeding:
`skills/brainstorming/visual-companion.md`


## Assistant

This is a great design challenge — lots of visual and architectural questions ahead. Before I dispatch the team, let me offer this:

Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams, comparisons, and other visuals as we go. This feature is still new and can be token-intensive. Want to try it? (Requires opening a local URL)

In the meantime, I'll get the three-agent team started on their exploration.


## Assistant

Great — I'll set up the visual companion so I can show you mockups and diagrams as we work through the design.

Let me read the visual companion guide, then get the browser ready while the three agents finish their research.


## Assistant

Visual companion is running. Open **http://localhost:64574** in your browser.

The three agents are still working in the background — I'll synthesize their findings once they're done and start showing you visual design options. In the meantime, let me push a welcome screen.


## Assistant

Take a look at **http://localhost:64574** — you'll see the three research tracks. I'll present their findings and start walking you through design decisions as soon as they complete.


## Assistant

Devil's advocate report is in — some sharp findings there. Waiting on UX and architecture agents before I synthesize everything for you.


## Assistant

UX report is in too — very thorough. Just waiting on the technical architect, then I'll synthesize everything visually.


## Assistant

All three agents are done. Let me synthesize their findings into a visual overview for you.


## Assistant

Take a look at **http://localhost:64574** — it shows the synthesis of all three research tracks.

Here's the high-level summary before we go into design approaches:

---

**Where all three agents agreed:**

1. **The killer feature is "zero-config agent readiness"** — detect the project, detect the AI provider, set up sane defaults, show a green checkmark. Under 2 minutes from install to productive.

2. **Zero JSON in the default path** — form-based configuration for everything. Non-technical users should never see a config file.

3. **PM Code should register itself as an MCP server** — this is the elegant client-agnostic approach. Instead of writing to each provider's config format, PM Code exposes skills and context via MCP, so any AI provider that supports MCP can consume it natively.

4. **Rollback/undo is critically missing** — PMs will break their setup. There's no recovery mechanism in the brief.

5. **Scope is ambitious** — the devil's advocate flagged this is "three products in a trench coat." We need to decide what's MVP vs. V2.

**The key strategic question the devil's advocate raised:**

> VS Code and the AI providers are rapidly building native MCP management UIs. Should PM Code compete with that, or focus on the layer above — **curated "Capabilities" and guided setup** — that the platforms won't build?

---

Before I present concrete design approaches, one clarifying question:

**Who is the primary installer of this extension?** The options shape the FTUE dramatically:

- **(A) The PM/designer installs it themselves** — implies they already have VS Code and an AI extension, and are self-motivated
- **(B) An engineer sets it up for the PM** — implies the extension needs an "admin setup" mode vs. "user mode"  
- **(C) IT/org pushes it via a VS Code profile** — implies enterprise deployment with pre-configured team settings

Which of these is closest to your target scenario?


## User

A


## Assistant

Good — self-motivated PMs who already have VS Code + an AI extension. That means the FTUE can assume basic VS Code familiarity but zero knowledge of MCP, skills, or agent configuration.

Next question before I present approaches — this one shapes the entire architecture:

**How do you see the relationship between PM Code and the AI chat provider?**

- **(A) PM Code is a "setup & manage" tool** — it configures things, then gets out of the way. The PM lives in the AI chat. PM Code is plumbing they return to occasionally.
- **(B) PM Code is a "command center"** — it's the PM's home base in VS Code. They launch skills from PM Code, monitor connector health, follow guides, and use the AI chat as one tool among several.
- **(C) PM Code is a "learning companion"** — its primary job is education and onboarding. Guides and contextual help are the core; skill/connector management exists to support that journey.

This determines whether the sidebar is a dashboard, a settings panel, or a tutorial system.


## User

Starts as C then become B and for power users can become A


## Assistant

That's a great progression model — **learning companion → command center → invisible plumbing** as users grow. This maps perfectly to the progressive disclosure patterns the UX agent identified.

One more question that affects scope significantly:

**For the MVP, how many AI providers do you want to support?**

- **(A) One provider to start** — pick the most common (e.g., Copilot or Cursor) and go deep. Add others later.
- **(B) Two providers** — cover the most likely pair (e.g., Copilot + Cursor) to validate the client-agnostic architecture without boiling the ocean.
- **(C) All major providers from day one** — Copilot, Cursor, Claude Code, Continue. Client-agnostic is a core value prop and must be proven early.

The devil's advocate strongly warned against (C) for MVP — each provider has different config formats, MCP support levels, and skill concepts. But if client-agnostic is the thesis, you may want to prove it early.


## User

Don't assume VS Code familiarity. Base it off of interacting with Roo Code to start.


## Assistant

Got it — key adjustments:

1. **No VS Code familiarity assumed** — these users may be opening VS Code for the first time specifically because of AI agents
2. **Roo Code as the primary provider** — focus the MVP integration there
3. **The extension essentially needs to onboard users to VS Code itself**, not just to agent skills

That changes things significantly. Let me present the design approaches now — I have enough context.


## Assistant

Three design approaches are up at **http://localhost:64574**. Here's the quick version:

**A — The Guided Shell**: PM Code takes over VS Code on first launch, hiding complexity. Maximum hand-holding, highest engineering risk.

**B — The Companion Panel** (my recommendation): PM Code lives as a pinned editor panel alongside VS Code's native UI. Works *with* VS Code rather than hiding it. Sidebar for nav, panel for contextual guidance. Natural progression from guide → dashboard → hidden.

**C — The Smart Sidebar**: Everything in the sidebar, minimal footprint. Familiar pattern (Roo Code already taught users sidebars = AI tools), but narrow space makes rich FTUE and forms painful.

Take a look and click the one that resonates — or tell me if you want to mix elements from multiple approaches.


## User

B


## Assistant

Great — **The Companion Panel** it is. Now let me walk through the key design sections. First up: the layout and how the three surfaces (sidebar, companion panel, Roo Code chat) coexist.


## Assistant

Check **http://localhost:64574** — showing the layout wireframe with:

1. **Activity Bar** — PM Code icon + Roo Code icon as separate sidebar entries
2. **PM Code Sidebar** (left) — search bar, Quick Start progress, Skills/Connectors/Guides tree
3. **Companion Panel** (editor area) — the main stage, showing the FTUE wizard on first launch
4. **Roo Code** lives in its own sidebar position (right or toggled)

Below the wireframe is the **C → B → A progression timeline** showing how the panel evolves from learning guide → dashboard → invisible.

Does this layout and progression feel right, or would you change where things live?


## User

looks great


## Assistant

Good. Next section: the FTUE flow — what happens step by step when a PM installs PM Code for the first time.


## Assistant

The FTUE flow is up at **http://localhost:64574** — 4 steps, each teaching a VS Code concept implicitly while getting the PM set up.

And I totally agree with your point about dedicated center panels. The sidebar should be **navigation only** — a lightweight index for finding and launching things. When you click a skill, connector, or guide in the sidebar, it opens a **rich center panel** (webview in the editor area) with the full detail: configuration forms, guide content with visuals, skill descriptions with "try it" prompts.

This is actually what the architect recommended — the hybrid pattern from GitLens:
- **Sidebar** = tree view for browsing/navigation (compact, fast, native)
- **Center panels** = webview panels for doing things (rich, spacious, forms/visuals)

Let me design what those center panels look like. Which one should I mock up first?

- **(A) Connector detail panel** — the form-based setup experience for connecting Jira, GitHub, etc.
- **(B) Skill detail panel** — browsing/installing/configuring a skill
- **(C) Guide panel** — step-by-step guide with visuals and interactive actions

Or I can show all three side by side in a quick overview.


## User

Can the FTUE and walkthroughs use the VS Code Walkthrough provider?


## Assistant

Great question. Yes — the VS Code Walkthroughs API (`contributes.walkthroughs` in `package.json`) is the native way to do this. Here's what it gives you and where it falls short:

**What it does well:**
- Auto-opens on first install (standard VS Code behavior users of other extensions will recognize)
- Step completion tracking built in (`completionEvents`: `onCommand:`, `onView:`, `onContext:`)
- Each step can have an image/SVG media panel + markdown description with command links
- Appears in the Welcome tab — discoverable via `Help > Welcome`
- Light/dark theme media variants supported natively

**Where it's limited:**
- Fixed layout — image on one side, markdown text on the other. No custom HTML, no forms, no cards
- No interactive elements beyond `[Click here](command:myExtension.doThing)` markdown links
- Can't embed a connector setup form, a tool picker grid, or rich visuals
- Steps are a flat checklist — no branching, no "pick one of these four connectors"

**My recommendation: Use both.**

1. **VS Code Walkthrough** for the initial 4-step FTUE — it's the platform-native pattern, it's lightweight, and it gets the user oriented. Steps link to PM Code commands that open the richer panels.

2. **Companion Panel (webview)** for anything that needs rich UI — the connector setup form, the skill browser, the guided interactions with visuals. The walkthrough steps *launch* these panels via command links.

So the flow would be:

```
VS Code Walkthrough (native)
  Step 1: "Meet your AI assistant"  →  command link opens Roo Code sidebar
  Step 2: "Connect a tool"          →  command link opens Connector Panel (webview)
  Step 3: "Try a guided interaction" →  command link opens Roo Code with copied prompt
  Step 4: "You're set up"           →  command link opens PM Code companion dashboard
```

The walkthrough is the spine; the webview panels are the muscles. This gives you the best of both — native discoverability and completion tracking from the Walkthroughs API, plus rich interactive UI from the webview panels.

Want me to mock up the connector detail panel next, or would you rather see all three center panels (connector, skill, guide) in a quick overview?


## User

Looks good but tools should be Jira, Github (gh CLI), Monday, Aha!, Tavily. Not Linear or Notion.


## Assistant

Noted — I'll use those five connectors (Jira, GitHub via gh CLI, Monday, Aha!, Tavily) throughout the design. Let me show all three center panels in a quick overview.


## Assistant

All three center panels are up at **http://localhost:64574**:

1. **Connector Panel** (Jira example) — form fields, secure token storage, test connection button, and a "what you can do" section showing example prompts
2. **Skill Panel** (Sprint Retrospective example) — description, connector requirements check, example prompts with copy buttons, one-click install
3. **Guide Panel** (Bug Triage example) — step navigation sidebar, rich content with visuals, interactive "Copy & Open Roo Code" actions, progress bar

Key patterns across all three:
- **Connectors** reference the tools you specified: Jira, GitHub (gh CLI), Monday, Aha!, Tavily
- **Skills** show their connector dependencies and verify they're met
- **Guides** hand off to Roo Code at action moments rather than trying to replicate the chat

Take a look — how do these feel? Anything to adjust before I move to the sidebar navigation design?


## User

Looks good but the default stack of skills and connectors should be pre-installed on load. The extension should also check and install system dependencies like OSX developer tools, python, node, etc. in background while user is doing the FTUE. Show a progress bar/status message that's user friendly and out of the way/not overwhelming, but transparent about what's happening without any jargon.

Make the skills and connectors pages more interactive. Not just example prompts but buttons to click to put into the Roo prompt input. Also show related Commands (slash commands), Connectors, Skills, and Guides on each page.


Add another guide using the VS Code Walkthrough provider UI explaining how projects/workspaces work and Context Engineering for PMs (make it sound/feel easy), explain local files. Add another followup guide on how to talk to git in natural language: https://simonwillison.net/guides/agentic-engineering-patterns/using-git-with-coding-agents/


## Assistant

Great feedback — lots to incorporate. Let me fetch that Simon Willison reference and then update the designs.


## Assistant

Request timed out


## User

continue


## Assistant

Updated designs are at **http://localhost:64574** with four sections:

**1. Background System Check** — Installs Xcode CLI tools, Node, Python, gh CLI silently during FTUE. Subtle progress bar at the bottom of the companion panel. Human-friendly labels ("Developer tools ready" not "xcode-select installed"). Expands for details if curious.

**2. Interactive Skill Panel** — "Send to Roo →" buttons that inject prompts directly into Roo's input. Cross-linked Related section showing associated Commands, Connectors, Skills, and Guides.

**3. Two New Guides:**
- **Projects, Files & Context** (VS Code Walkthrough) — teaches workspaces, files, and context engineering. Makes it feel easy: "put docs in your folder, write a short instructions file, done — you're a context engineer now."
- **Talking to Git in Plain English** (step-by-step guide) — based on Simon Willison's patterns. Save work, see changes, undo mistakes, share with team — all as natural language prompts to Roo.

**4. Default Stack** — 5 connectors (Jira, GitHub/gh, Monday, Aha!, Tavily) and 8 skills (Sprint Retro, Bug Triage, PRD Writer, etc.) all pre-installed on first load.

How does this feel? Ready to finalize the spec, or are there more areas to explore?


## User

I dont see that design server running


## Assistant

Server timed out. Let me restart it.


## Assistant

New session — let me push the latest design to the new server.


## Assistant

Back up at **http://localhost:60398** — showing the updated design with background dependency checks, interactive skill panels, new guides, and default stack.

Are we ready to finalize the spec, or more to discuss?


## User

make it triage ideas not bugs, and make the Git guide more about collaboration and sharing product context/planning with the team


## Assistant

Updated at **http://localhost:60398** — Ideas not bugs, Git as collaboration tool.

Now let me write the spec. I'll push a waiting screen and work in the terminal.


## Assistant

Spec is written. Now let me handle your request — commit brainstorm designs and export the conversation.

First, let me check if there's a built-in export command.


## Assistant

No built-in export command. Let me copy the brainstorm HTML files into `/specs` and create a conversation summary markdown file.


## Assistant

Now let me write the conversation transcript.


## Assistant

Now let me also move the spec to `/specs` as you requested, and commit everything.


## Assistant

Let me grab the frame template CSS and include it, then commit everything.


## Assistant

Now let me add `.superpowers/` to `.gitignore` and commit everything.


## Assistant

All committed and pushed. Here's what's in the repo now:

```
specs/
├── 2026-03-30-pmcode-extension-design.md    # Full design spec
├── 2026-03-30-design-session-transcript.md  # This conversation as markdown
└── brainstorm-designs/
    ├── frame-template.css                    # CSS for rendering mockups standalone
    ├── 01-welcome.html                       # Research agent overview
    ├── 02-synthesis-overview.html            # Three-agent findings
    ├── 03-approaches.html                    # Design approaches with trade-offs
    ├── 04-layout-wireframe.html              # VS Code window layout
    ├── 05-ftue-flow.html                     # First-time user experience
    ├── 06-center-panels-overview.html        # Connector/Skill/Guide panels
    ├── 07-updated-design-v1.html             # Background deps + interactive panels
    └── 08-updated-design-v2.html             # Final: ideas triage + collaboration
```

To view any mockup locally, open the HTML file in a browser and link `frame-template.css` — or just open them as-is (the inline styles will render the VS Code-style dark mockups).

Ready for the implementation plan whenever you are.


## User

I wanted the literal conversation transcript. fine to keep the summary as well but add that.
