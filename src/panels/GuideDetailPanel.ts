import * as vscode from 'vscode';
import { PanelManager } from './PanelManager';
import {
  Guide,
  GuideProgress,
  getNonce,
  getStylesUri,
  escapeHtml,
  escapeAttr,
} from './panelUtils';

/**
 * Opens a WebviewPanel for a single guide.
 *
 * Layout: left rail (numbered step list with checkmarks + progress bar) +
 * main content (step title, description, prompts, pro tips).
 * Bottom nav: Previous / Next step buttons.
 * "Send to Roo" buttons for interactive prompts.
 * "I already did this" skip option.
 */
export class GuideDetailPanel {
  static readonly panelType = 'guide-detail';

  static show(
    extensionUri: vscode.Uri,
    panelManager: PanelManager,
    guide: Guide,
    progress: GuideProgress
  ): vscode.WebviewPanel {
    const panel = panelManager.openPanel(
      GuideDetailPanel.panelType,
      guide.id,
      guide.title,
      (webview) =>
        GuideDetailPanel.getHtml(webview, extensionUri, guide, progress)
    );

    panel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'completeStep':
          vscode.commands.executeCommand(
            'pmcode.guide.completeStep',
            guide.id,
            message.step
          );
          break;
        case 'nextStep':
          vscode.commands.executeCommand('pmcode.guide.start', guide.id);
          break;
        case 'prevStep':
          vscode.commands.executeCommand('pmcode.guide.start', guide.id);
          break;
        case 'sendPrompt':
          vscode.commands.executeCommand('pmcode.sendPrompt', message.text);
          break;
        case 'goToStep':
          // Re-render with new step (handled by command layer)
          vscode.commands.executeCommand('pmcode.guide.start', guide.id);
          break;
      }
    });

    return panel;
  }

  private static getHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    guide: Guide,
    progress: GuideProgress
  ): string {
    const stylesUri = getStylesUri(webview, extensionUri);
    const nonce = getNonce();

    const currentStep = progress.currentStep;
    const totalSteps = guide.steps.length;
    const completedSteps = new Set(progress.completedSteps);
    const completedCount = completedSteps.size;
    const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    // Step list (left rail)
    const stepListHtml = guide.steps
      .map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = completedSteps.has(i);
        let cls = 'step-item';
        if (isActive) { cls += ' active'; }
        if (isCompleted) { cls += ' completed'; }

        const numberContent = isCompleted ? '&#10003;' : String(i + 1);

        return `<li class="${cls}" data-step="${i}">
          <span class="step-number">${numberContent}</span>
          <span class="step-label">${escapeHtml(step.title)}</span>
        </li>`;
      })
      .join('\n');

    // Current step content
    const step = guide.steps[currentStep];
    let stepContentHtml = '';
    if (step) {
      // Step content (simple markdown)
      const bodyHtml = simpleMarkdown(step.content);

      // Prompt buttons
      let promptsHtml = '';
      if (step.prompts && step.prompts.length > 0) {
        promptsHtml = `<div class="prompt-buttons">
          ${step.prompts
            .map(
              (p) =>
                `<button class="btn btn-send" data-prompt="${escapeAttr(p.text)}">${escapeHtml(p.label)}</button>`
            )
            .join('\n')}
        </div>`;
      }

      // Pro tip
      let proTipHtml = '';
      if (step.proTip) {
        proTipHtml = `<div class="pro-tip">${escapeHtml(step.proTip)}</div>`;
      }

      stepContentHtml = `
        <h2>${escapeHtml(step.title)}</h2>
        <div class="step-content mt-12">
          ${bodyHtml}
          ${promptsHtml}
          ${proTipHtml}
        </div>`;
    }

    // Navigation buttons
    const hasPrev = currentStep > 0;
    const hasNext = currentStep < totalSteps - 1;
    const isCurrentCompleted = completedSteps.has(currentStep);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${stylesUri}" />
</head>
<body>
  <div class="panel-container">
    <div class="panel-header">
      <h1>${escapeHtml(guide.title)}</h1>
      <p>${escapeHtml(guide.description)}</p>
      <div class="mt-8">
        <span class="badge">${guide.type === 'walkthrough' ? 'Walkthrough' : 'Step-by-step'}</span>
        <span class="text-muted">${guide.estimatedMinutes} min</span>
      </div>
    </div>

    <div class="guide-layout">
      <!-- Left Rail -->
      <div class="guide-rail">
        <div class="progress-bar mb-8"><div class="progress-fill" style="width:${pct}%"></div></div>
        <p class="text-muted mb-12">${completedCount} of ${totalSteps} steps complete</p>
        <ul class="step-list">
          ${stepListHtml}
        </ul>
      </div>

      <!-- Main Content -->
      <div class="guide-main">
        ${stepContentHtml}

        <!-- Navigation -->
        <div class="guide-nav">
          <div>
            ${hasPrev ? `<button class="btn btn-secondary" id="prevBtn">Previous</button>` : '<span></span>'}
          </div>
          <div>
            ${!isCurrentCompleted ? `<button class="skip-link" id="skipBtn">I already did this</button>` : ''}
          </div>
          <div>
            ${hasNext
              ? `<button class="btn btn-primary" id="nextBtn">Next step</button>`
              : `<button class="btn btn-primary" id="completeBtn">Complete guide</button>`
            }
          </div>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    var vscode = acquireVsCodeApi();
    var currentStep = ${currentStep};
    var totalSteps = ${totalSteps};

    // Step list click
    document.querySelectorAll('.step-item').forEach(function(item) {
      item.addEventListener('click', function() {
        vscode.postMessage({ type: 'goToStep', step: parseInt(item.dataset.step, 10) });
      });
    });

    // Previous
    var prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'prevStep' });
      });
    }

    // Next
    var nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'completeStep', step: currentStep });
        vscode.postMessage({ type: 'nextStep' });
      });
    }

    // Complete guide (last step)
    var completeBtn = document.getElementById('completeBtn');
    if (completeBtn) {
      completeBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'completeStep', step: currentStep });
      });
    }

    // Skip (I already did this)
    var skipBtn = document.getElementById('skipBtn');
    if (skipBtn) {
      skipBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'completeStep', step: currentStep });
        if (currentStep < totalSteps - 1) {
          vscode.postMessage({ type: 'nextStep' });
        }
      });
    }

    // Send prompt buttons
    document.querySelectorAll('.btn-send').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ type: 'sendPrompt', text: btn.dataset.prompt });
      });
    });
  </script>
</body>
</html>`;
  }
}

/**
 * Very simple markdown to HTML conversion for guide step content.
 */
function simpleMarkdown(md: string): string {
  return md
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) { return ''; }
      if (trimmed.startsWith('### ')) {
        return `<h4>${escapeHtml(trimmed.slice(4))}</h4>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h3>${escapeHtml(trimmed.slice(3))}</h3>`;
      }
      if (trimmed.startsWith('# ')) {
        return `<h2>${escapeHtml(trimmed.slice(2))}</h2>`;
      }
      if (/^[-*]\s/.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((l) => /^[-*]\s/.test(l.trim()))
          .map((l) => `<li>${escapeHtml(l.trim().replace(/^[-*]\s/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((l) => /^\d+\.\s/.test(l.trim()))
          .map((l) => `<li>${escapeHtml(l.trim().replace(/^\d+\.\s/, ''))}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join('\n');
}
