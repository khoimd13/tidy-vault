# r/chrome_extensions (draft)

Check the sidebar rules and pick the flair for sharing your own extension before posting.
Attach the demo video or 2–3 screenshots (no Google logo, blur the email).

## Title

```
I made a free extension that finds clutter in Google Photos with an AI model that runs locally (MV3, open source)
```

## Body

> Hi all, developer here. Vault Tidy is a side-panel extension for photos.google.com. It
> scrolls through what you're viewing and suggests screenshots, near-duplicate bursts,
> blurry/dark shots, receipts, memes, accidental shots and short or long videos. It **never
> deletes** anything: you review, then remove photos yourself (or let it collect them into one
> private album, beta).
>
> Some MV3 bits that might help others:
>
> - CLIP (8-bit ONNX, ~150 MB) runs with transformers.js in a Web Worker in the side panel,
>   WebGPU with a WASM fallback. CSP is `script-src 'self' 'wasm-unsafe-eval'`; nothing remote
>   is loaded.
> - No image-host permission: thumbnails need the Google session, so the content script
>   fetches the 224 px thumbnails in the Photos tab and hands them to the panel.
> - Videos play in the side panel by streaming through the service worker in 1.5 MB pieces,
>   because Google only serves video bytes to its own site.
> - `scripting` is only used to re-inject into a Photos tab that was open before an update.
>   Permissions are otherwise just `sidePanel`, `storage`, `alarms` (opt-in reminder) and
>   photos.google.com.
>
> Stack: Vite + @crxjs, Preact, TypeScript strict. 12 UI languages.
>
> Honest limits: beta, ~230 MB because the model is bundled, and it depends on Google's web
> page, so it can break when they change it. Not affiliated with Google.
>
> Store: STORE_URL
> Code (MIT): https://github.com/khoimd13/tidy-vault
>
> Feedback on the panel UX or the permission set is very welcome.
