# Vault Tidy — user journey and AI filter plan

Companion to `BUILD_PROMPT.md`. Part A is the UX design; Part B is how the AI filter works.

---

# Part A — User journey (UX)

## A1. What other apps do well, and where they fall short

| App                               | What to borrow                                                                                                                                                                                        | What to avoid                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Files by Google, Clean tab**    | One card per kind of clutter ("Delete memes", "Old screenshots"), each with a single clear button. Cards can be hidden for 7 days or for good.                                                        | Its junk cleanup deletes permanently. Ours stays reversible.                                                                                                       |
| **Gemini Photos (MacPaw)**        | Clutter (screenshots, notes, blurry) comes **preselected** and you untick what you want to keep. For similar shots it **suggests** a best shot and lets you **hide a set** so it isn't flagged again. | Reviewers found false positives: sky photos marked "blurry", the "best shot" with someone's eyes closed. **Always show why**, and never auto-select real memories. |
| **Slidebox and the swipe apps**   | One photo at a time and a gesture to decide, which makes decisions fast and almost fun. Swiped photos go to an **in-app trash first**, so nothing happens until you confirm.                          | Users said acting on many photos one by one is tedious. Swiping suits _uncertain_ photos, not hundreds of obvious ones.                                            |
| **Google Photos storage manager** | Groups like "Screenshots" and "Blurry", reachable in one tap.                                                                                                                                         | Fixed categories only, no "why", and no learning from what you choose.                                                                                             |

**Main design idea taken from all of these:** _confidence decides how you review._

- **High confidence** → a grid with everything **preselected**; you untick the keepers (Gemini style). This is fast for hundreds of photos.
- **Medium / Low confidence** → **swipe mode**, one photo at a time (Slidebox style). Careful where it matters.

## A2. Design principles

1. **Nothing is lost without your OK.** Every action can be undone. Version 1 never changes your library.
2. **Show why.** Every suggestion has a plain reason ("Shopping page · phone-screen shape · from 2021").
3. **One main button per screen.** Settings and options stay out of the way.
4. **Useful within 60 seconds.** Show the first suggestions while the scan is still running.
5. **Memories are protected by default.** Photos with people in them and favorites are never suggested unless you change that.
6. **Calm wording.** "You might not need these", not "Junk detected!".

## A3. The journey, step by step

### Step 0 · Install → first open (≈ 20 s)

- You install the extension and Chrome shows _"Pin Vault Tidy"_.
- You open photos.google.com and a small teal badge on the extension icon invites you to click it. The side panel opens on the **Welcome** screen:
  > **Tidy your Google Photos, safely.**
  > ✓ Runs on this computer · ✓ Only suggests · ✓ You decide
  > [ Get started ]
- If you open the panel on another website, it shows "Open Google Photos to start" with a button that opens it.

### Step 1 · "What would you like to tidy?" (≈ 15 s)

- Big tappable tiles, two of them preselected: **Screenshots ✓**, **Shopping and product ads ✓**, Memes and forwarded images, Receipts and documents, Whiteboards and notes, Near-duplicates.
- Below them, a text box: **"Or describe your own…"** with the example "ads for sneakers I wanted to buy". When you type, a preview chip appears so you can see your category was understood.
- The button says **Find suggestions**. It isn't called "Scan", which sounds technical.

### Step 2 · Quick teach — optional, recommended (≈ 30 s)

- _"Help Vault Tidy learn your taste — 10 quick photos."_
- One large photo at a time. You choose **Clutter →** or **← Keep**, by key or by click, and can **Skip**.
- The 10 photos are ones the model is **least sure about** (see B5), so these 30 seconds improve accuracy the most.
- There's a **Skip for now** link, so you're never forced through it.

### Step 3 · Finding suggestions (runs in the background)

- A progress line: "Looked at 2,140 photos · about 6 min left", with Pause.
- **After about 200 photos**, a card appears: _"First 40 suggestions are ready — start reviewing while I keep looking."_ So you never wait for the whole library.
- You can close the panel or keep browsing Google Photos. The scan continues while that tab stays open, and a badge number on the icon shows new suggestions.

### Step 4 · Suggestions home (cards)

Files by Google style: one card per category, in this order: most clutter first, then oldest.

```
┌──────────────────────────────────────────┐
│ 🛍  312 shopping screenshots              │
│     Mostly Mar 2021 – Aug 2023            │
│     ▢▢▢▢▢▢  (6 samples)                   │
│     Store pages, product listings          │
│     [ Review ]                     ···     │  ··· = Hide for 7 days / Never suggest this
└──────────────────────────────────────────┘
```

- A summary at the top: "1,284 to review · 312 on your cleanup list".
- When everything is done: _"All caught up. I'll show new suggestions next time you visit."_

### Step 5 · Review (two modes, picked for you, and you can switch)

**5a. Grid mode** — for High-confidence photos

