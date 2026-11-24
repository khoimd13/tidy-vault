# Vault Tidy

A Chrome extension that **suggests** clutter in your Google Photos library (old screenshots
first; shopping ads, memes and receipts once the AI model lands). You review the suggestions,
and you decide. **It never deletes or changes anything in Google Photos.**

- Runs entirely on your computer. No servers, no analytics.
- Only reads what photos.google.com shows in your own browser tab.
- Everything is reversible: Keep, Add to cleanup list and Remove all have Undo.

> Status: **v0.1, first working slice.** The scan, the screenshot heuristic, review and cleanup
> list work end to end. The CLIP image model, learning from your choices and the face protection
> are next (see [docs/UX_AND_AI_PLAN.md](docs/UX_AND_AI_PLAN.md)).

## Install (developer mode)

```powershell
npm install
npm run build
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `dist` folder.
3. Open <https://photos.google.com>. If it was already open, reload it.
4. Click the Vault Tidy icon to open the side panel.

## Using it

1. **Find suggestions** scrolls through whatever Google Photos is showing (your library, a
   search such as `screenshots`, or an album) and lists photos that look like clutter.
2. **Review** a group. "Likely clutter" starts selected; untick anything you want to keep.
   "Not sure" photos are only added if you tap them.
3. **Cleanup list** holds what you confirmed. Copy the links or export a CSV, then remove the
   photos yourself in Google Photos (the list has a short guide).

## Development

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Extension dev build with hot reload (load `dist` unpacked)     |
| `npm run preview:ui` | Side panel in a normal tab with fake photos, at localhost:5199 |
| `npm run build`      | Type-check and production build into `dist`                    |
| `npm run check`      | Type-check, lint, format check and unit tests (same as CI)     |
| `npm run coverage`   | Unit tests with a coverage report                              |

UI preview options: `?welcome=no` skips the welcome screen, `?photos=no` simulates a tab that
is not Google Photos.

## Architecture

```
src/
  shared/       Types, message contracts, built-in categories     (pure)
  source/       googlePhotosDom.ts: the ONLY code that knows the Google Photos page
  scan/         Scanner: gentle scrolling, de-duplication, pause/resume/cancel   (pure)
  ml/           Signals and classifiers (heuristic now, CLIP next)              (pure)
  suggest/      Suggestions, grouping, cleanup list, CSV export                (pure)
  store/        IndexedDB persistence (extension origin only)
  content/      Content script: wires source + scan, talks to the panel
  background/   Service worker: opens the side panel from the toolbar icon
  ui/           Side panel (Preact): screens, components, useVault state hook
preview/        Dev-only harness with fake chrome APIs (never shipped)
tests/          Vitest unit tests, mirroring src/
docs/           Build prompt and the UX + AI plan
```

Data flow: **content script** reads tiles → messages → **side panel** stores them →
**classifier** scores → **suggestions** are grouped → you decide → decisions are stored.

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
  (fake-indexeddb).
- **Git hooks** (husky): `pre-commit` runs lint-staged; `pre-push` only allows pushing to the
  personal remote `git@github-personal:…` and runs `npm run check`.
- **GitHub Actions** runs `npm run check` and `npm run build` on every push and pull request.

## Privacy

Vault Tidy asks only for `sidePanel`, `storage` and access to `photos.google.com`. Scanned items
(id, link, date, thumbnail link, shape) and your decisions are stored in the extension's own
IndexedDB on this computer. **Clear local data** on the home screen wipes them.

## Known limits (v0.1)

- Page selectors and English date parsing in `googlePhotosDom.ts` are best-effort and still need
  checking against the live site. Non-English Google Photos shows no dates yet.
- Only the **Screenshots** category is scored (by screen shape and age). Other categories need
  the image model.
- Opening a suggested photo works through its link; there is no bulk action in Google Photos yet
  (the v1.5 "to remove" album is planned, see the docs).
