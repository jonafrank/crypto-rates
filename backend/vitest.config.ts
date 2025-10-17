import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    reporters: 'default',
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});
