import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { PanelManager } from '../../src/panels/PanelManager';

describe('PanelManager', () => {
  let pm: PanelManager;
  const extensionUri = vscode.Uri.file('/mock/ext');

  beforeEach(() => {
    vi.clearAllMocks();
    pm = new PanelManager(extensionUri);
  });

  it('openPanel() creates a new panel when none exists', () => {
    const getHtml = vi.fn(() => '<html></html>');
    const panel = pm.openPanel('skills-list', 'list', 'Skills', getHtml);

    expect(vscode.window.createWebviewPanel).toHaveBeenCalledOnce();
    expect(panel).toBeDefined();
    expect(panel.webview.html).toBe('<html></html>');
    expect(getHtml).toHaveBeenCalledOnce();
  });

  it('openPanel() focuses existing panel instead of creating duplicate', () => {
    const getHtml = vi.fn(() => '<html></html>');
    const panel1 = pm.openPanel('skills-list', 'list', 'Skills', getHtml);
    const panel2 = pm.openPanel('skills-list', 'list', 'Skills', getHtml);

    expect(panel1).toBe(panel2);
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledOnce();
    expect(panel2.reveal).toHaveBeenCalled();
  });

  it('closePanel() disposes and removes panel from tracking', () => {
    const getHtml = vi.fn(() => '<html></html>');
    pm.openPanel('skills-list', 'list', 'Skills', getHtml);

    expect(pm.has('skills-list', 'list')).toBe(true);
    pm.closePanel('skills-list', 'list');
    expect(pm.has('skills-list', 'list')).toBe(false);
  });

  it('getPanel() returns existing panel', () => {
    const getHtml = vi.fn(() => '<html></html>');
    const panel = pm.openPanel('skills-list', 'list', 'Skills', getHtml);

    expect(pm.getPanel('skills-list', 'list')).toBe(panel);
  });

  it('getPanel() returns undefined for unknown panel', () => {
    expect(pm.getPanel('nonexistent', 'id')).toBeUndefined();
  });

  it('panel dispose event cleans up tracking', () => {
    const getHtml = vi.fn(() => '<html></html>');
    const panel = pm.openPanel('skills-list', 'list', 'Skills', getHtml);

    expect(pm.has('skills-list', 'list')).toBe(true);

    // Simulate external dispose (e.g., user closes the tab)
    (panel as any)._triggerDispose();

    expect(pm.has('skills-list', 'list')).toBe(false);
  });

  it('multiple panels of different types can coexist', () => {
    const getHtml = vi.fn(() => '<html></html>');

    pm.openPanel('skills-list', 'list', 'Skills', getHtml);
    pm.openPanel('connectors-list', 'list', 'Connectors', getHtml);
    pm.openPanel('skill-detail', 'idea-triage', 'Idea Triage', getHtml);

    expect(pm.has('skills-list', 'list')).toBe(true);
    expect(pm.has('connectors-list', 'list')).toBe(true);
    expect(pm.has('skill-detail', 'idea-triage')).toBe(true);
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(3);
  });
});
