import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Guide {
  id: string;
  title: string;
  description: string;
  type: 'walkthrough' | 'step-by-step';
  estimatedMinutes: number;
  steps: GuideStep[];
  relatedConnectors: string[];
  relatedSkills: string[];
}

export interface GuideStep {
  title: string;
  content: string;
  prompts?: { label: string; text: string }[];
  proTip?: string;
}

export interface GuideProgress {
  guideId: string;
  completedSteps: number[];
  currentStep: number;
  startedAt?: string;
}

// ── Progress file path ─────────────────────────────────────────────────────

const PROGRESS_FILE = path.join(os.homedir(), '.pmcode', 'guides', 'progress.json');

// ── Bundled Guides ─────────────────────────────────────────────────────────

const BUNDLED_GUIDES: Guide[] = [
  // 1. Getting Started with PM Code
  {
    id: 'getting-started',
    title: 'Getting Started with PM Code',
    description:
      'Set up your AI-powered product management environment in minutes. You will meet your AI assistant, connect your first tool, send your first prompt, and learn how to navigate PM Code.',
    type: 'walkthrough',
    estimatedMinutes: 10,
    relatedConnectors: ['jira', 'github', 'monday', 'aha', 'tavily'],
    relatedSkills: ['idea-triage', 'prd-writer'],
    steps: [
      {
        title: 'Meet Your AI Assistant',
        content:
          'PM Code works alongside an AI assistant called Roo Code. Think of Roo as a knowledgeable teammate who can read your project files, talk to your tools, and help you get work done faster.\n\nTo get started, open the Roo Code sidebar by clicking the Roo icon in the Activity Bar on the left side of VS Code. The Activity Bar is the narrow vertical strip of icons -- PM Code is there too.\n\nOnce Roo is open, you will see a chat interface. This is where you will have conversations with your AI assistant throughout your workday.',
        prompts: [
          {
            label: 'Say hello to Roo',
            text: "Hi! I'm a product manager getting started with PM Code. Can you give me a quick overview of what you can help me with?",
          },
        ],
        proTip:
          'You can have Roo open side-by-side with any file or panel. Try dragging the Roo sidebar to the right side of your screen for a split view.',
      },
      {
        title: 'Connect Your First Tool',
        content:
          'AI becomes truly powerful when it can access your real project data. PM Code supports connectors for tools like Jira, GitHub, Monday, Aha!, and more.\n\nLet us connect your first tool. Open the Connectors panel by clicking "Connectors" in the PM Code sidebar, or use the Command Palette (Cmd+Shift+P) and type "PM Code: Open Connectors".\n\nPick the tool your team uses most. You will need an API token -- each connector includes a "How do I get an API token?" link that walks you through it.\n\nDo not worry about getting every tool connected right now. You can always come back and add more later.',
        prompts: [
          {
            label: 'Open Connectors',
            text: '/connectors',
          },
        ],
        proTip:
          'GitHub is the easiest connector to set up -- if you already have the gh CLI installed, it auto-detects your login. Try starting there if you are not sure which tool to pick.',
      },
      {
        title: 'Send Your First Prompt',
        content:
          'Now that you have a tool connected, let us see what your AI can do with real data. Click the "Send to Roo" button below to try a real prompt.\n\nWhen you send a prompt, PM Code copies it to your clipboard and opens Roo Code. Just paste (Cmd+V) into the chat input and hit Enter.\n\nThis first prompt is intentionally simple -- it asks Roo to summarize what it can see in your connected tools. As you get comfortable, you will craft more specific prompts for tasks like triaging ideas, writing PRDs, and planning sprints.',
        prompts: [
          {
            label: 'Summarize my project',
            text: 'Look at my connected tools and give me a quick summary of what you can see -- open issues, recent activity, anything interesting.',
          },
          {
            label: 'List available tools',
            text: 'What tools and data sources do you have access to right now? List them with a brief description of what each one lets you do.',
          },
        ],
        proTip:
          'You do not need to be precise with prompts. Natural language works great. "Show me the bugs" is just as valid as a detailed, structured request.',
      },
      {
        title: 'You Are Ready to Go',
        content:
          'Congratulations -- you have set up PM Code! Here is what you can explore next:\n\n- **Skills**: Pre-built workflows for common PM tasks like triaging ideas, writing PRDs, and running retros. Open the Skills panel to browse them.\n- **Guides**: Step-by-step walkthroughs that teach you new techniques. "Projects, Files & Context" is a great next read.\n- **Connectors**: Add more tools to give your AI access to more data.\n\nPM Code lives in the Activity Bar (the purple PM icon) and is always one click away. As you use it more, it fades into the background -- your AI just works.',
        prompts: [
          {
            label: 'Open the Dashboard',
            text: '/dashboard',
          },
        ],
        proTip:
          'Use the Command Palette (Cmd+Shift+P) and type "PM Code" to see every available command. You can do everything from the keyboard once you are comfortable.',
      },
    ],
  },

  // 2. Projects, Files & Context
  {
    id: 'projects-files-context',
    title: 'Projects, Files & Context',
    description:
      'Understand what workspaces are, how AI reads your files, and how to give your AI the right context for better answers. Essential knowledge for getting the most out of AI-assisted product management.',
    type: 'walkthrough',
    estimatedMinutes: 15,
    relatedConnectors: [],
    relatedSkills: ['prd-writer', 'competitive-research'],
    steps: [
      {
        title: 'What Is a Workspace?',
        content:
          'In VS Code, a "workspace" is simply a folder you have opened. When you open a folder (File > Open Folder), everything inside it becomes your workspace.\n\nThis matters because your AI assistant can see and read files in your workspace. If you open your product documentation folder, Roo can read your PRDs, specs, research notes, and meeting summaries.\n\nThink of the workspace as your AI\'s field of vision. The folder you open determines what context your AI has to work with.',
        proTip:
          'You can open any folder as a workspace -- it does not need to be a code project. A folder of Google Docs exports, Notion exports, or plain text notes works perfectly.',
      },
      {
        title: 'How AI Reads Your Files',
        content:
          'When you ask Roo a question, it does not automatically read every file in your workspace. Instead, it reads files when they are relevant to your question.\n\nYou can also point Roo at specific files by mentioning them: "Read the PRD in docs/product-requirements.md and tell me if we are missing any edge cases."\n\nThe files in your workspace are like documents on your desk. Roo can pick them up and read them when needed, but it is not memorizing everything at all times.\n\nFile types Roo can read well: Markdown (.md), plain text (.txt), JSON, CSV, and most code files. It cannot read binary files like .docx or .xlsx directly -- export to CSV or Markdown first.',
        prompts: [
          {
            label: 'Ask Roo what it can see',
            text: 'What files and folders are in my current workspace? Give me a high-level summary of what you can see.',
          },
        ],
        proTip:
          'Markdown (.md) files are the best format for AI context. They are readable by both humans and AI, version-controllable with Git, and lightweight.',
      },
      {
        title: 'Context Engineering for PMs',
        content:
          'The quality of AI output depends heavily on the context you provide. "Context engineering" is the practice of organizing your files and prompts so the AI has what it needs.\n\nThree principles:\n\n1. **Put important context in files, not just prompts.** A PRD in a file can be referenced across many conversations. A PRD typed into a chat is lost when the conversation ends.\n\n2. **Organize by topic, not by tool.** Instead of "jira-exports/" and "confluence-pages/", try "features/onboarding/" and "research/competitors/". This helps AI find related information.\n\n3. **Use README files as maps.** A README.md at the top of each folder explaining what is inside helps both humans and AI navigate your workspace.',
        prompts: [
          {
            label: 'Help me organize my workspace',
            text: 'Look at my current workspace structure and suggest how I could reorganize it for better AI context. Focus on making it easy for you to find relevant information when I ask questions about product features, research, and planning.',
          },
        ],
        proTip:
          'Create a CONTEXT.md file in your workspace root with key project info: product name, target users, current priorities, team structure. Roo can reference this for every conversation.',
      },
      {
        title: 'The Explorer: Your File Browser',
        content:
          'The Explorer is the file browser panel in the left sidebar of VS Code. Click the top icon in the Activity Bar (looks like two overlapping pages) to open it.\n\nFrom the Explorer you can:\n- Browse all files and folders in your workspace\n- Create new files and folders (right-click > New File)\n- Rename, move, and delete files\n- Open files by clicking them\n\nWhen you open a file, it appears as a tab in the editor area (the big central area). You can have multiple files open as tabs, just like browser tabs.\n\nThis is where you will create and edit product documents that your AI can reference.',
        proTip:
          'Double-click a file to keep it open permanently. Single-click opens it in "preview mode" (italic tab title) which gets replaced when you click another file.',
      },
      {
        title: 'Creating Your First Product Document',
        content:
          'Let us create a simple product context file that your AI can reference.\n\n1. In the Explorer, right-click your workspace root and select "New File"\n2. Name it CONTEXT.md\n3. Add basic product info: product name, target users, what problem it solves, current priorities\n\nOr, ask Roo to help you create it! Use the prompt below and Roo will generate a starter CONTEXT.md based on what it can see in your workspace and connected tools.',
        prompts: [
          {
            label: 'Generate a CONTEXT.md',
            text: 'Create a CONTEXT.md file in the workspace root with key product context. Include sections for: Product Overview, Target Users, Current Priorities, Team Structure, and Key Metrics. Fill in what you can from my workspace and connected tools, and leave placeholders for what you cannot determine.',
          },
        ],
        proTip:
          'Keep CONTEXT.md under 500 lines. If it gets longer, split into focused files like USERS.md, PRIORITIES.md, and METRICS.md.',
      },
      {
        title: 'Putting It All Together',
        content:
          'You now understand the key concepts for working with AI in VS Code:\n\n- **Workspace** = the folder you opened, which defines what AI can see\n- **Files** = your product documents that AI reads on demand\n- **Context** = the information you provide (files + prompts) that determines AI output quality\n\nA suggested workspace structure for PMs:\n\n```\nmy-product/\n  CONTEXT.md           -- Product overview and priorities\n  docs/\n    prds/              -- Product requirements documents\n    research/          -- User research, competitive analysis\n    decisions/         -- Decision logs and ADRs\n  planning/\n    sprints/           -- Sprint plans and retros\n    roadmap/           -- Roadmap documents\n  .pmcode/\n    skills/            -- Project-specific PM Code skills\n```\n\nNext up: learn how to share this context with your team using Git.',
        prompts: [
          {
            label: 'Scaffold a PM workspace',
            text: 'Create the folder structure for a PM workspace with: CONTEXT.md, docs/prds/, docs/research/, docs/decisions/, planning/sprints/, planning/roadmap/. Include a brief README.md in each folder explaining what goes there.',
          },
        ],
        proTip:
          'The "Sharing Product Context with Your Team" guide covers how to save, share, and collaborate on these files using Git -- no terminal required.',
      },
    ],
  },

  // 3. Sharing Product Context with Your Team
  {
    id: 'sharing-context',
    title: 'Sharing Product Context with Your Team',
    description:
      'Learn how to save your product context, share it with teammates, and collaborate using Git -- all without touching the terminal. Think of Git as Google Docs versioning for your AI context.',
    type: 'step-by-step',
    estimatedMinutes: 20,
    relatedConnectors: ['github'],
    relatedSkills: ['prd-writer'],
    steps: [
      {
        title: 'Why Git Matters for PM Context',
        content:
          'When you create product documents (PRDs, context files, research notes) in VS Code, they live on your computer. Git lets you:\n\n1. **Save snapshots** of your work (like versioning in Google Docs, but you control when)\n2. **Share with your team** by pushing to GitHub so anyone can access the latest context\n3. **Track changes** so you can see what changed, when, and why\n4. **Collaborate safely** so multiple people can edit without overwriting each other\n\nYou do not need the terminal for any of this. VS Code has built-in Git support with a visual interface.\n\nIf your workspace is already a Git repository (your engineering team set it up), you are ahead of the game -- skip to Step 3.',
        proTip:
          'Git is how AI coding agents save their work too. Learning the basics means you can review what the AI changed before accepting it.',
      },
      {
        title: 'Initialize a Repository',
        content:
          'If your workspace is not already a Git repo, you need to initialize one.\n\n1. Click the Source Control icon in the Activity Bar (it looks like a branching line, usually third from the top)\n2. Click "Initialize Repository"\n3. Done! Your workspace is now tracked by Git\n\nAlternatively, ask Roo to do it for you with the prompt below.\n\nAfter initializing, you will see all your files listed under "Changes" in the Source Control panel. These are files Git knows about but has not saved a snapshot of yet.',
        prompts: [
          {
            label: 'Initialize Git repo',
            text: 'Initialize a Git repository in my current workspace if one does not already exist. Then create a .gitignore file that excludes .env files, node_modules, and OS files (.DS_Store).',
          },
        ],
        proTip:
          'Always create a .gitignore file before your first commit. This prevents accidentally sharing API tokens or large files.',
      },
      {
        title: 'Save a Snapshot (Commit)',
        content:
          'A "commit" is a saved snapshot of your files at a point in time. Think of it as clicking "Save Version" in Google Docs.\n\nTo create a commit:\n1. Open Source Control (branch icon in the Activity Bar)\n2. You will see changed files listed. Click the + icon next to each file you want to include, or click + next to "Changes" to include all of them.\n3. Type a short message describing what changed (e.g., "Add Q2 product priorities")\n4. Click the checkmark button (or Cmd+Enter) to commit\n\nYour snapshot is saved! You can make as many commits as you want. Each one is a restore point you can go back to.',
        prompts: [
          {
            label: 'Help me write a commit message',
            text: 'Look at my current uncommitted changes and suggest a clear, concise commit message that describes what changed.',
          },
        ],
        proTip:
          'Commit early and often. Small, frequent commits with clear messages make it easy to find and undo specific changes later.',
      },
      {
        title: 'Push to GitHub',
        content:
          'Pushing sends your commits to GitHub so your team can access them.\n\nIf you have not connected to GitHub yet:\n1. Open the Connectors panel in PM Code and set up the GitHub connector\n2. The gh CLI handles authentication -- follow the prompts\n\nTo push your commits:\n1. In Source Control, click the "..." menu (three dots) at the top\n2. Select "Push" (or "Publish Branch" if this is the first time)\n3. If prompted, choose to publish to GitHub and select public or private\n\nOnce pushed, your team can clone the repo and see all your product context.',
        prompts: [
          {
            label: 'Create a GitHub repository',
            text: 'Help me create a new GitHub repository for this workspace and push my current commits to it. Walk me through each step.',
          },
        ],
        proTip:
          'Choose "Private" repository unless you want your product context publicly visible. You can always change this later in GitHub settings.',
      },
      {
        title: 'Pull Changes from Your Team',
        content:
          'When teammates push changes to GitHub, you need to pull them to get the updates.\n\nTo pull:\n1. In Source Control, click the "..." menu\n2. Select "Pull"\n3. Your files update with the latest changes\n\nVS Code shows a sync indicator in the status bar (bottom left). It shows arrows with numbers indicating how many commits to push (up arrow) and pull (down arrow).\n\nMake it a habit to pull before you start working each day, just like you would check for new messages.',
        proTip:
          'Enable "Git: Auto Fetch" in VS Code settings to automatically check for remote changes. The status bar will show when updates are available without you having to remember to check.',
      },
      {
        title: 'Branching: Safe Experimentation',
        content:
          'A branch is a parallel copy of your files where you can make changes without affecting the main version. Useful when you want to:\n\n- Draft a new PRD without disrupting the current one\n- Experiment with a new workspace structure\n- Have Roo make big changes that you want to review first\n\nTo create a branch:\n1. Click the branch name in the bottom-left of VS Code (it probably says "main")\n2. Select "Create new branch..."\n3. Give it a descriptive name like "draft/q3-roadmap"\n4. Make your changes and commit them\n5. When ready, create a Pull Request to merge back to main\n\nBranches are cheap and disposable. Create them freely.',
        prompts: [
          {
            label: 'Create a branch for a new PRD',
            text: 'Create a new Git branch called "draft/new-feature-prd" and set it up so I can start writing a new PRD without affecting the main branch.',
          },
        ],
        proTip:
          'Ask Roo to make changes on a branch. Then you can review the diff before merging. This is exactly how engineering teams review code -- now you can review AI-generated product docs the same way.',
      },
      {
        title: 'Pull Requests: Team Review',
        content:
          'A Pull Request (PR) is a proposal to merge changes from one branch into another. It is the collaboration layer -- teammates can review, comment, and approve before changes go live.\n\nTo create a PR:\n1. Push your branch to GitHub (Source Control > ... > Push)\n2. Use the prompt below to have Roo create a PR, or\n3. Go to github.com and you will see a banner offering to create a PR\n\nPRs are not just for code. They are great for product docs too:\n- "Review my Q3 roadmap draft"\n- "Check the updated user personas"\n- "Does this PRD cover the edge cases?"\n\nYour team can comment line-by-line, suggest edits, and approve when ready.',
        prompts: [
          {
            label: 'Create a Pull Request',
            text: 'Create a GitHub Pull Request from my current branch to main. Write a clear title and description summarizing the changes.',
          },
        ],
        proTip:
          'Add your PM lead or a designer as a reviewer on PRs for product docs. Treat product context with the same rigor engineering treats code -- it drives AI behavior.',
      },
    ],
  },

  // 4. Triage Ideas Like a Pro
  {
    id: 'triage-ideas',
    title: 'Triage Ideas Like a Pro',
    description:
      'Learn a repeatable process for pulling ideas from your tools, grouping them by theme, prioritizing with frameworks, and creating actionable next steps -- all powered by AI.',
    type: 'step-by-step',
    estimatedMinutes: 25,
    relatedConnectors: ['jira', 'aha', 'monday'],
    relatedSkills: ['idea-triage', 'sprint-planning', 'roadmap-review'],
    steps: [
      {
        title: 'Gather Ideas from Your Tools',
        content:
          'The first step in triage is pulling all the ideas into one view. Instead of switching between Jira, Aha!, email, and Slack, let your AI do the gathering.\n\nMake sure at least one project management connector (Jira, Aha!, or Monday) is set up in PM Code. Then use the prompt below to have Roo pull all open ideas, feature requests, and suggestions into a consolidated list.\n\nRoo will format them consistently so you can compare apples to apples, regardless of which tool the idea originated from.',
        prompts: [
          {
            label: 'Pull all open ideas',
            text: 'Pull all open feature requests, ideas, and enhancement suggestions from my connected tools. Format each one as:\n- Title\n- Source (which tool)\n- Requester\n- Date submitted\n- Brief description\n\nSort by date, newest first.',
          },
        ],
        proTip:
          'If you have ideas scattered in documents, Slack threads, or emails, paste them into a file called ideas-inbox.md in your workspace before starting. Roo can read that file too.',
      },
      {
        title: 'Group Ideas by Theme',
        content:
          'Raw idea lists are hard to reason about. Grouping by theme reveals patterns and helps you see the big picture.\n\nCommon theme categories for PMs:\n- **User pain points**: Things users struggle with today\n- **Growth opportunities**: Ideas that could expand usage or revenue\n- **Technical debt / quality**: Improvements to existing functionality\n- **Compliance / security**: Must-do items driven by requirements\n- **Nice-to-haves**: Interesting but not urgent\n\nAsk Roo to analyze your ideas and suggest groupings. You can adjust the themes after reviewing.',
        prompts: [
          {
            label: 'Group ideas by theme',
            text: 'Take the list of ideas we just gathered and group them by theme. Suggest 4-6 themes based on the actual content. For each theme, list the ideas that belong to it and explain why you grouped them together. Flag any ideas that could belong to multiple themes.',
          },
        ],
        proTip:
          'Do not overthink the themes. They are a thinking tool, not a permanent taxonomy. You can always regroup later.',
      },
      {
        title: 'Score with a Framework',
        content:
          'Prioritization frameworks make trade-offs explicit. Here are two popular ones:\n\n**RICE Score** (Reach x Impact x Confidence / Effort)\n- Reach: How many users will this affect? (per quarter)\n- Impact: How much will it move the needle? (0.25-3x)\n- Confidence: How sure are we about the estimates? (50-100%)\n- Effort: How many person-months? (0.5-6)\n\n**Value vs. Effort Matrix**\n- Simple 2x2: High Value + Low Effort = Do First\n\nPick one framework and ask Roo to apply it. Roo will make initial estimates based on available data -- you refine from there.',
        prompts: [
          {
            label: 'Apply RICE scoring',
            text: 'Apply RICE scoring to each themed group of ideas. For each idea, estimate Reach (users/quarter), Impact (0.25-3x scale), Confidence (50-100%), and Effort (person-months). Show the final RICE score and rank from highest to lowest. Flag any scores where you have low confidence in the estimates.',
          },
          {
            label: 'Create a value/effort matrix',
            text: 'Create a Value vs. Effort matrix for our grouped ideas. Categorize each idea as: Quick Win (high value, low effort), Big Bet (high value, high effort), Fill-In (low value, low effort), or Avoid (low value, high effort). Explain your reasoning for each placement.',
          },
        ],
        proTip:
          'AI estimates are conversation starters, not final answers. The real value is in the discussion they spark with your team. Share the scored list and ask "Does this feel right?"',
      },
      {
        title: 'Identify Dependencies and Risks',
        content:
          'Before finalizing priorities, check for hidden dependencies and risks that could change the order.\n\nCommon things to look for:\n- **Technical dependencies**: Does idea A need to be built before idea B?\n- **Data dependencies**: Do we need analytics or research before committing?\n- **Resource conflicts**: Do multiple high-priority ideas need the same team?\n- **External dependencies**: Are we waiting on a vendor, partner, or API?\n\nRoo can cross-reference ideas against your codebase and project data to surface these.',
        prompts: [
          {
            label: 'Find dependencies and risks',
            text: 'Analyze the prioritized ideas and identify:\n1. Dependencies between ideas (which ones block others)\n2. Resource conflicts (ideas competing for the same team/skills)\n3. Information gaps (what we need to learn before committing)\n4. External dependencies (third-party or cross-team blockers)\n\nSuggest how these dependencies should affect our priority order.',
          },
        ],
        proTip:
          'The goal is not to find every possible risk -- it is to catch the ones that would cause a painful surprise if discovered mid-sprint.',
      },
      {
        title: 'Create an Action Plan',
        content:
          'Turn your prioritized, analyzed ideas into concrete next steps. For each idea you are moving forward with, define:\n\n1. **Next action**: What is the very next thing that needs to happen? (e.g., "Write a one-pager", "Schedule user interview", "Create Jira epic")\n2. **Owner**: Who is responsible for the next action?\n3. **Timeline**: When should this happen? (this sprint, next sprint, this quarter)\n4. **Success metric**: How will we know this worked?\n\nKeep it simple. The output of triage should be a short list of committed next actions, not a detailed project plan.',
        prompts: [
          {
            label: 'Generate action plan',
            text: 'For the top-priority ideas from our triage, create an action plan. For each idea include:\n- Next action (specific and concrete)\n- Suggested owner (based on the type of work)\n- Timeline recommendation\n- Success metric\n\nAlso create a "parked" list for ideas we are not pursuing this cycle, with a brief reason for each.',
          },
        ],
        proTip:
          'A good triage ends with 3-5 committed next actions, not 20. The courage to say "not now" to good ideas is what separates effective PMs.',
      },
      {
        title: 'Save and Share Your Triage Results',
        content:
          'Your triage results are valuable product context. Save them so your team (and your AI) can reference them later.\n\n1. Ask Roo to write the triage summary to a file in your workspace\n2. Commit the file to Git (Source Control > Stage > Commit)\n3. Push to GitHub so your team can see the decisions\n\nOver time, these triage documents build a decision log -- invaluable context for understanding why certain features were prioritized or parked.\n\nYour AI also gets smarter with each triage. When you reference past triage docs in future conversations, Roo can track how priorities evolve and flag when parked ideas keep resurfacing.',
        prompts: [
          {
            label: 'Save triage results',
            text: 'Write a triage summary document to planning/triage/YYYY-MM-DD-triage.md (use today\'s date). Include:\n- Date and participants\n- Themes identified\n- Priority rankings with scores\n- Committed next actions\n- Parked ideas with reasoning\n- Key dependencies flagged\n\nFormat it as clean Markdown that is easy to scan.',
          },
        ],
        proTip:
          'Run the Idea Triage skill (Skills > Idea Triage > Try it now) to automate this entire process in one go. The skill follows these same steps with optimized prompts.',
      },
    ],
  },
];

