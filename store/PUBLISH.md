# Publishing Vault Tidy on the Chrome Web Store

Step by step, for the first release and for updates. What to paste in each field is in
[LISTING.md](LISTING.md); the images are in [images/](images/).

You do every step here yourself: paying, signing in and submitting can't be done for you.

## 0. Before you start

- Merge the branch with these files into `main` and push it, so that the privacy policy at
  <https://github.com/khoimd13/tidy-vault/blob/main/PRIVACY.md> includes the new paragraph about
  page session values. The Privacy tab answers in LISTING.md rely on it.
- Pick the Google account that will own the listing. It can't be moved to another account
  later without contacting support, and its email is shown to Google, not on the listing
  (unless you register as a trader).
- Turn on 2-Step Verification for that Google account. The Web Store requires it to publish.

## 1. Build the package

In PowerShell, from the repository folder:

```powershell
npm ci
```

```powershell
npm run model:fetch
```

```powershell
npm run check
```

```powershell
npm run build
```

`model:fetch` downloads the CLIP model (about 150 MB, once) into `public/models`, so it is
bundled. **Do not skip it**: without the model the extension only recognises screenshots by
shape. Check that it is in the build:

```powershell
Test-Path dist\models\Xenova\clip-vit-base-patch32\onnx\vision_model_quantized.onnx
```

It must print `True`.

Then zip the **contents** of `dist` (not the `dist` folder itself), so `manifest.json` is at the
top of the zip. Use PowerShell 7 (`pwsh`); the older Windows PowerShell 5.1 writes backslashes
into zip paths, which the Web Store rejects.

```powershell
Compress-Archive -Path dist\* -DestinationPath vault-tidy-0.13.0.zip -Force
```

```powershell
"{0:N0} MB" -f ((Get-Item vault-tidy-0.13.0.zip).Length / 1MB)
```

Expect about **115 MB** (v0.13.0: `dist` is 179 MB unzipped, 71 files). The Web Store accepts up
to 2 GB. Keep the zip out of git (or delete it after uploading).

Optional: test the exact build first. Open `chrome://extensions`, turn on Developer mode,
**Load unpacked**, pick `dist`, and try a scan on photos.google.com. Then remove that copy.

## 2. Register as a Chrome Web Store developer (once)

1. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) and sign in
   with the account you picked.
2. Accept the developer agreement and pay the one-time registration fee (US$5 at the time of
   writing; the dashboard shows the current amount).
3. **Trader or non-trader:** choose **Non-trader**. Vault Tidy is free, has no ads, no paid
   version and no business behind it, so you are not acting as a trader under EU law. (A
   trader's address and phone number are shown publicly on the listing.) If you later charge
   for it or run it as a business, change this to Trader.
4. In **Account**, set the publisher display name (for example your name or "Vault Tidy") and a
   contact email, and verify the email. The display name is shown on the listing.

## 3. Create the item

1. In the dashboard, click **New item** and upload `vault-tidy-0.13.0.zip`.
2. The dashboard reads the name, summary, version, icon and the 12 languages from the package.
   If it reports a manifest error, fix it, rebuild, re-zip and upload again.

## 4. Fill each tab (copy from LISTING.md)

**Store listing**

- Description: the text block under "Description".
- Category: Art & Design (or Tools; see LISTING.md for why).
- Language: English.
- Store icon: `store/images/icon-128.png`.
- Screenshots: upload the five `store/images/screenshot-*.png` in number order.
- Small promo tile: `store/images/promo-small-440x280.png`.
- Marquee promo tile: `store/images/promo-marquee-1400x560.png`.
- Homepage URL and Support URL: as in LISTING.md. Leave Official URL empty.
- Mature content: No.

**Privacy practices**

- Single purpose: the text block.
- One justification per permission: `sidePanel`, `storage`, `scripting`, `alarms` and the
  host permission `https://photos.google.com/*`.
- Remote code: "No, I am not using remote code".
- Data usage: tick **Personally identifiable information** and **Website content** only (read
  the note on authentication information first and decide), then tick all three
  certifications.
- Privacy policy URL: `https://github.com/khoimd13/tidy-vault/blob/main/PRIVACY.md`.

**Distribution**

- Free of charge; Public (or Unlisted for a quiet first release); all regions.

**Test instructions** (if the tab is shown)

Paste this so the reviewer knows how to try it:

```text
No account or login for Vault Tidy itself. Sign in to any Google account that has a few photos in Google Photos, open https://photos.google.com, click the Vault Tidy toolbar icon to open the side panel, and click "Find suggestions". The AI model is bundled (models/), so the first analysis takes a few seconds to start. Vault Tidy never deletes anything; the only optional write is "Put N in a new album (beta)" on the Cleanup list screen.
```

## 5. Submit

Click **Submit for review**. You can choose to publish automatically once it passes, or to
publish yourself afterwards (useful to pick the launch moment).

**Review time:** usually a few days, but up to a few weeks. Expect the longer side for a first
item from a new developer account with a host permission and a large package. Google suggests
contacting support only after 3 weeks. If it is rejected, the email names a policy code and
the reason. Fix it, upload a new zip if needed, and resubmit.

## 6. Publishing an update

1. Bump the version in `package.json` (the manifest takes its version from there). Each upload
   must have a higher version than the last one, for example `0.13.0` to `0.13.1`.
2. Rebuild exactly as in step 1 (`npm run model:fetch` is only needed on a fresh checkout) and
   zip `dist\*` with the new version in the file name.
3. In the dashboard, open the item, go to **Package**, click **Upload new package**, pick the zip,
   update any listing text or images that changed, and **Submit for review**.
4. Updates are reviewed too (often faster). Users get the new version automatically within a
   few hours of publishing.

If an update adds a permission or a host, Chrome disables the extension for existing users until
they accept it, and the Privacy tab needs a justification for it. Keep `PRIVACY.md` and the
Privacy tab in step with any change in what the extension reads or stores.

## Changing the name or summary

They live in `public/_locales/<lang>/messages.json` (`extName` max 75 characters,
`extDescription` max 132). Edit, rebuild, bump the version and upload as an update.

## Regenerating the images

The images are rendered from `store/src/compose.html` with real screenshots of the side panel
(`store/src/panels/`), taken from the UI preview with synthetic sample images
(`store/src/gen-samples.mjs`; no real photos). To redo them after a UI change:

1. Generate the samples: `node store/src/gen-samples.mjs preview/samples` (needs `sharp`, which
   is already installed as a dependency of transformers.js).
2. Start the preview: `npm run preview:ui` (port 5199; `store/src/*.mjs` expect 5299, so either
   run `npx vite --config preview/vite.config.ts --port 5299` or edit `BASE`/`PREVIEW_URL`).
3. With `playwright-core` available (`npm i --no-save playwright-core`), run
   `node store/src/capture-panels.mjs store/src/panels` and
   `node store/src/capture-welcome.mjs store/src/panels`. The first one waits for the real AI to
   analyse 54 images (a few minutes).
4. Render: `node store/src/render.mjs`.
5. The icon is `store/src/icon.svg`; the PNGs in `public/icons/` and `store/images/icon-128.png`
   were rendered from it with `sharp`.
