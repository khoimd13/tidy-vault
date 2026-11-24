# Build prompt: "Vault Tidy" — a suggestion-only cleanup assistant for Google Photos (Chrome extension)

## 1. Goal

Build a Chrome extension (Manifest V3) that helps a person find clutter in their own Google Photos library (photos.google.com). Examples of clutter: old screenshots, photos of product ads, shopping pages, memes, receipts. The extension **suggests** what could go and explains why. **It never deletes, archives or changes anything.** The person stays in control and does any cleanup themselves in Google Photos.

## 2. Hard rules (do not break these)

1. **Read-only.** Version 1 makes no changes to the Google Photos library at all: no delete, no archive, no album changes, no edits.
2. **Local only.** Every photo is analysed on the person's own computer. No photo, thumbnail, embedding or metadata leaves the browser. No analytics, no telemetry, and no outside server, except the one-time download of the AI model files.
3. **Only runs on `https://photos.google.com/*`.** Ask for the fewest permissions possible: `sidePanel`, `storage`, `scripting`, `offscreen`, and host access to photos.google.com plus `*.googleusercontent.com` (where the thumbnails are served from; used only to fetch them, never to upload). See `UX_AND_AI_PLAN.md` for the full user journey and AI design.
4. **Be gentle on the page.** Scan at a human-like pace, with throttled scrolling and small batches, so Google sees nothing unusual.
5. **Keep page access in one module.** Everything that reads the Google Photos page (finding thumbnails, dates, photo links) goes in a single module, `src/source/googlePhotosDom.ts`, behind a small interface. When Google changes its website, only that file needs fixing.

## 3. How it works

### 3.1 Scanning

- The person opens photos.google.com and opens the Vault Tidy side panel.
- They choose a scope: _Whole library_, _A date range_, or _The current view_. The current view means whatever is on screen right now, such as a search result or an album.
- A content script scrolls the photo grid slowly. For each photo it collects:
  - the thumbnail image URL, asked for at about 224 px
  - the photo's own page link (`/photo/<id>`)
  - the date, from the tile's label or the date header above it
  - the width/height ratio
  - photo or video
- The scan can be paused, resumed and cancelled, and shows progress ("Scanned 4,210 of ~12,000"). A scan that is stopped part-way can carry on later from where it left off.
- Results are cached in IndexedDB, so a re-scan only analyses photos it hasn't seen before.

### 3.2 Classification

- Use **CLIP**, an image–text matching model, in its zero-shot mode, with **transformers.js** (`Xenova/clip-vit-base-patch32`, quantized). Run it in an offscreen document or Web Worker so the page stays responsive. Use WebGPU when the computer supports it, otherwise WASM.
- **Each category** has:
  - a name and an icon
  - 3–6 text descriptions for the model to match against, e.g. "a screenshot of an online shopping website", "a photo of a product advertisement"
  - optionally, 1–10 example photos the person picked
  - a confidence threshold
- **Built-in starter categories**, each of which the person can turn off: Screenshots · Shopping & product ads · Memes & forwarded images · Receipts & documents · Whiteboards & notes · Near-duplicate photos (photos taken within 10 seconds of each other that look almost the same).
- **Custom categories:** the person types a plain description, e.g. "ads for sneakers I wanted to buy". The extension turns it into several text descriptions to match against, and the person can edit them.
- **Extra signals to add to the score:**
  - a screenshot-shaped width/height ratio, such as 9:19.5 or 9:16 portrait
  - "Screenshot" in the file name, if the page shows it
  - how old the photo is (an older screenshot is a stronger suggestion)
- **Each photo gets:** its best category, a confidence score from 0 to 1, a confidence level (High ≥ 0.80 / Medium 0.60–0.79 / Low < 0.60, which the person can adjust), and a short reason, e.g. "Looks like a shopping page · screenshot shape · from 2021".
- **Never suggest:** photos with clear faces or people in them, or anything in a favorite or shared album, unless the person turns this protection off. Default to protecting memories.

### 3.3 Suggestions

- Group the results into **suggestion cards**, one per category. Each card shows:
  - the title and count: "312 shopping screenshots"
  - the date span: "mostly Mar 2021 – Aug 2023"
  - a strip of 6 sample thumbnails
  - how many are high, medium and low confidence
  - why they were flagged, in one line
- **Card order:** by count × average confidence, then by age (oldest first).
- Opening a card shows its **review grid** (see section 4).
- **What the person can do with a photo or a selection** (all of it stored inside the extension only):
  - **Looks right ✓** — confirms the suggestion and adds it to the _Cleanup list_
  - **Keep ♡** — never suggest this photo again
  - **Wrong category** — moves it, or tells the model it was wrong
  - **Open in Google Photos ↗** — opens the photo's page in a new tab
- **Cleanup list:** everything the person has confirmed, grouped by category. Buttons:
  - _Open next 50 in Google Photos_
  - _Copy links_
  - _Export CSV/JSON_ (id, link, date, category, confidence, reason)
  - Help text that explains how to search and select those photos in Google Photos to delete or archive them by hand.
