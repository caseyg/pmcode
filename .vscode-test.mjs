import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
  {
    label: 'integration',
    files: 'out/test/integration/**/*.test.js',
    workspaceFolder: './test/fixtures',
    launchArgs: ['--disable-extensions'],
    mocha: {
      ui: 'tdd',
      timeout: 20000,
    },
  },
]);
