import { defineConfig } from 'vitest/config';

/** Opt-in real-model checks: `npm run test:model` (needs `npm run model:fetch`). */
export default defineConfig({
  test: { include: ['tests-model/**/*.test.ts'], environment: 'node' },
});
