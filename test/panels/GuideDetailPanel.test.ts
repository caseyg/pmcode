import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { GuideDetailPanel } from '../../src/panels/GuideDetailPanel';
import { PanelManager } from '../../src/panels/PanelManager';
import type { Guide, GuideProgress } from '../../src/panels/panelUtils';

function makeGuide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Set up your environment',
    type: 'walkthrough',
    estimatedMinutes: 10,
    relatedConnectors: [],
    relatedSkills: [],
    steps: [
      { title: 'Step One', content: 'Do the first thing' },
      { title: 'Step Two', content: 'Do the second thing' },
      { title: 'Step Three', content: 'Do the third thing' },
    ],
    ...overrides,
  };
}

function makeProgress(overrides: Partial<GuideProgress> = {}): GuideProgress {
  return {
    guideId: 'getting-started',
    completedSteps: [],
    currentStep: 0,
    ...overrides,
  };
}

describe('GuideDetailPanel', () => {
  let panelManager: PanelManager;
  const extensionUri = vscode.Uri.file('/mock/ext');

  beforeEach(() => {
    vi.clearAllMocks();
    panelManager = new PanelManager(extensionUri);
  });

  it('show() creates panel with guide steps', () => {
    const guide = makeGuide();
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);

    expect(panel).toBeDefined();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
  });

  it('HTML contains step list in left rail', () => {
    const guide = makeGuide();
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('step-list');
    expect(html).toContain('Step One');
    expect(html).toContain('Step Two');
    expect(html).toContain('Step Three');
  });

  it('shows current step content', () => {
    const guide = makeGuide();
    const progress = makeProgress({ currentStep: 1 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    // Current step content should be rendered in main area
    expect(html).toContain('Do the second thing');
  });

  it('includes navigation buttons (prev/next)', () => {
    const guide = makeGuide();
    const progress = makeProgress({ currentStep: 1 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('prevBtn');
    expect(html).toContain('Previous');
    expect(html).toContain('nextBtn');
    expect(html).toContain('Next step');
  });

  it('shows progress bar', () => {
    const guide = makeGuide();
    const progress = makeProgress({ completedSteps: [0] });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('progress-bar');
    expect(html).toContain('progress-fill');
    // 1 of 3 steps = 33%
    expect(html).toContain('33%');
  });

  it('marks completed steps', () => {
    const guide = makeGuide();
    const progress = makeProgress({ completedSteps: [0, 1], currentStep: 2 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    // Completed steps should have the completed class and checkmark
    expect(html).toContain('completed');
    expect(html).toContain('&#10003;');
  });
});
