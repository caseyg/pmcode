import * as vscode from 'vscode';
import { PanelManager } from './PanelManager';
import {
  ConnectorConfig,
  ConnectorStatus,
  getNonce,
  getStylesUri,
  escapeHtml,
  escapeAttr,
  statusDotClass,
  statusLabel,
} from './panelUtils';

/**
 * Opens a WebviewPanel for a single connector.
 *
 * Shows: header with status badge, form fields (rendered from ConnectorField[]),
 * help links, action buttons (Test Connection, Disable, Remove), example prompts,
 * and related items.
 */
export class ConnectorDetailPanel {
  static readonly panelType = 'connector-detail';

  static show(
    extensionUri: vscode.Uri,
    panelManager: PanelManager,
    connector: ConnectorConfig,
    currentValues: Record<string, string>
  ): vscode.WebviewPanel {
    const panel = panelManager.openPanel(
      ConnectorDetailPanel.panelType,
      connector.id,
      connector.name,
      (webview) =>
        ConnectorDetailPanel.getHtml(webview, extensionUri, connector, currentValues)
    );

    panel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'configure':
          vscode.commands.executeCommand(
            'pmcode.connector.configure',
            connector.id,
            message.values
          );
          break;
        case 'test':
          vscode.commands.executeCommand('pmcode.connector.test', connector.id);
          break;
        case 'disable':
          vscode.commands.executeCommand('pmcode.connector.disable', connector.id);
          break;
        case 'remove':
          vscode.commands.executeCommand('pmcode.connector.remove', connector.id);
          break;
        case 'sendPrompt':
          vscode.commands.executeCommand('pmcode.sendPrompt', message.text);
          break;
        case 'openSkill':
          vscode.commands.executeCommand('pmcode.openSkill', message.id);
          break;
        case 'openGuide':
          vscode.commands.executeCommand('pmcode.openGuide', message.id);
          break;
      }
    });

    return panel;
  }

  private static getHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    connector: ConnectorConfig,
    currentValues: Record<string, string>
  ): string {
    const stylesUri = getStylesUri(webview, extensionUri);
    const nonce = getNonce();
    const dotClass = statusDotClass(connector.status);
    const label = statusLabel(connector.status);

    // Form fields
    const fieldsHtml = connector.fields
      .map((field) => {
        const value = currentValues[field.id] || '';
        const inputType = field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text';
        const requiredMark = field.required ? '<span class="required">*</span>' : '';

        let helpHtml = '';
        if (field.helpText) {
          helpHtml = `<div class="form-help">${escapeHtml(field.helpText)}`;
          if (field.helpUrl) {
            helpHtml += ` <a href="${escapeAttr(field.helpUrl)}" title="Open help link">Learn more</a>`;
          }
          helpHtml += '</div>';
        }

        if (field.type === 'select' && field.options) {
          const optionsHtml = field.options
            .map(
              (opt) =>
                `<option value="${escapeAttr(opt.value)}"${opt.value === value ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
            )
            .join('');
          return `<div class="form-group">
            <label class="form-label" for="field-${escapeAttr(field.id)}">${escapeHtml(field.label)}${requiredMark}</label>
            <select class="form-input" id="field-${escapeAttr(field.id)}" data-field="${escapeAttr(field.id)}">
              <option value="">Select...</option>
              ${optionsHtml}
            </select>
            ${helpHtml}
          </div>`;
        }

        return `<div class="form-group">
          <label class="form-label" for="field-${escapeAttr(field.id)}">${escapeHtml(field.label)}${requiredMark}</label>
          <input class="form-input" id="field-${escapeAttr(field.id)}"
            type="${inputType}"
            data-field="${escapeAttr(field.id)}"
            value="${escapeAttr(value)}"
            placeholder="${escapeAttr(field.placeholder || '')}" />
          ${helpHtml}
        </div>`;
      })
      .join('\n');

    // Example prompts
    const promptsHtml = connector.examplePrompts
      .map(
        (p) =>
          `<button class="btn btn-send" data-prompt="${escapeAttr(p)}">${escapeHtml(p)}</button>`
      )
      .join('\n');

    // Related skills
    const relatedSkillsHtml = connector.relatedSkills
      .map(
        (id) =>
          `<button class="related-item" data-skill="${escapeAttr(id)}">${escapeHtml(id)}</button>`
      )
      .join('');

    // Related guides
    const relatedGuidesHtml = connector.relatedGuides
      .map(
        (id) =>
          `<button class="related-item" data-guide="${escapeAttr(id)}">${escapeHtml(id)}</button>`
      )
      .join('');

    const hasRelated = connector.relatedSkills.length > 0 || connector.relatedGuides.length > 0;

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
    <!-- Header -->
    <div class="detail-header">
      <div class="detail-icon">${escapeHtml(connector.icon)}</div>
      <div class="detail-info">
        <h1>${escapeHtml(connector.name)}</h1>
        <p>${escapeHtml(connector.description)}</p>
        <div class="mt-8">
          <span class="status-dot ${dotClass}"></span>
          <span>${escapeHtml(label)}</span>
          <span class="badge">${escapeHtml(connector.type)}</span>
        </div>
      </div>
    </div>

    <!-- Configuration Form -->
    ${connector.fields.length > 0 ? `
    <div class="detail-section">
      <h2>Configuration</h2>
      <div class="detail-form" id="configForm">
        ${fieldsHtml}
        <div class="btn-group">
          <button class="btn btn-primary" id="saveBtn">Save</button>
          <button class="btn btn-secondary" id="testBtn">Test Connection</button>
        </div>
      </div>
    </div>
    ` : `
    <div class="detail-section">
      <h2>Configuration</h2>
      <p class="text-muted">This connector is auto-detected and requires no manual configuration.</p>
      <div class="btn-group mt-8">
        <button class="btn btn-secondary" id="testBtn">Test Connection</button>
      </div>
    </div>
    `}

    <!-- Actions -->
    <div class="detail-section">
      <h2>Actions</h2>
      <div class="btn-group">
        <button class="btn btn-secondary" id="disableBtn">Disable</button>
        <button class="btn btn-danger" id="removeBtn">Remove</button>
      </div>
    </div>

    <!-- What you can do -->
    ${connector.examplePrompts.length > 0 ? `
    <div class="detail-section">
      <h2>What you can do</h2>
      <div class="prompt-buttons">
        ${promptsHtml}
      </div>
    </div>
    ` : ''}

    <!-- Related -->
    ${hasRelated ? `
    <div class="detail-section">
      <h2>Related</h2>
      <div class="related-items">
        ${relatedSkillsHtml}
        ${relatedGuidesHtml}
      </div>
    </div>
    ` : ''}
  </div>

  <script nonce="${nonce}">
    var vscode = acquireVsCodeApi();

    // Save form
    var saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var values = {};
        document.querySelectorAll('[data-field]').forEach(function(el) {
          values[el.dataset.field] = el.value || '';
        });
        vscode.postMessage({ type: 'configure', values: values });
      });
    }

    // Test connection
    document.getElementById('testBtn').addEventListener('click', function() {
      vscode.postMessage({ type: 'test' });
    });

    // Disable
    document.getElementById('disableBtn').addEventListener('click', function() {
      vscode.postMessage({ type: 'disable' });
    });

    // Remove
    document.getElementById('removeBtn').addEventListener('click', function() {
      vscode.postMessage({ type: 'remove' });
    });

    // Send prompt buttons
    document.querySelectorAll('.btn-send').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ type: 'sendPrompt', text: btn.dataset.prompt });
      });
    });

    // Related skills
    document.querySelectorAll('.related-item[data-skill]').forEach(function(item) {
      item.addEventListener('click', function() {
        vscode.postMessage({ type: 'openSkill', id: item.dataset.skill });
      });
    });

    // Related guides
    document.querySelectorAll('.related-item[data-guide]').forEach(function(item) {
      item.addEventListener('click', function() {
        vscode.postMessage({ type: 'openGuide', id: item.dataset.guide });
      });
    });
  </script>
</body>
</html>`;
  }
}
