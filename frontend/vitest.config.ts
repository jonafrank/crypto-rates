import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.tsx', 'src/**/*.spec.ts'],
    reporters: 'default',
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});
