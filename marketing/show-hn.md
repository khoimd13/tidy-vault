# Show HN (draft)

Post Tuesday or Wednesday, 8–10 am US Eastern (19:00–21:00 Vietnam). Link the GitHub repo.
Stay around for 3–4 hours to answer. Don't ask anyone to upvote or comment.

## Title (≤80 characters)

```
Show HN: Vault Tidy – on-device CLIP that suggests clutter in Google Photos
```

## URL

https://github.com/khoimd13/tidy-vault

## Text

> I built a Chrome extension that goes through your Google Photos and suggests what you
> probably don't need: screenshots, near-duplicate bursts, blurry/dark shots, receipts,
> memes, and 2-second pocket videos. It never deletes anything; you review and remove photos
> yourself.
>
> Everything runs locally. CLIP ViT-B/32 (8-bit, ~150 MB) is bundled in the extension and runs
> with transformers.js + ONNX Runtime in a Web Worker (WebGPU when available, otherwise WASM).
> There's no server and no analytics; the CSP only allows the bundled WASM.
>
> Some details that might be interesting:
>
> - Zero-shot classification: each clutter category is several averaged prompts, and they
>   compete against everyday-photo prompts ("a selfie", "a landscape photo"), so a photo is
>   only flagged when it looks more like clutter than a memory.
> - Image quality uses variance of the Laplacian, brightness and contrast on the 224 px
>   thumbnail. Near-duplicates are photos within 10 minutes with cosine similarity ≥ 0.92;
>   the sharpest one is kept.
> - The Google Photos Library API no longer lets apps read a user's whole library, so the
>   extension reads the grid you're looking at in your own tab. Google draws the grid in
>   pieces, and scrolling fast past known photos missed 7–12% of tiles in testing, so
>   incremental scans jump to a saved position instead of scrolling.
> - Google only serves video bytes to photos.google.com, so playback in the side panel is
>   streamed through the background worker, 1.5 MB at a time, via the Photos tab.
> - All the page-specific code is in one file, enforced by ESLint, so when Google changes the
>   page the fix is local.
>
> Limits: it's beta and depends on Google's web UI, which can change. The extension is ~230 MB
> because of the model. Date parsing only works when Google Photos is in English or
> Vietnamese. It's an independent project, not affiliated with Google.
>
> Free, MIT. Chrome Web Store: STORE_URL
>
> I'd especially like feedback on false positives, and on whether the zero-shot approach is
> good enough or a small learned head on top of the embeddings is worth it.

## Likely questions (keep answers short and factual)

- _Why not a native app?_ Google Photos has no full-library API for third parties anymore; the
  browser session is the only way to see your own library without uploading it elsewhere.
- _How accurate is it?_ Measured on 24 real screenshots and 26 real photos: all screenshots
  rated High, no photo rated High. Other categories are less tested; that's why "Not sure"
  photos are never preselected. (Add your own reason for choosing B/32 here if asked.)
- _Does it use the "to remove" album API?_ Optional and beta; it uses the same internal web
  calls the Google Photos site uses, and fails safely if they change.
