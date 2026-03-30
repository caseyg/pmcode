// Minimal vscode module mock for vitest
import { vi } from 'vitest';

export const workspace = {
  getConfiguration: () => ({
    get: () => undefined,
    update: async () => {},
    has: () => false,
    inspect: () => undefined,
  }),
  workspaceFolders: [],
  onDidChangeConfiguration: () => ({ dispose: () => {} }),
};

function createMockWebviewPanel() {
  let _onDidReceiveMessageCb: ((msg: any) => void) | undefined;
  let _onDidDisposeCb: (() => void) | undefined;
  let _disposed = false;

  const panel: any = {
    webview: {
      html: '',
      options: {},
      onDidReceiveMessage: (cb: (msg: any) => void) => {
        _onDidReceiveMessageCb = cb;
        return { dispose: () => {} };
      },
      postMessage: vi.fn(async () => true),
      asWebviewUri: (uri: any) => uri,
      cspSource: 'https://mock.csp',
    },
    onDidDispose: (cb: () => void) => {
      _onDidDisposeCb = cb;
      return { dispose: () => {} };
    },
    onDidChangeViewState: () => ({ dispose: () => {} }),
    reveal: vi.fn(),
    dispose: vi.fn(() => {
      if (!_disposed) {
        _disposed = true;
        _onDidDisposeCb?.();
      }
    }),
    visible: true,
    active: true,
    viewColumn: 1,
    // test helpers
    _simulateMessage: (msg: any) => _onDidReceiveMessageCb?.(msg),
    _triggerDispose: () => {
      if (!_disposed) {
        _disposed = true;
        _onDidDisposeCb?.();
      }
    },
  };

  return panel;
}

export const window = {
  showInformationMessage: vi.fn(async () => undefined),
  showWarningMessage: vi.fn(async () => undefined),
  showErrorMessage: vi.fn(async () => undefined),
  showInputBox: vi.fn(async () => undefined),
  showQuickPick: vi.fn(async () => undefined),
  createOutputChannel: () => ({
    appendLine: () => {},
    append: () => {},
    clear: () => {},
    show: () => {},
    dispose: () => {},
  }),
  createWebviewPanel: vi.fn((_viewType: string, _title: string, _column: any, _options?: any) => {
    return createMockWebviewPanel();
  }),
  registerWebviewViewProvider: vi.fn((_viewType: string, _provider: any) => {
    return { dispose: () => {} };
  }),
};

export const commands = {
  registerCommand: vi.fn((_id: string, _cb: (...args: any[]) => any) => {
    return { dispose: () => {} };
  }),
  executeCommand: vi.fn(async () => undefined),
};

export const Uri = {
  file: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
  parse: (str: string) => ({ fsPath: str, scheme: 'file', path: str }),
  joinPath: (base: any, ...segments: string[]) => {
    const joined = [base.path || base.fsPath, ...segments].join('/');
    return { fsPath: joined, scheme: 'file', path: joined };
  },
};

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export const EventEmitter = class {
  event = () => ({ dispose: () => {} });
  fire() {}
  dispose() {}
};

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export const env = {
  clipboard: {
    readText: vi.fn(() => Promise.resolve('')),
    writeText: vi.fn(() => Promise.resolve()),
  },
  language: 'en',
  machineId: 'test-machine-id',
  uriScheme: 'vscode',
};

export const extensions = {
  getExtension: vi.fn(),
  all: [],
  onDidChange: vi.fn(() => ({ dispose: () => {} })),
};

// Helper for tests to create a mock ExtensionContext
export function _createMockContext(overrides: Record<string, any> = {}): any {
  const storage = new Map<string, unknown>();
  return {
    subscriptions: [],
    extensionUri: Uri.file('/mock/extension'),
    extensionPath: '/mock/extension',
    globalState: {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        return storage.has(key) ? storage.get(key) : defaultValue;
      }),
      update: vi.fn((key: string, value: unknown) => {
        storage.set(key, value);
        return Promise.resolve();
      }),
      keys: vi.fn(() => [...storage.keys()]),
    },
    workspaceState: {
      get: vi.fn(() => undefined),
      update: vi.fn(async () => {}),
      keys: () => [],
    },
    globalStorageUri: Uri.file('/mock/globalStorage'),
    logUri: Uri.file('/mock/logs'),
    storagePath: '/mock/storage',
    globalStoragePath: '/mock/globalStorage',
    asAbsolutePath: (p: string) => `/mock/extension/${p}`,
    ...overrides,
  };
}
