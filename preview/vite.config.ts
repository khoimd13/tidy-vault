import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

/** Dev-only UI preview with fake Chrome APIs: `npm run preview:ui`. */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [preact()],
  server: { port: 5199, strictPort: true },
});
