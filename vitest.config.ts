import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      include: ['src/**'],
      exclude: ['src/ui/**', 'src/background/**', 'src/content/**'],
    },
  },
});
