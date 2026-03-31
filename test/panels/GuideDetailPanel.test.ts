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
    expect(html).toContain('33%');
  });

  it('marks completed steps', () => {
    const guide = makeGuide();
    const progress = makeProgress({ completedSteps: [0, 1], currentStep: 2 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('completed');
    expect(html).toContain('&#10003;');
  });

  // ── Deeper coverage ──

  it('shows guide title and description in header', () => {
    const guide = makeGuide({ title: 'Advanced Workflows', description: 'Learn advanced PM techniques' });
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('Advanced Workflows');
    expect(html).toContain('Learn advanced PM techniques');
  });

  it('shows type badge for walkthrough', () => {
    const guide = makeGuide({ type: 'walkthrough' });
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('Walkthrough');
  });

  it('shows type badge for step-by-step', () => {
    const guide = makeGuide({ type: 'step-by-step' });
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('Step-by-step');
  });

  it('shows estimated time', () => {
    const guide = makeGuide({ estimatedMinutes: 15 });
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('15 min');
  });

  it('hides prev button on first step', () => {
    const guide = makeGuide();
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).not.toContain('id="prevBtn"');
  });

  it('shows "Complete guide" button on last step', () => {
    const guide = makeGuide();
    const progress = makeProgress({ currentStep: 2 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('id="completeBtn"');
    expect(html).toContain('Complete guide');
    expect(html).not.toContain('id="nextBtn"');
  });

  it('shows "I already did this" skip button when step not completed', () => {
    const guide = makeGuide();
    const progress = makeProgress({ currentStep: 0, completedSteps: [] });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('skipBtn');
    expect(html).toContain('I already did this');
  });

  it('hides skip button when current step is completed', () => {
    const guide = makeGuide();
    const progress = makeProgress({ currentStep: 0, completedSteps: [0] });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).not.toContain('id="skipBtn"');
  });

  it('shows 0% progress when no steps completed', () => {
    const guide = makeGuide();
    const progress = makeProgress({ completedSteps: [] });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('width:0%');
    expect(html).toContain('0 of 3 steps complete');
  });

  it('shows 100% progress when all steps completed', () => {
    const guide = makeGuide();
    const progress = makeProgress({ completedSteps: [0, 1, 2], currentStep: 2 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('width:100%');
    expect(html).toContain('3 of 3 steps complete');
  });

  it('highlights current step as active in left rail', () => {
    const guide = makeGuide();
    const progress = makeProgress({ currentStep: 1 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    // Step 2 (index 1) should have active class
    expect(html).toMatch(/step-item active[^"]*"[^>]*data-step="1"/);
  });

  it('shows step numbers for uncompleted steps', () => {
    const guide = makeGuide();
    const progress = makeProgress({ completedSteps: [], currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('>1<');
    expect(html).toContain('>2<');
    expect(html).toContain('>3<');
  });

  it('renders prompt buttons in step', () => {
    const guide = makeGuide({
      steps: [
        {
          title: 'Try it',
          content: 'Send a prompt',
          prompts: [
            { label: 'Say hello', text: 'Hello Roo!' },
            { label: 'Ask question', text: 'What can you do?' },
          ],
        },
      ],
    });
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('btn-send');
    expect(html).toContain('Say hello');
    expect(html).toContain('Ask question');
    expect(html).toContain('data-prompt="Hello Roo!"');
    expect(html).toContain('data-prompt="What can you do?"');
  });

  it('renders pro tip when present', () => {
    const guide = makeGuide({
      steps: [
        {
          title: 'Tip step',
          content: 'Basic content',
          proTip: 'You can also use keyboard shortcuts!',
        },
      ],
    });
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('pro-tip');
    expect(html).toContain('keyboard shortcuts');
  });

  it('does not render pro tip when absent', () => {
    const guide = makeGuide({
      steps: [{ title: 'No tip', content: 'Just content' }],
    });
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).not.toContain('pro-tip');
  });

  it('renders markdown in step content — headings', () => {
    const guide = makeGuide({
      steps: [{ title: 'MD', content: '## Sub Heading\n\nParagraph text' }],
    });
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('<h2>');
    expect(html).toContain('Sub Heading');
    expect(html).toContain('Paragraph text');
  });

  it('renders markdown in step content — bullet list', () => {
    const guide = makeGuide({
      steps: [{ title: 'List', content: '- Alpha\n- Beta\n- Gamma' }],
    });
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Alpha</li>');
    expect(html).toContain('<li>Beta</li>');
    expect(html).toContain('<li>Gamma</li>');
  });

  it('renders markdown in step content — numbered list', () => {
    const guide = makeGuide({
      steps: [{ title: 'OL', content: '1. First\n2. Second' }],
    });
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
  });

  it('escapes HTML in guide title and description', () => {
    const guide = makeGuide({
      title: '<script>xss</script>',
      description: 'Test & "safety"',
    });
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).not.toContain('<script>xss');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('escapes HTML in step content', () => {
    const guide = makeGuide({
      steps: [{ title: 'Safe', content: '<img onerror=alert(1)>' }],
    });
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    // Raw HTML tags in markdown source should be escaped
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img');
  });

  it('has valid CSP meta tag', () => {
    const guide = makeGuide();
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("default-src 'none'");
    expect(html).toMatch(/script-src 'nonce-[a-zA-Z0-9]+'/);
  });

  it('includes stylesheet link', () => {
    const guide = makeGuide();
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('rel="stylesheet"');
  });

  // ── Message handler tests ──

  it('handles completeStep message', () => {
    const guide = makeGuide();
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);

    (panel as any)._simulateMessage({ type: 'completeStep', step: 0 });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'pmcode.guide.completeStep',
      'getting-started',
      0
    );
  });

  it('handles nextStep message', () => {
    const guide = makeGuide();
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);

    (panel as any)._simulateMessage({ type: 'nextStep' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.guide.start', 'getting-started');
  });

  it('handles prevStep message', () => {
    const guide = makeGuide();
    const progress = makeProgress({ currentStep: 1 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);

    (panel as any)._simulateMessage({ type: 'prevStep' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.guide.start', 'getting-started');
  });

  it('handles goToStep message', () => {
    const guide = makeGuide();
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);

    (panel as any)._simulateMessage({ type: 'goToStep', step: 2 });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.guide.start', 'getting-started');
  });

  it('handles sendPrompt message', () => {
    const guide = makeGuide();
    const progress = makeProgress();
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);

    (panel as any)._simulateMessage({ type: 'sendPrompt', text: 'Hello Roo!' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('pmcode.sendPrompt', 'Hello Roo!');
  });

  // ── Edge cases ──

  it('handles single-step guide', () => {
    const guide = makeGuide({
      steps: [{ title: 'Only Step', content: 'Just one step' }],
    });
    const progress = makeProgress({ currentStep: 0 });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    // No prev button, no next button, has complete button
    expect(html).not.toContain('id="prevBtn"');
    expect(html).not.toContain('id="nextBtn"');
    expect(html).toContain('id="completeBtn"');
    expect(html).toContain('Complete guide');
    expect(html).toContain('Only Step');
  });

  it('handles guide with many steps', () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      title: `Step ${i + 1}`,
      content: `Content for step ${i + 1}`,
    }));
    const guide = makeGuide({ steps });
    const progress = makeProgress({ currentStep: 5, completedSteps: [0, 1, 2, 3, 4] });
    const panel = GuideDetailPanel.show(extensionUri, panelManager, guide, progress);
    const html = panel.webview.html;

    expect(html).toContain('5 of 10 steps complete');
    expect(html).toContain('50%');
    expect(html).toContain('Content for step 6');
    // 5 checkmarks for completed steps
    const checkmarks = (html.match(/&#10003;/g) || []).length;
    expect(checkmarks).toBe(5);
  });
});
