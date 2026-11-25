# Vault Tidy

A Chrome extension that **suggests** clutter in your Google Photos library: screenshots,
shopping pages and product ads, memes, receipts and documents, whiteboards and notes, blurry,
dark or empty photos, accidental shots, near-duplicate bursts, and videos (short or accidental
clips, screen recordings, and long videos). An AI
model running on your own computer looks at each photo. You review the suggestions and decide.
**It never deletes anything.** The one optional write is the beta "to remove" album: one new
private album with the photos you confirmed, so you can delete them from Google Photos in a few
clicks.

- Runs entirely on your computer: the AI model ships inside the extension. No servers, no
  analytics, nothing uploaded.
- Only reads what photos.google.com shows in your own browser tab.
- Everything is reversible: Keep, Add to cleanup list and Remove all have Undo.

> Status: **v0.2.** Scan, on-device CLIP classification of five categories, review and cleanup
> list work end to end. Learning from your choices and face protection are next (see
> [docs/UX_AND_AI_PLAN.md](docs/UX_AND_AI_PLAN.md)).

## Install (developer mode)

```powershell
npm install
npm run model:fetch
npm run build
```

`model:fetch` downloads the CLIP model once (about 150 MB, from Hugging Face) into
`public/models`. It is bundled into the extension; without it Vault Tidy still works but only
recognises screenshots by their shape.

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `dist` folder.
3. Open <https://photos.google.com>. If it was already open, reload it.
4. Click the Vault Tidy icon to open the side panel.

## Using it

1. **Find suggestions** scrolls through whatever Google Photos is showing (your library, a
   search such as `screenshots`, or an album). The AI then looks at each photo; suggestions
   appear as it goes.
2. **Review** a group. "Likely clutter" starts selected; untick anything you want to keep.
   "Not sure" photos are only added if you tap them. Shortcuts: Y add, K keep, A all, Esc back.
3. **Cleanup list** holds what you confirmed. Copy the links or export a CSV, then remove the
   photos yourself in Google Photos (the list has a short guide).

## How the AI works

- **Model:** CLIP ViT-B/32 (`Xenova/clip-vit-base-patch32`, 8-bit), run with transformers.js and
  ONNX Runtime in a Web Worker. Uses WebGPU when available, otherwise WebAssembly.
