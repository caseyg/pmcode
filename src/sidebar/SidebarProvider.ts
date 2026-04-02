import * as vscode from 'vscode';
import { getNonce } from '../panels/panelUtils';

export interface SearchResult {
  category: 'skills' | 'connectors' | 'guides' | 'commands';
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface SidebarMarketplaceStatus {
  available: boolean;
  lastUpdated: string | null;
  skillCount: number;
  connectorCount: number;
}

/**
 * WebviewViewProvider for the PM Code sidebar.
 *
 * Renders a single webview with search bar, navigation buttons (Skills,
 * Connectors, Guides), Quick Start progress (during FTUE), and Roo Code
 * connection status. Two states: default (nav) and search active (results).
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'pmcode.sidebar';

  private view?: vscode.WebviewView;
  private onReadyCallback?: () => void;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Register a callback to fire when the webview JS is ready.
   * Used by extension.ts to push initial FTUE progress and counts.
   */
  onReady(callback: () => void): void {
    this.onReadyCallback = callback;
  }

  private onWebviewReady(): void {
    this.onReadyCallback?.();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'search':
          // Run search and send results back — don't re-focus sidebar
          this.performSearch(message.query);
          break;
        case 'navigate':
          this.handleNavigate(message.target);
          break;
        case 'openItem':
          this.handleOpenItem(message.category, message.id);
          break;
        case 'clearSearch':
          break;
        case 'openWalkthrough':
          vscode.commands.executeCommand(
            'workbench.action.openWalkthrough',
            'pmcode.pmcode#pmcode.gettingStarted',
            false
          );
          break;
        case 'ready':
          // Webview JS is loaded — send current state
          this.onWebviewReady();
          break;
        case 'marketplaceSync':
          vscode.commands.executeCommand('pmcode.marketplace.sync');
          break;
        case 'marketplaceBrowse':
          vscode.commands.executeCommand('pmcode.marketplace.browse');
          break;
      }
    });
  }

  /**
   * Send updated counts for nav buttons.
   */
  updateCounts(skills: number, connectors: number, guides: number): void {
    this.view?.webview.postMessage({
      type: 'updateCounts',
      skills,
      connectors,
      guides,
    });
  }

  /**
   * Send Roo connection status.
   */
  updateStatus(rooConnected: boolean): void {
    this.view?.webview.postMessage({
      type: 'updateStatus',
      rooConnected,
    });
  }

  /**
   * Send search results to the webview.
   */
  sendSearchResults(results: SearchResult[]): void {
    this.view?.webview.postMessage({
      type: 'searchResults',
      results,
    });
  }

  /**
   * Send FTUE progress to the webview.
   */
  updateFtueProgress(completed: number, total: number): void {
    this.view?.webview.postMessage({
      type: 'ftueProgress',
      completed,
      total,
    });
  }

  /**
   * Send marketplace status to the webview.
   */
  updateMarketplaceStatus(status: SidebarMarketplaceStatus): void {
    this.view?.webview.postMessage({
      type: 'updateMarketplace',
      ...status,
    });
  }

  /**
   * Set the search query in the sidebar webview.
   */
  setSearchQuery(query: string): void {
    this.view?.webview.postMessage({ type: 'setSearch', query });
  }

  /**
   * Focus the sidebar view.
   */
  focus(): void {
    this.view?.show(true);
  }

  private performSearch(query: string): void {
    // Execute search command — it will call sendSearchResults() back to us
    // Pass fromSidebar=true to avoid re-focusing and re-setting the query
    vscode.commands.executeCommand('pmcode.search', query, true);
  }

  private handleNavigate(target: string): void {
    switch (target) {
      case 'skills':
        vscode.commands.executeCommand('pmcode.openSkills');
        break;
      case 'connectors':
        vscode.commands.executeCommand('pmcode.openConnectors');
        break;
      case 'guides':
        vscode.commands.executeCommand('pmcode.openGuides');
        break;
    }
  }

  private handleOpenItem(category: string, id: string): void {
    switch (category) {
      case 'skills':
        vscode.commands.executeCommand('pmcode.openSkill', id);
        break;
      case 'connectors':
        vscode.commands.executeCommand('pmcode.openConnector', id);
        break;
      case 'guides':
        vscode.commands.executeCommand('pmcode.openGuide', id);
        break;
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'styles.css')
    );
    const nonce = getNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${stylesUri}" />
