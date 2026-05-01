import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['test/integration/**', 'test/ui/**', 'out/**', 'node_modules/**'],
    alias: {
      vscode: new URL('./test/__mocks__/vscode.ts', import.meta.url).pathname,
    },
  },
});