- **Zero-shot:** each category is described by several sentences ("a screenshot of an online
  shopping website", …), averaged. Everyday photo types ("a selfie", "a landscape photo", …)
  compete with them, so a photo is only flagged when it looks more like clutter than a memory.
- **Confidence** is the total probability that a photo is clutter of any kind; the category is
  the best-matching one, and its closest sentence is shown as the reason. A phone-screen shape
  and age nudge confidence up.
- **Image quality:** sharpness (variance of the Laplacian), brightness and contrast are measured
  on each 224 px thumbnail. Clearly blurry, dark or empty images go to their own group; a
  photo the AI sees as a memory but that measures very poor is only offered as "not sure".
  Calibrated on real photos and blurred/darkened copies (`tests-model/quality.smoke.test.ts`).
- **Near-duplicates:** photos taken within 10 minutes whose image vectors are at least 0.92
  similar form a group; the sharpest is kept and the rest are suggested. Calibrated on
  burst-like copies (`tests-model/duplicates.smoke.test.ts`: 99% caught).
- **Videos:** judged by length (read from the duration on the tile) and their cover frame:
  clips of 3 s or less are likely accidental, screen-like cover frames mean screen recordings,
  and videos of 2 min or more are listed at Low only (often precious).
- **Space you could free:** exact where possible. The page script reads each photo's real file
  size and how much it counts against your Google storage, read-only, with the call the Google
  Photos web app uses for its Info panel (`EWgK9e`). Items stored in the old free "high quality"
  mode count as 0. Photos without a real number fall back to typical sizes (about 2.5 MB per
  camera photo, 0.5 MB per screenshot, 1.5 MB per second of video) and the total shows "≈".
  The headline only counts High/Medium suggestions.
- **Learning from you:** photos nearly identical to ones you kept stop being suggested, similar
  ones lose confidence, photos like ones you added gain a little, and a category whose
  suggestions you mostly reject becomes more cautious.
- **Caching:** image and text vectors are stored locally, so photos are analysed once and saved
  results show instantly next time.
- **Measured** on 24 real screenshots and 26 real photos (`npm run test:model`): all screenshots
  rated High, no photo rated High.

## Development

| Command               | What it does                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | Extension dev build with hot reload (load `dist` unpacked)       |
| `npm run preview:ui`  | Side panel in a normal tab with fake data, at localhost:5199     |
| `npm run build`       | Type-check and production build into `dist`                      |
| `npm run check`       | Type-check, lint, format check and unit tests (same as CI)       |
| `npm run model:fetch` | Download the CLIP model into `public/models` (once)              |
| `npm run test:model`  | Opt-in check of the real model on your own images (see the file) |
| `npm run coverage`    | Unit tests with a coverage report                                |

UI preview options: `?welcome=no` skips the welcome screen, `?photos=no` simulates a tab that
is not Google Photos, and `?samples` uses real images from `preview/samples/` (git-ignored; add
images plus an `index.json` listing their file names) so the real model runs in the preview.

## Architecture

```
src/
  shared/       Types, message contracts, categories and their AI prompts    (pure)
  source/       googlePhotosDom.ts: the ONLY code that knows the Google Photos page
  scan/         Scanner: gentle scrolling, de-duplication, pause/resume/cancel (pure)
  ml/           Signals, zero-shot maths, classifiers (pure) + clip/ Web Worker
  suggest/      Suggestions, grouping, cleanup list, CSV export              (pure)
  store/        IndexedDB persistence: items, decisions, embeddings
  content/      Content script: wires source + scan, talks to the panel
  background/   Service worker: opens the side panel from the toolbar icon
  ui/           Side panel (Preact): screens, components, useVault/useAnalysis hooks
scripts/        prepare-assets.mjs: bundles ONNX Runtime and (optionally) the model
preview/        Dev-only harness with fake chrome APIs (never shipped)
tests/          Vitest unit tests, mirroring src/
tests-model/    Opt-in tests against the real model
docs/           Build prompt and the UX + AI plan
```

Data flow: **content script** reads tiles → messages → **side panel** stores them →
**CLIP worker** embeds thumbnails → **classifier** scores → **suggestions** are grouped → you
decide → decisions are stored.

Two rules are enforced by ESLint so the structure stays easy to maintain:

1. `shared`, `scan`, `ml` and `suggest` may not use `chrome`, `document` or `window`. They stay
   pure and unit-testable.
2. Only `content` may import `source`. When Google changes its page, only
   `src/source/googlePhotosDom.ts` (and its test) should need fixing.

## Code quality

- **TypeScript strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **ESLint** with type-aware rules (typescript-eslint) plus the architecture rules above.
- **Prettier** for formatting, checked in CI.
- **Vitest** unit tests for all pure modules, the page reader (happy-dom) and storage
  (fake-indexeddb); an opt-in suite runs the real model.
- **Git hooks** (husky): `pre-commit` runs lint-staged; `pre-push` only allows pushing to the
  personal remote `git@github-personal:…` and runs `npm run check`.
- **GitHub Actions** runs `npm run check` and `npm run build` on every push and pull request
  (without the model download).

## Privacy and permissions

- `sidePanel`, `storage`.
- `photos.google.com`: to read the photo grid you are looking at.
- No image-server permission: Google's thumbnails only load with your Google session, so the
  part of Vault Tidy running inside the Google Photos tab downloads the small (224 px)
  thumbnails and hands them to the side panel. Nothing is uploaded anywhere.
- Content Security Policy allows WebAssembly (`wasm-unsafe-eval`) for the bundled AI runtime.
  No code or model is ever loaded from the internet at runtime.

Scanned items (id, link, date, thumbnail link, shape), small thumbnails (about 10 KB each), AI
vectors and your decisions are stored
in the extension's own IndexedDB on this computer. **Clear local data** wipes them.

## Known limits

- Page reading was checked on the live site (Vietnamese UI, Nov 2026). Dates are read from
  English and Vietnamese labels; other languages show no dates yet.
- The extension is about 230 MB because the model is bundled.
- The "to remove" album (beta) uses Google Photos' internal web calls (`OXvT9d` create album,
  `E1Cajb` add, `snAcKc` read back; documented by Google Photos Toolkit). It can break when
  Google changes its site; it then fails safely and the link list and CSV still work.