- All the photos are **preselected** (teal ring).
- Tap a photo to untick it and keep it. Hover over a photo to see its reason.
- One main button: **Add 241 to cleanup list**.
- Then a toast: _"241 added · Undo"_.

**5b. Swipe mode** — for the "Not sure" pile (Medium/Low)

- A large photo with its reason and its date.
- Controls:
  - **→ / Y** Clutter
  - **← / K** Keep
  - **↓ / S** Skip
  - **O** open in Google Photos
- A progress bar reads "12 of 58".
- **Z** undoes the last choice.
- Once a group has been reviewed, a single line says _"Thanks — suggestions are learning from your choices."_

### Step 6 · Cleanup list (the staging area, like Slidebox's in-app trash)

- Everything you confirmed, grouped by category. Each item can be removed from the list.
- Sending photos here **changes nothing in Google Photos**. This is the deliberate "nothing has happened yet" moment.

### Step 7 · Hand-off to Google Photos ⚠️ (the weakest step in v1)

Because v1 can't change your library, you still finish the cleanup in Google Photos yourself. To make that bearable:

- **Open as a list:** opens a Vault Tidy page with large thumbnails. Each one links to the photo, in batches of 50.
- **Export CSV/JSON** for power users.
- **A short 3-step guide** to deleting in Google Photos (select with Shift+click, then the trash icon).

**Recommended for v1.5 (needs your decision):** add one reversible write, **"Put these in an album called 'Vault Tidy — to remove'"**, after an explicit confirmation. Then you open that album in Google Photos, select all, and move them to trash in seconds. This takes the hand-off from minutes to about 10 seconds, and it's still safe: removing the album later doesn't delete any photos.

### Step 8 · Coming back

- A badge on the icon: "37 new suggestions since your last visit". Only new photos are scanned.
- An occasional, low-key stat: "You've reviewed 1,650 photos — about 25 minutes saved."

## A4. Small details that make it feel polished

- **Undo** after every batch action, in a toast for 8 seconds and in the history.
- **Full keyboard use** with the same keys in every mode, and a `?` key that shows them.
- **Wording:** "Keep" and "Clutter", never "Delete" in v1, because nothing is deleted.
- **Empty and error states:**
  - Google changed its page → "Google Photos changed its layout. Vault Tidy needs an update."
  - Model download failed → "Couldn't download the AI model. Retry."
- **Speed:** thumbnails show as gentle placeholders while loading. No spinners in the middle of the grid.

---

# Part B — AI filter plan (implementation)

## B1. Pipeline overview

```
Google Photos page ──(content script)──▶ photo list: id, link, date, thumbnail URL, width/height
        │
        ▼
Thumbnail fetcher (224 px, throttled) ──▶ image bitmap
        │
        ▼
Image encoder (CLIP-family, ONNX, WebGPU → WASM fallback)  ──▶ 512-number embedding
        │                                                         │
        │                                     cached in IndexedDB ┘ (never recomputed)
        ▼
Scorer per category = zero-shot text match + extra signals + your feedback
        │
        ▼
Protection filter (faces / people / favorites) ──▶ suggestions with confidence + reason
```

All of this runs in an **offscreen document** owned by the extension, so the Google Photos tab stays responsive.

## B2. Model choice

| Option                                             | Size (quantized)         | Notes                                                                                                |
| -------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **CLIP ViT-B/32** (`Xenova/clip-vit-base-patch32`) | ≈ 90 MB for image + text | **Start here.** Proven in transformers.js and good at zero-shot "screenshot / shopping page / meme". |
| MobileCLIP-S0/S1 (Apple)                           | ≈ 50–100 MB              | Faster with similar or better accuracy. Try it if an ONNX build works in transformers.js.            |
| SigLIP base                                        | ≈ 200 MB                 | Better zero-shot accuracy but bigger and slower. Keep as a "High accuracy" setting.                  |

- **Bundle the model inside the extension** rather than downloading it. That means no outside network requests at all, which supports the privacy promise. Chrome Web Store allows packages this size.
- **Expected speed** on a normal laptop:
  - WebGPU: ≈ 30–60 photos/s
  - WASM: ≈ 4–10 photos/s

  In practice, the gentle page scrolling will be slower than the model, so the model isn't the bottleneck.

## B3. Zero-shot scoring (works on day one, with no training)

1. **Text descriptions for each category, several per category** (averaging them improves accuracy). For example, Shopping:
   - "a screenshot of an online shopping website"
   - "a product listing with a price and an add-to-cart button"
   - "an advertisement for a product"
   - "a screenshot of a social media ad"
2. **Background categories** that are never suggested, so the scores mean something relative:
   - "a photo of people"
   - "a selfie"
   - "a family photo"
   - "a landscape photo"
   - "a photo of a pet"
   - "a photo of food at a restaurant"
   - "a travel photo"
   - "a photo of a building"

   A photo only counts as "Shopping" if it beats these real-life options.

