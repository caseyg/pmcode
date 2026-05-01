import * as vscode from 'vscode';

/**
 * Tracks open WebviewPanels to prevent duplicates and manage lifecycle.
 *
 * Each panel is identified by a composite key: `${type}:${id}`.
 * If a panel with the same key already exists, it is revealed rather than
 * creating a duplicate.
 */
export class PanelManager {
  private panels: Map<string, vscode.WebviewPanel> = new Map();

  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Open a panel or focus it if it already exists.
   *
   * @param type - Panel type (e.g., 'skills-list', 'skill-detail', 'connector-detail')
   * @param id - Panel instance id (e.g., skill id, or 'list' for list panels)
   * @param title - Display title for the tab
   * @param getHtml - Function that receives the webview and returns HTML content
   * @returns The WebviewPanel (new or existing)
   */
  openPanel(
    type: string,
    id: string,
    title: string,
    getHtml: (webview: vscode.Webview) => string
  ): vscode.WebviewPanel {
    const key = `${type}:${id}`;

    const existing = this.panels.get(key);
    if (existing) {
      existing.reveal(vscode.ViewColumn.One);
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      `pmcode.${type}`,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = getHtml(panel.webview);

    this.panels.set(key, panel);

    panel.onDidDispose(() => {
      this.panels.delete(key);
    });

    return panel;
  }

  /**
   * Update an existing panel's HTML without creating a new one.
   * Returns true if the panel was found and updated.
   */
  updatePanel(
    type: string,
    id: string,
    getHtml: (webview: vscode.Webview) => string
  ): boolean {
    const key = `${type}:${id}`;
    const existing = this.panels.get(key);
    if (existing) {
      existing.webview.html = getHtml(existing.webview);
      return true;
    }
    return false;
  }

  /**
   * Close and dispose a panel by type and id.
   */
  closePanel(type: string, id: string): void {
    const key = `${type}:${id}`;
    const panel = this.panels.get(key);
    if (panel) {
      panel.dispose();
      // onDidDispose handler cleans up the map entry
    }
  }

  /**
   * Get an existing panel or undefined if not open.
   */
  getPanel(type: string, id: string): vscode.WebviewPanel | undefined {
    return this.panels.get(`${type}:${id}`);
  }

  /**
   * Check if a panel is currently open.
   */
  has(type: string, id: string): boolean {
    return this.panels.has(`${type}:${id}`);
  }

  /**
   * Dispose all tracked panels.
   */
  disposeAll(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}
