import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

const publicDir = join(import.meta.dirname, '..', 'public');

/**
 * Vite's dev server refuses `import()` of files in the public folder, which is exactly how ONNX
 * Runtime loads its glue code. Serve /ort/* untouched, like the packaged extension does.
 */
function serveOrtRaw(): Plugin {
  return {
    name: 'serve-ort-raw',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        if (!/^\/ort\/[\w.-]+\.(mjs|wasm)$/.test(path)) return next();
        readFile(join(publicDir, path))
          .then((body) => {
            res.setHeader(
              'Content-Type',
              path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
            );
            res.end(body);
          })
          .catch(() => next());
      });
    },
  };
}

/** Dev-only UI preview with fake Chrome APIs: `npm run preview:ui`. */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [serveOrtRaw(), preact()],
  server: { port: 5199, strictPort: true },
  // Serve the bundled model and runtime files like the extension does.
  publicDir,
  worker: { format: 'es' },
});