- **Learning:** store the CLIP embeddings (the model's numeric fingerprint of each image) for photos the person confirmed or kept. When scoring new photos, give a boost or penalty based on how close they are to those examples, and adjust each category's threshold a little from the feedback. Show this: "Suggestions improved using your 48 decisions."
- **Summary bar:** "1,284 suggestions across 5 categories · 312 confirmed · 97 kept". Don't show estimated storage savings in v1: file sizes can't be read reliably from the page.

## 4. Appearance

### 4.1 Overall feel

Calm, tidy and trustworthy, like a helpful assistant, not a "cleaner" app full of alarms. No red, no warning icons, no countdowns or pressure. Nothing is deleted, so the interface shouldn't feel dangerous.

### 4.2 Where it lives

- A **Chrome side panel** (`chrome.sidePanel`) that opens next to photos.google.com, about 360–420 px wide.
- A full-tab **Review page** (`review.html`) for comfortable reviewing on a large screen. The side panel links to it with "Open large review".

### 4.3 Visual style

- Follow the system light/dark setting. Light: background `#FAFAF9`, cards `#FFFFFF`, text `#1C1C1A`, muted text `#6B6B66`. Dark: background `#141413`, cards `#1F1F1D`, text `#ECECEA`.
- **One accent colour**, a calm teal (`#2F7D74`; in dark mode `#5FB3A8`), used only for main buttons, selection rings and progress.
- **Confidence chips:** High = solid accent, Medium = accent outline, Low = grey outline. Each chip also says "High", "Medium" or "Low" in words, so colour isn't the only signal.
- System font (`system-ui`). Sizes: 13 px body, 15 px card titles, 20 px screen titles. Medium weight for headings, never heavy bold.
- 12 px corner radius on cards and 8 px on thumbnails. Soft single shadows, or a 1 px border in dark mode.
- Spacing on an 8 px grid. Generous white space, with at most 3–4 cards visible before scrolling.
- Icons: a simple line set (e.g. Lucide).
- Motion: short (150–200 ms) fades and slides only. Respect `prefers-reduced-motion`.

### 4.4 Screens

1. **Welcome** (first run): one short paragraph — "Vault Tidy looks through your Google Photos on this computer and suggests photos you might not need. It never deletes anything." — plus three bullet promises (Private · Suggestions only · You decide) and a **Start a scan** button. The model download size is shown before it starts.
2. **Scan:** a scope picker, the categories to look for (toggle chips plus "+ Add your own"), a Start button, then a progress view: a progress bar, a running count, a live mini-grid of the latest thumbnails analysed, and Pause / Cancel.
3. **Suggestions (home):** the summary bar at the top, then the suggestion cards (section 3.3). Each card has a **Review** button. Empty state: "Nothing obvious to tidy here. Nice library."
4. **Review grid:**
   - The side panel shows 3 columns of square thumbnails; the large review page shows 6–8.
   - Each tile has a confidence chip in one corner and a small reason when you hover or focus it.
   - Toolbar: a filter by confidence (High / Medium / Low), sort (Oldest · Most confident), _Select all High_, and the actions _Looks right ✓_, _Keep ♡_, _Wrong category_.
   - Clicking a tile opens a large preview with its date, reason, score and "Open in Google Photos ↗".
   - **Keyboard:** arrow keys move between photos, `Y` = Looks right, `K` = Keep, `O` = Open, `Space` = select.
5. **Cleanup list:** confirmed items grouped by category, with the export and open buttons and a short "How to remove these in Google Photos" guide that can be expanded.
6. **Categories:** a list of categories with toggles. Editing a category lets the person change its name, its text descriptions, a threshold slider with a live preview of how many photos would match, and "Add example photos".
7. **Settings:**
   - Protect people & favorites (on by default)
   - Scan speed (Gentle / Normal)
   - Model (Standard / Faster-smaller)
   - Clear all Vault Tidy data
   - Privacy statement

### 4.5 Accessibility

Everything works by keyboard. Focus rings are always visible. Contrast meets WCAG AA. Thumbnails have alt text from their date and category. The panel still works at 200% zoom.

## 5. Technology and project layout

- TypeScript, Vite with `@crxjs/vite-plugin`, Preact or React, and plain CSS variables for the colours and sizes above (no heavy UI kit).
- Folders:
  - `src/source/` — page reading (the single module that knows about the Google Photos page)
  - `src/scan/` — scan scheduling, pause/resume, caching
  - `src/ml/` — CLIP loading, embeddings, scoring, the extra signals, learning from feedback
  - `src/suggest/` — grouping, ordering, reasons
  - `src/ui/` — the side panel, review page and shared components
  - `src/store/` — IndexedDB storage (using `idb`)
- Unit tests (Vitest) for scoring, grouping, the threshold and feedback logic, and the near-duplicate grouping. Use a few fixture images plus fake embeddings.
- `README.md` covering: how to install with "Load unpacked", how to run the dev build, the privacy summary, known limits, and what to do when Google changes its website.

## 6. Not in version 1

Deleting, archiving or moving photos; album changes; cloud sync; accounts; a phone app; anything sent to a server.

## 7. Done when

- [ ] It installs with "Load unpacked" and opens its side panel only on photos.google.com.
- [ ] It scans at least 5,000 photos with pause/resume, and doesn't freeze the page.
- [ ] Screenshots are found with ≥ 90% precision at High confidence on a sample the person checks by hand.
- [ ] A custom category typed in plain words produces sensible suggestions without any code changes.
- [ ] Keep / Looks right decisions persist and affect the next scan.
- [ ] The export includes working links that open each photo in Google Photos.
- [ ] The network log shows no requests except to photos.google.com and the one-time model download.
- [ ] Nothing in the Google Photos library has been changed.
