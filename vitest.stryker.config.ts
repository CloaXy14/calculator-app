import { defineConfig } from 'vitest/config';

// Mutation testing runs the fast logic tests only; the UI tests exercise the same code paths
// through React and take most of the run time.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', 'src/components/**'],
  },
});
