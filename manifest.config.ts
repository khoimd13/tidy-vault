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
  // Keep this list minimal. Add `offscreen` and *.googleusercontent.com when the CLIP model lands.
  permissions: ['sidePanel', 'storage'],
  host_permissions: ['https://photos.google.com/*'],
});
