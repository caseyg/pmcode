import * as vscode from 'vscode';

/**
 * Generate a random nonce string for Content Security Policy.
 */
export function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

/**
 * Get the webview URI for the shared styles.css file.
 */
export function getStylesUri(webview: vscode.Webview, extensionUri: vscode.Uri): vscode.Uri {
  return webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview-ui', 'styles.css')
  );
}

/**
 * Escape a string for safe insertion into HTML content.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape a string for safe insertion into HTML attribute values.
 */
export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Connector status type used across panels.
 */
export type ConnectorStatus = 'connected' | 'unconfigured' | 'error' | 'disabled' | 'warning';

/**
 * Connector field definition for form rendering.
 */
export interface ConnectorField {
  id: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string;
  helpText?: string;
  helpUrl?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

/**
 * Connector configuration shape, matching the adapters.
 */
export interface ConnectorConfig {
  id: string;
  name: string;
  type: 'mcp-server' | 'cli-tool' | 'rest-api';
  description: string;
  icon: string;
  status: ConnectorStatus;
  fields: ConnectorField[];
  mcpServer?: {
    command: string;
    args: string[];
    envMapping: Record<string, string>;
  };
  cliTool?: {
    command: string;
    authCommand: string;
    statusCommand: string;
  };
  examplePrompts: string[];
  relatedSkills: string[];
  relatedGuides: string[];
}

/**
 * Guide types used by guide panels.
 */
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
  content: string; // markdown
  prompts?: { label: string; text: string }[];
  proTip?: string;
}

export interface GuideProgress {
  guideId: string;
  completedSteps: number[];
  currentStep: number;
  startedAt?: string;
}

/**
 * Map a ConnectorStatus to the appropriate CSS status-dot class.
 */
export function statusDotClass(status: ConnectorStatus): string {
  switch (status) {
    case 'connected':
      return 'green';
    case 'warning':
      return 'yellow';
    case 'error':
      return 'red';
    case 'disabled':
    case 'unconfigured':
    default:
      return 'muted';
  }
}

/**
 * Map a ConnectorStatus to a human-readable label.
 */
export function statusLabel(status: ConnectorStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'warning':
      return 'Needs attention';
    case 'error':
      return 'Error';
    case 'disabled':
      return 'Disabled';
    case 'unconfigured':
    default:
      return 'Not configured';
  }
}
