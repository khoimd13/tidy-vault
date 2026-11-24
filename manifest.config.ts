import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Vault Tidy',
  version: pkg.version,
  description: pkg.description,
  action: { default_title: 'Open Vault Tidy' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/ui/sidepanel/index.html' },
  content_scripts: [
    {
      matches: ['https://photos.google.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  // Keep this list minimal. Thumbnails are downloaded by the content script inside the Google
  // Photos tab (they need the Google session), so no image-server permission is needed.
  permissions: ['sidePanel', 'storage'],
  host_permissions: ['https://photos.google.com/*'],
  // The AI runtime is WebAssembly bundled with the extension; nothing remote is ever executed.
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
  },
});
