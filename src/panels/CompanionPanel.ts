import * as vscode from 'vscode';
import { PanelManager } from './PanelManager';
import { getNonce, getStylesUri, escapeHtml, ConnectorConfig, ConnectorStatus, statusDotClass, statusLabel, Guide, GuideProgress } from './panelUtils';
import { Skill } from '../skills/SkillParser';
import { DependencyStatus } from '../system/DependencyChecker';
import { SetupStatus } from '../system/SetupProgress';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DashboardData {
  phase: 'companion' | 'command-center' | 'invisible';
  ftueCompleted: boolean;
  ftueCompletedSteps: string[];
  rooConnected: boolean;
  connectors: ConnectorConfig[];
  skills: Skill[];
  guides: Guide[];
  guideProgress: Map<string, GuideProgress>;
  recentlyUsedSkills: string[];
  dependencies: DependencyStatus[];
  setupStatus?: SetupStatus;
}

// ── CompanionPanel ─────────────────────────────────────────────────────────

export class CompanionPanel {
  static readonly panelType = 'companion';
  static readonly panelId = 'dashboard';

  private static currentPanel: vscode.WebviewPanel | undefined;

  static show(
    extensionUri: vscode.Uri,
    panelManager: PanelManager,
    data: DashboardData
  ): vscode.WebviewPanel {
    const panel = panelManager.openPanel(
      CompanionPanel.panelType,
      CompanionPanel.panelId,
      'PM Code',
      (webview) => CompanionPanel.getHtml(webview, extensionUri, data)
    );

    CompanionPanel.currentPanel = panel;

    panel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'navigate':
          vscode.commands.executeCommand(`pmcode.open${capitalize(message.target)}`);
          break;
        case 'openConnector':
          vscode.commands.executeCommand('pmcode.openConnector', message.id);
          break;
        case 'openSkill':
          vscode.commands.executeCommand('pmcode.openSkill', message.id);
          break;
        case 'openGuide':
          vscode.commands.executeCommand('pmcode.openGuide', message.id);
          break;
        case 'sendPrompt':
          vscode.commands.executeCommand('pmcode.sendPrompt', message.text);
          break;
        case 'openWalkthrough':
          vscode.commands.executeCommand(
            'workbench.action.openWalkthrough',
            'pmcode.pmcode#pmcode.gettingStarted',
            false
          );
          break;
        case 'checkDependencies':
          vscode.commands.executeCommand('pmcode.checkDependencies');
          break;
        case 'runSkill':
          vscode.commands.executeCommand('pmcode.skill.run', message.id);
          break;
      }
    });

    panel.onDidDispose(() => {
      CompanionPanel.currentPanel = undefined;
    });

    return panel;
  }

  static update(data: DashboardData, extensionUri: vscode.Uri): void {
    if (CompanionPanel.currentPanel) {
      CompanionPanel.currentPanel.webview.html = CompanionPanel.getHtml(
        CompanionPanel.currentPanel.webview,
        extensionUri,
        data
      );
    }
  }

  private static getHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    data: DashboardData
  ): string {
    const nonce = getNonce();
    const stylesUri = getStylesUri(webview, extensionUri);

    const content = data.phase === 'companion' && !data.ftueCompleted
      ? CompanionPanel.renderCompanionPhase(data)
      : CompanionPanel.renderCommandCenterPhase(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <link href="${stylesUri}" rel="stylesheet" />
  <style nonce="${nonce}">
    .dashboard-hero {
      text-align: center;
      padding: 32px 0 24px;
    }
    .dashboard-hero .hero-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
    .dashboard-hero h1 {
      font-size: 1.6rem;
      margin-bottom: 6px;
    }
    .dashboard-hero .hero-subtitle {
      opacity: 0.7;
      font-size: 1rem;
    }
    .dashboard-sections {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-header h2 {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .section-header .section-action {
      font-size: 0.85em;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      background: none;
      border: none;
      font-family: inherit;
    }
    .section-header .section-action:hover {
      text-decoration: underline;
    }
    .connector-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .connector-row:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .connector-row .connector-name {
      flex: 1;
      font-weight: 500;
    }
    .connector-row .connector-status {
      font-size: 0.85em;
      opacity: 0.7;
    }
    .skill-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.15));
      cursor: pointer;
      font-size: 0.9em;
    }
    .skill-chip:hover {
      border-color: var(--vscode-focusBorder);
    }
    .skills-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .guide-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .guide-row:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .guide-row .guide-info {
      flex: 1;
    }
    .guide-row .guide-title {
      font-weight: 500;
    }
    .guide-row .guide-meta {
      font-size: 0.85em;
      opacity: 0.6;
    }
    .guide-row .guide-progress-mini {
      width: 60px;
    }
    .ftue-steps {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ftue-step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 6px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.15));
    }
    .ftue-step.completed {
      opacity: 0.6;
    }
    .ftue-step .step-check {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
      border: 1.5px solid var(--vscode-editor-foreground);
      opacity: 0.5;
      margin-top: 1px;
    }
    .ftue-step.completed .step-check {
      background: var(--vscode-testing-iconPassed, #4caf50);
      border-color: var(--vscode-testing-iconPassed, #4caf50);
      color: #fff;
      opacity: 1;
    }
    .ftue-step .step-body {
      flex: 1;
    }
    .ftue-step .step-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .ftue-step .step-desc {
      font-size: 0.9em;
      opacity: 0.8;
      margin-bottom: 8px;
      line-height: 1.4;
    }
    .dep-section {
      margin-top: 8px;
      padding: 12px 14px;
      border-radius: 6px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.15));
    }
    .dep-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 0.9em;
    }
    .dep-row .dep-icon {
      width: 18px;
      text-align: center;
    }
    .dep-row .dep-label {
      flex: 1;
    }
    .dep-row .dep-version {
      opacity: 0.5;
      font-size: 0.85em;
    }
    .empty-state {
      text-align: center;
      padding: 20px;
      opacity: 0.6;
      font-size: 0.9em;
    }
  </style>
  <title>PM Code</title>
