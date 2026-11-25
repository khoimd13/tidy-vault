import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  // Store name and summary come from public/_locales/<lang>/messages.json (one per UI language),
  // so the Chrome Web Store shows them in the visitor's language. Limits: 75 and 132 characters.
  name: '__MSG_extName__',
  short_name: 'Vault Tidy',
  description: '__MSG_extDescription__',
  default_locale: 'en',
  version: pkg.version,
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_title: 'Open Vault Tidy',
    default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' },
  },
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
  // scripting: re-inject the page script into a Google Photos tab that was open before a reload.
  // alarms: the optional monthly reminder badge (off by default; see background).
  permissions: ['sidePanel', 'storage', 'scripting', 'alarms'],
  host_permissions: ['https://photos.google.com/*'],
  // The AI runtime is WebAssembly bundled with the extension; nothing remote is ever executed.
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
  },
});