</head>
<body>
  <div class="sidebar-container">
    <!-- Search Bar -->
    <div class="search-bar" id="searchBar">
      <input type="text" id="searchInput" placeholder="Search skills, connectors, guides..." />
      <button class="search-clear" id="searchClear" title="Clear search">&times;</button>
    </div>

    <!-- Quick Start (FTUE) -->
    <div class="quick-start-card" id="quickStart" style="display:none; cursor:pointer;" title="Open Getting Started walkthrough">
      <h4>Quick Start</h4>
      <div class="progress-bar"><div class="progress-fill" id="ftueProgress" style="width:0%"></div></div>
      <p class="text-muted" id="ftueLabel">0 of 0 steps complete</p>
    </div>

    <!-- Default View: Nav Buttons -->
    <div id="defaultView">
      <div class="nav-buttons">
        <button class="nav-button" data-target="skills">
          <span class="nav-icon">&#9889;</span>
          <span class="nav-label">Skills</span>
          <span class="nav-count" id="skillsCount"></span>
        </button>
        <button class="nav-button" data-target="connectors">
          <span class="nav-icon">&#128268;</span>
          <span class="nav-label">Connectors</span>
          <span class="nav-count" id="connectorsCount"></span>
        </button>
        <button class="nav-button" data-target="guides">
          <span class="nav-icon">&#128214;</span>
          <span class="nav-label">Guides</span>
          <span class="nav-count" id="guidesCount"></span>
        </button>
      </div>
    </div>

    <!-- Marketplace -->
    <div id="marketplaceSection" style="margin-top:4px;">
      <div class="nav-buttons">
        <button class="nav-button" id="marketplaceBrowseBtn">
          <span class="nav-icon">&#128722;</span>
          <span class="nav-label">Marketplace</span>
          <span class="nav-count" id="marketplaceCount"></span>
        </button>
      </div>
      <div id="marketplaceStatus" style="padding:0 10px; font-size:0.85em; opacity:0.6; display:flex; align-items:center; gap:6px; margin-top:2px;">
        <span id="marketplaceLastUpdated"></span>
        <button id="marketplaceSyncBtn" style="background:none; border:none; color:var(--vscode-textLink-foreground); cursor:pointer; font-size:0.85em; font-family:inherit; padding:0;">Update</button>
      </div>
    </div>

    <!-- Search View -->
    <div id="searchView" class="hidden">
      <div class="filter-chips">
        <button class="chip chip-active" data-filter="all">All</button>
        <button class="chip" data-filter="skills">Skills</button>
        <button class="chip" data-filter="connectors">Connectors</button>
        <button class="chip" data-filter="guides">Guides</button>
      </div>
      <div class="search-results" id="searchResults">
        <div class="search-empty">Type to search...</div>
      </div>
    </div>

    <!-- Status Footer -->
    <div class="status-footer">
      <span class="status-dot muted" id="rooStatusDot"></span>
      <span id="rooStatusLabel">Roo Code: checking...</span>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const searchBar = document.getElementById('searchBar');
    const defaultView = document.getElementById('defaultView');
    const searchView = document.getElementById('searchView');
    const searchResults = document.getElementById('searchResults');
    const quickStart = document.getElementById('quickStart');
    const ftueProgressEl = document.getElementById('ftueProgress');
    const ftueLabel = document.getElementById('ftueLabel');

    let activeFilter = 'all';
    let currentResults = [];

    // Quick Start card → open walkthrough
    quickStart.addEventListener('click', function() {
      vscode.postMessage({ type: 'openWalkthrough' });
    });

    // Navigation buttons
    document.querySelectorAll('.nav-button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ type: 'navigate', target: btn.dataset.target });
      });
    });

    // Search input
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      const query = searchInput.value.trim();
      if (query) {
        searchBar.classList.add('has-query');
        defaultView.classList.add('hidden');
        searchView.classList.remove('hidden');
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
          vscode.postMessage({ type: 'search', query: query });
        }, 200);
      } else {
        clearSearch();
      }
    });

    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        clearSearch();
      }
    });

    searchClear.addEventListener('click', function() {
      searchInput.value = '';
      clearSearch();
    });

    function clearSearch() {
      searchBar.classList.remove('has-query');
      searchView.classList.add('hidden');
      defaultView.classList.remove('hidden');
      currentResults = [];
      vscode.postMessage({ type: 'clearSearch' });
    }

    // Filter chips
    document.querySelectorAll('.chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('chip-active'); });
        chip.classList.add('chip-active');
        activeFilter = chip.dataset.filter;
        renderResults();
      });
    });

    function highlightMatch(text, query) {
      if (!query) { return escapeHtml(text); }
      var escaped = escapeHtml(text);
      var q = query.toLowerCase();
      var lower = text.toLowerCase();
      var idx = lower.indexOf(q);
      if (idx === -1) { return escaped; }
      var before = escapeHtml(text.slice(0, idx));
      var match = escapeHtml(text.slice(idx, idx + query.length));
      var after = escapeHtml(text.slice(idx + query.length));
      return before + '<mark>' + match + '</mark>' + after;
    }

    function renderResults() {
      var query = searchInput.value.trim();
      var filtered = activeFilter === 'all'
        ? currentResults
        : currentResults.filter(function(r) { return r.category === activeFilter; });

      if (filtered.length === 0) {
        searchResults.innerHTML = '<div class="search-empty">' + (query ? 'No results found' : 'Type to search...') + '</div>';
        return;
      }

      var grouped = {};
      for (var i = 0; i < filtered.length; i++) {
        var r = filtered[i];
        if (!grouped[r.category]) { grouped[r.category] = []; }
        grouped[r.category].push(r);
      }

      var html = '';
      var categories = Object.keys(grouped);
      for (var c = 0; c < categories.length; c++) {
        var cat = categories[c];
        var items = grouped[cat];
        html += '<div class="result-category">' + escapeHtml(cat) + '</div>';
        for (var j = 0; j < items.length; j++) {
          var item = items[j];
          html += '<div class="result-item" data-category="' + escapeHtml(item.category)
            + '" data-id="' + escapeHtml(item.id) + '">'
            + '<span class="result-icon">' + escapeHtml(item.icon) + '</span>'
            + '<span class="result-name">' + highlightMatch(item.name, query) + '</span>'
            + '<span class="result-desc">' + highlightMatch(item.description, query) + '</span>'
            + '</div>';
        }
      }
      searchResults.innerHTML = html;

      searchResults.querySelectorAll('.result-item').forEach(function(el) {
        el.addEventListener('click', function() {
          vscode.postMessage({
            type: 'openItem',
            category: el.dataset.category,
            id: el.dataset.id,
          });
        });
      });
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }

    // Marketplace buttons
    document.getElementById('marketplaceBrowseBtn').addEventListener('click', function() {
      vscode.postMessage({ type: 'marketplaceBrowse' });
    });
    document.getElementById('marketplaceSyncBtn').addEventListener('click', function() {
      vscode.postMessage({ type: 'marketplaceSync' });
    });

    // Handle messages from extension
    window.addEventListener('message', function(event) {
      var msg = event.data;
      switch (msg.type) {
        case 'updateCounts':
          document.getElementById('skillsCount').textContent = msg.skills != null ? String(msg.skills) : '';
          document.getElementById('connectorsCount').textContent = msg.connectors != null ? String(msg.connectors) : '';
          document.getElementById('guidesCount').textContent = msg.guides != null ? String(msg.guides) : '';
          break;
        case 'updateStatus':
          var dot = document.getElementById('rooStatusDot');
          var label = document.getElementById('rooStatusLabel');
          if (msg.rooConnected) {
            dot.className = 'status-dot green';
            label.textContent = 'Roo Code: connected';
          } else {
            dot.className = 'status-dot muted';
            label.textContent = 'Roo Code: not detected';
          }
          break;
        case 'searchResults':
          currentResults = msg.results || [];
          renderResults();
          break;
        case 'ftueProgress':
          if (msg.total > 0 && msg.completed < msg.total) {
            quickStart.style.display = '';
            var pct = Math.round((msg.completed / msg.total) * 100);
            ftueProgressEl.style.width = pct + '%';
            ftueLabel.textContent = msg.completed + ' of ' + msg.total + ' steps complete';
          } else {
            quickStart.style.display = 'none';
          }
          break;
        case 'setSearch':
          searchInput.value = msg.query || '';
          if (msg.query) {
            searchInput.dispatchEvent(new Event('input'));
          }
          break;
        case 'updateMarketplace':
          var mpCount = document.getElementById('marketplaceCount');
          var mpUpdated = document.getElementById('marketplaceLastUpdated');
          var total = (msg.skillCount || 0) + (msg.connectorCount || 0);
          mpCount.textContent = total > 0 ? String(total) : '';
          if (msg.lastUpdated) {
            var d = new Date(msg.lastUpdated);
            mpUpdated.textContent = 'Updated ' + d.toLocaleDateString();
          } else if (!msg.available) {
            mpUpdated.textContent = 'Not synced yet';
          }
          break;
      }
    });

    // Signal to the extension that webview JS is ready to receive messages
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