</head>
<body>
  <div class="panel-container">
    ${content}
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const payload = btn.dataset;
      switch (action) {
        case 'navigate':
          vscode.postMessage({ type: 'navigate', target: payload.target });
          break;
        case 'openConnector':
          vscode.postMessage({ type: 'openConnector', id: payload.id });
          break;
        case 'openSkill':
          vscode.postMessage({ type: 'openSkill', id: payload.id });
          break;
        case 'openGuide':
          vscode.postMessage({ type: 'openGuide', id: payload.id });
          break;
        case 'sendPrompt':
          vscode.postMessage({ type: 'sendPrompt', text: payload.text });
          break;
        case 'openWalkthrough':
          vscode.postMessage({ type: 'openWalkthrough' });
          break;
        case 'checkDependencies':
          vscode.postMessage({ type: 'checkDependencies' });
          break;
        case 'runSkill':
          vscode.postMessage({ type: 'runSkill', id: payload.id });
          break;
      }
    });
  </script>
</body>
</html>`;
  }

  // ── Phase C: Learning Companion (FTUE) ──────────────────────────────────

  private static renderCompanionPhase(data: DashboardData): string {
    const ftueSteps = [
      {
        id: 'meetAI',
        title: 'Meet your AI assistant',
        desc: 'Open the Roo Code sidebar to see your AI chat. This is where you\'ll have conversations with your AI assistant.',
        action: `<button class="btn btn-primary btn-sm" data-action="sendPrompt" data-text="Hello! I'm a product manager just getting started. What can you help me with?">Say hello to Roo</button>`,
      },
      {
        id: 'connectTool',
        title: 'Connect your first tool',
        desc: 'Link a project management tool (Jira, GitHub, Monday, Aha!, or Tavily) so your AI can access real data.',
        action: `<button class="btn btn-primary btn-sm" data-action="navigate" data-target="Connectors">Connect a tool</button>`,
      },
      {
        id: 'firstPrompt',
        title: 'Try talking to your AI',
        desc: 'Send a real prompt to see AI in action with your connected tools.',
        action: `<button class="btn btn-primary btn-sm" data-action="sendPrompt" data-text="Show me a summary of recent activity across my connected tools.">Send your first prompt</button>`,
      },
      {
        id: 'explore',
        title: 'You\'re ready to go!',
        desc: 'Explore skills, guides, and connectors to supercharge your PM workflow.',
        action: `<button class="btn btn-primary btn-sm" data-action="navigate" data-target="Skills">Explore skills</button>`,
      },
    ];

    const completedSet = new Set(data.ftueCompletedSteps);
    const completedCount = ftueSteps.filter(s => completedSet.has(s.id)).length;
    const progressPct = Math.round((completedCount / ftueSteps.length) * 100);

    let html = `
    <div class="dashboard-hero">
      <div class="hero-icon">👋</div>
      <h1>Welcome to PM Code</h1>
      <p class="hero-subtitle">Let's get your AI-powered PM workspace set up</p>
    </div>

    <div class="progress-bar mb-16">
      <div class="progress-fill" style="width: ${progressPct}%"></div>
    </div>

    <div class="dashboard-sections">
      <div>
        <div class="section-header">
          <h2>Quick Start</h2>
          <span class="text-muted">${completedCount} of ${ftueSteps.length} complete</span>
        </div>
        <div class="ftue-steps">`;

    for (const step of ftueSteps) {
      const done = completedSet.has(step.id);
      html += `
          <div class="ftue-step ${done ? 'completed' : ''}">
            <div class="step-check">${done ? '✓' : ''}</div>
            <div class="step-body">
              <div class="step-title">${escapeHtml(step.title)}</div>
              <div class="step-desc">${escapeHtml(step.desc)}</div>
              ${done ? '' : step.action}
            </div>
          </div>`;
    }

    html += `
        </div>
      </div>`;

    // Roo Code status
    html += `
      <div>
        <div class="section-header">
          <h2>AI Assistant</h2>
        </div>
        <div class="connector-row">
          <span class="status-dot ${data.rooConnected ? 'green' : 'red'}"></span>
          <span class="connector-name">Roo Code</span>
          <span class="connector-status">${data.rooConnected ? 'Connected' : 'Not detected'}</span>
        </div>
      </div>`;

    // System dependencies
    html += CompanionPanel.renderDependencies(data.dependencies, data.setupStatus);

    // Suggested guides
    const suggestedGuides = data.guides.slice(0, 2);
    if (suggestedGuides.length > 0) {
      html += `
      <div>
        <div class="section-header">
          <h2>Recommended Guides</h2>
          <button class="section-action" data-action="navigate" data-target="Guides">View all</button>
        </div>`;
      html += CompanionPanel.renderGuideRows(suggestedGuides, data.guideProgress);
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  // ── Phase B: Command Center ─────────────────────────────────────────────

  private static renderCommandCenterPhase(data: DashboardData): string {
    const connectedCount = data.connectors.filter(c => c.status === 'connected').length;
    const warningCount = data.connectors.filter(c => c.status === 'warning' || c.status === 'error').length;

    let html = `
    <div class="dashboard-hero">
      <div class="hero-icon">⚡</div>
      <h1>PM Code</h1>
      <p class="hero-subtitle">Your AI-powered product management command center</p>
    </div>

    <div class="dashboard-sections">`;

    // Connector health
    html += `
      <div>
        <div class="section-header">
          <h2>Connectors</h2>
          <button class="section-action" data-action="navigate" data-target="Connectors">Manage</button>
        </div>`;

    if (data.connectors.length === 0) {
      html += `<div class="empty-state">No connectors configured. <button class="section-action" data-action="navigate" data-target="Connectors">Add one</button></div>`;
    } else {
      for (const conn of data.connectors) {
        html += `
        <div class="connector-row" data-action="openConnector" data-id="${escapeHtml(conn.id)}">
          <span class="status-dot ${statusDotClass(conn.status)}"></span>
          <span style="font-size:16px">${conn.icon}</span>
          <span class="connector-name">${escapeHtml(conn.name)}</span>
          <span class="connector-status">${statusLabel(conn.status)}</span>
        </div>`;
      }
      if (warningCount > 0) {
        html += `<p class="text-muted mt-8" style="font-size:0.85em">${warningCount} connector${warningCount > 1 ? 's' : ''} need${warningCount === 1 ? 's' : ''} attention</p>`;
      }
    }
    html += `</div>`;

    // Recently used skills
    html += `
      <div>
        <div class="section-header">
          <h2>Skills</h2>
          <button class="section-action" data-action="navigate" data-target="Skills">View all</button>
        </div>`;

    if (data.recentlyUsedSkills.length > 0) {
      html += `<p class="text-muted mb-8" style="font-size:0.85em">Recently used</p><div class="skills-wrap">`;
      for (const skillId of data.recentlyUsedSkills) {
        const skill = data.skills.find(s => s.id === skillId);
        if (skill) {
          html += `<div class="skill-chip" data-action="runSkill" data-id="${escapeHtml(skill.id)}">⚡ ${escapeHtml(skill.name)}</div>`;
        }
      }
      html += `</div>`;
    }

    // Suggested skills (ones not recently used)
    const unusedSkills = data.skills.filter(s => !data.recentlyUsedSkills.includes(s.id)).slice(0, 4);
    if (unusedSkills.length > 0) {
      html += `<p class="text-muted mb-8 mt-12" style="font-size:0.85em">Try these</p><div class="skills-wrap">`;
      for (const skill of unusedSkills) {
        html += `<div class="skill-chip" data-action="openSkill" data-id="${escapeHtml(skill.id)}">⚡ ${escapeHtml(skill.name)}</div>`;
      }
      html += `</div>`;
    }

    if (data.skills.length === 0) {
      html += `<div class="empty-state">No skills installed</div>`;
    }
    html += `</div>`;

    // Guides
    html += `
      <div>
        <div class="section-header">
          <h2>Guides</h2>
          <button class="section-action" data-action="navigate" data-target="Guides">View all</button>
        </div>`;

    if (data.guides.length === 0) {
      html += `<div class="empty-state">No guides available</div>`;
    } else {
      // Show in-progress guides first, then not-started
      const inProgress = data.guides.filter(g => {
        const p = data.guideProgress.get(g.id);
        return p && p.completedSteps.length > 0 && p.completedSteps.length < g.steps.length;
      });
      const notStarted = data.guides.filter(g => {
        const p = data.guideProgress.get(g.id);
        return !p || p.completedSteps.length === 0;
      });
      const completed = data.guides.filter(g => {
        const p = data.guideProgress.get(g.id);
        return p && p.completedSteps.length >= g.steps.length;
      });

      if (inProgress.length > 0) {
        html += `<p class="text-muted mb-8" style="font-size:0.85em">In progress</p>`;
        html += CompanionPanel.renderGuideRows(inProgress, data.guideProgress);
      }
      if (notStarted.length > 0) {
        html += `<p class="text-muted mb-8 mt-12" style="font-size:0.85em">Not started</p>`;
        html += CompanionPanel.renderGuideRows(notStarted, data.guideProgress);
      }
      if (completed.length > 0) {
        html += `<p class="text-muted mb-8 mt-12" style="font-size:0.85em">Completed</p>`;
        html += CompanionPanel.renderGuideRows(completed, data.guideProgress);
      }
    }
    html += `</div>`;

    // Quick actions
    html += `
      <div>
        <div class="section-header">
          <h2>Quick Actions</h2>
        </div>
        <div class="skills-wrap">
          <button class="btn btn-secondary" data-action="sendPrompt" data-text="What tasks are currently assigned to me across all connected tools?">My tasks</button>
          <button class="btn btn-secondary" data-action="sendPrompt" data-text="Give me a standup summary of what happened since yesterday across all connected tools.">Standup summary</button>
          <button class="btn btn-secondary" data-action="sendPrompt" data-text="What items need my attention or are blocking others?">Needs attention</button>
          <button class="btn btn-secondary" data-action="checkDependencies">Check system health</button>
        </div>
      </div>`;

    html += `</div>`;
    return html;
  }

  // ── Shared renderers ────────────────────────────────────────────────────

  private static renderDependencies(deps: DependencyStatus[], setupStatus?: SetupStatus): string {
    if (deps.length === 0 && !setupStatus) {
      return '';
    }

    const isLoading = setupStatus && setupStatus.phase !== 'complete' && setupStatus.phase !== 'idle';
    const allReady = deps.length > 0 && deps.every(d => d.installed);

    let html = `
      <div>
        <div class="section-header">
          <h2>System</h2>
          ${isLoading ? '<span class="text-muted" style="font-size:0.85em">Checking...</span>' : ''}
        </div>
        <div class="dep-section">`;

    if (deps.length === 0 && isLoading) {
      html += `<div class="dep-row"><span class="dep-icon">⏳</span><span class="dep-label">Checking system dependencies...</span></div>`;
    } else {
      for (const dep of deps) {
        html += `
          <div class="dep-row">
            <span class="dep-icon">${dep.installed ? '✓' : '✗'}</span>
            <span class="dep-label">${escapeHtml(dep.label)}</span>
            ${dep.version ? `<span class="dep-version">${escapeHtml(dep.version)}</span>` : ''}
          </div>`;
      }
      if (allReady) {
        html += `<p class="text-muted mt-8" style="font-size:0.85em">All systems ready</p>`;
      }
    }

    html += `</div></div>`;
    return html;
  }

  private static renderGuideRows(guides: Guide[], progressMap: Map<string, GuideProgress>): string {
    let html = '';
    for (const guide of guides) {
      const progress = progressMap.get(guide.id);
      const completedSteps = progress?.completedSteps.length ?? 0;
      const totalSteps = guide.steps.length;
      const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      html += `
        <div class="guide-row" data-action="openGuide" data-id="${escapeHtml(guide.id)}">
          <span style="font-size:16px">${guide.type === 'walkthrough' ? '📋' : '📖'}</span>
          <div class="guide-info">
            <div class="guide-title">${escapeHtml(guide.title)}</div>
            <div class="guide-meta">${totalSteps} steps · ~${guide.estimatedMinutes} min${completedSteps > 0 ? ` · ${completedSteps}/${totalSteps} done` : ''}</div>
          </div>
          ${completedSteps > 0 ? `
          <div class="guide-progress-mini">
            <div class="progress-bar" style="height:3px">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
          </div>` : ''}
        </div>`;
    }
    return html;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