// ── GuideEngine ────────────────────────────────────────────────────────────

export class GuideEngine {
  private guides: Guide[];
  private progressMap: Map<string, GuideProgress> = new Map();
  private loaded = false;

  constructor() {
    this.guides = [...BUNDLED_GUIDES];
  }

  /**
   * Return all available guides.
   */
  getGuides(): Guide[] {
    return this.guides;
  }

  /**
   * Return a single guide by id.
   */
  getGuide(id: string): Guide | undefined {
    return this.guides.find((g) => g.id === id);
  }

  /**
   * Get progress for a guide. Returns a default (no progress) object if none exists.
   */
  async getProgress(id: string): Promise<GuideProgress> {
    await this.ensureLoaded();

    const existing = this.progressMap.get(id);
    if (existing) {
      return existing;
    }

    return {
      guideId: id,
      completedSteps: [],
      currentStep: 0,
    };
  }

  /**
   * Mark a step as completed for a guide.
   */
  async completeStep(guideId: string, stepNumber: number): Promise<void> {
    await this.ensureLoaded();

    let progress = this.progressMap.get(guideId);
    if (!progress) {
      progress = {
        guideId,
        completedSteps: [],
        currentStep: 0,
        startedAt: new Date().toISOString(),
      };
    }

    if (!progress.completedSteps.includes(stepNumber)) {
      progress.completedSteps.push(stepNumber);
      progress.completedSteps.sort((a, b) => a - b);
    }

    // Advance current step to next incomplete step
    const guide = this.getGuide(guideId);
    if (guide) {
      for (let i = 0; i < guide.steps.length; i++) {
        if (!progress.completedSteps.includes(i)) {
          progress.currentStep = i;
          break;
        }
        // All steps complete
        if (i === guide.steps.length - 1) {
          progress.currentStep = guide.steps.length;
        }
      }
    }

    this.progressMap.set(guideId, progress);
    await this.saveProgress();
  }

  /**
   * Reset progress for a guide.
   */
  async resetProgress(guideId: string): Promise<void> {
    await this.ensureLoaded();
    this.progressMap.delete(guideId);
    await this.saveProgress();
  }

  /**
   * Persist all progress to ~/.pmcode/guides/progress.json.
   */
  async saveProgress(): Promise<void> {
    const data: Record<string, GuideProgress> = {};
    for (const [id, progress] of this.progressMap) {
      data[id] = progress;
    }

    const dir = path.dirname(PROGRESS_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Load progress from disk if not already loaded.
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const raw = await fs.readFile(PROGRESS_FILE, 'utf-8');
      const data = JSON.parse(raw) as Record<string, GuideProgress>;
      for (const [id, progress] of Object.entries(data)) {
        this.progressMap.set(id, progress);
      }
    } catch {
      // File does not exist yet — start fresh
    }

    this.loaded = true;
  }
}