3. **Score** = softmax over [all your categories + background categories], with CLIP's standard temperature. Softmax turns the raw match scores into chances that add up to 100%.
4. **Custom categories from plain words.** Wrap what you typed in templates: `"{x}"`, `"a screenshot of {x}"`, `"a photo of {x}"`, `"an advertisement for {x}"`. No language model or server needed. The descriptions can be edited under Categories.

## B4. Extra signals (cheap, big boost for screenshots)

| Signal             | How                                                                                        | Helps with                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Width/height ratio | Matches common phone screens (9:16, 9:19.5, 9:20) or desktop screens (16:9, 16:10) exactly | Screenshots                                                                |
| File name          | "Screenshot_…" / "IMG_…" if Google Photos shows it                                         | Screenshots                                                                |
| Age                | Older counts a bit more toward clutter                                                     | Ordering, confidence                                                       |
| Lots of text       | CLIP "a screenshot with lots of text" vs. "a photo"                                        | Documents, receipts, screenshots                                           |
| Time-gap clusters  | Photos within 10 s of each other and with embedding similarity > 0.95                      | Near-duplicates                                                            |
| Sharpness          | Variance of the Laplacian (a standard sharpness measure) on the thumbnail, via canvas      | Picking a "suggested best" in near-duplicate groups (as a suggestion only) |

These are combined with the CLIP score in a **small logistic-regression model for each category**: about 6 inputs giving 1 probability. It starts with hand-set weights and learns from your decisions (B5). It's tiny, fast, and easy to explain.

## B5. Learning from your choices (few-shot, on your computer)

- **Prototypes:** keep the average embedding of the photos you confirmed as clutter and of those you kept, for each category. At scoring time, add a bonus for closeness to the clutter prototype and a penalty for closeness to the keep prototype.
- **kNN (nearest-neighbour) check:** if a new photo is very close (cosine > 0.92) to a photo you **kept**, don't suggest it. This is the "hide this set" behaviour, done automatically.
- **Re-fitting:** after every 20 decisions, re-fit the small per-category model on your labels. It takes milliseconds.
- **Active learning for the "Quick teach" step:** show the photos whose score is closest to the decision line (most uncertain), spread across categories. 10 answers there are worth far more than 10 random ones.
- **Calibration:** confidence levels are set from your own decisions, aiming for **≥ 90% "Looks right" at High**. If you often untick High photos, the High threshold rises on its own.

## B6. Protecting memories

- **Faces:** a small dedicated face detector (MediaPipe BlazeFace, under 1 MB, runs in WASM) on each candidate photo. CLIP alone isn't reliable enough for "is there a person".
- **Rule:** any photo with a clear face larger than about 5% of the image is never suggested. The one exception is a category the person explicitly marked "includes people", e.g. "screenshots of video calls".
- **Favorites and shared albums:** excluded when the page shows that information.

## B7. Explaining each suggestion

The reason line is built from the top two or three signals that pushed the score up. For example:

- "Looks like a shopping page" (CLIP's best matching description)
- "phone-screen shape" (ratio)
- "from 2021" (age)
- "similar to 12 you marked as clutter" (prototype)

Never show raw numbers on the main screens. The exact score appears only in the photo preview.

## B8. Measuring quality

- **Precision at High** = "Looks right" ÷ photos reviewed at High. This is shown on the developer debug page.
- **A test set from your own decisions:** a held-back 10% of your choices is used to check whether an update helps or hurts.
- **Before release:** label a 300-photo sample by hand (screenshots, ads, real photos) and check that High precision is ≥ 90% for Screenshots and Shopping.

## B9. Performance and storage

- Each embedding is 512 × float16 = 1 KB, so 50,000 photos ≈ 50 MB in IndexedDB. That's acceptable, and "Clear all data" wipes it.
- Photos are processed in batches of 16. Text embeddings are computed once per category and cached.
- Thumbnail requests are throttled (≈ 5–10 per second) with backoff if a request fails.

## B10. Build order

1. **Week 1 — page reading and scan.** Collect id, link, date and ratio, and cache them. Show a plain list. _Check: 5,000 photos scanned without problems._
2. **Week 1–2 — zero-shot model.** CLIP in the offscreen document, plus screenshot and shopping categories and the ratio signal. _Check: hand-labelled sample shows ≥ 90% precision at High for screenshots._
3. **Week 2 — UI:** cards, grid mode, swipe mode, cleanup list, undo.
4. **Week 3 — learning:** prototypes, kNN keep-protection, per-category model, Quick teach.
5. **Week 3 — protection:** face detector and favorites.
6. **Week 4 — polish:** custom categories, near-duplicates with a suggested best, export, and (if you approve) the v1.5 "to remove" album.

## B11. Change needed in `BUILD_PROMPT.md`

Thumbnails are served from `*.googleusercontent.com`, so the extension also needs host permission for that domain. It's read-only: images are fetched, never uploaded.
