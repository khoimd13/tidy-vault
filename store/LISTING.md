# Chrome Web Store listing: Vault Tidy

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole),
tab by tab. Steps for publishing are in [PUBLISH.md](PUBLISH.md). Images are in
[images/](images/).

Checked against the code at v0.13.0 (`manifest.config.ts`, `src/`) and `PRIVACY.md` on
25 November 2026.

## How the wording was chosen

Store search matches the item name most strongly, then the summary, then the description. On
25 November 2026, the Chrome Web Store showed this:

- **Crowded:** "google photos delete", "google photos duplicates" and "google photos cleaner".
  The first pages are full of bulk deleters and duplicate removers, such as Google Photos
  Duplicate Remover (20,000 users), Delete All Google Photos Extension (10,000) and Bulk Select
  Google Photos (6,000). Nearly every competitor puts "Google Photos" in its name, plus "delete",
  "duplicates", "bulk", "cleaner" or "free up storage".
- **Under-served:** "delete screenshots google photos", "blurry photos", receipts, memes and
  clutter. These searches return mostly screenshot-capture or photo-enhancer tools and only 1–3
  cleanup tools.
- **Not on offer:** no competitor sells "suggests, never deletes" or private on-device AI as its
  main point. That is Vault Tidy's angle.

The name therefore says what it is ("cleaner for Google Photos") and adds the two strongest
specific terms ("duplicates", "screenshots"). The summary carries "free up Google storage",
"blurry", "receipts" and "memes". The description uses each phrase naturally once or twice.

Rules followed:

- **No keyword stuffing.** The Store flags a keyword repeated more than 5 times. "Google Photos"
  appears 3 times in the English description, including the trademark line.
- **No implied endorsement.** "for Google Photos" describes compatibility, and the description
  says plainly that Vault Tidy is not made or endorsed by Google. No Google logo or Google
  colours are used anywhere.

## Store listing tab

### Item name and summary

These come from the package (`public/_locales/<lang>/messages.json`), not from the dashboard. The
dashboard shows them read-only.

| Field                              | Value                                                                                                                            | Length |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Name (≤ 75)                        | Vault Tidy – AI Cleaner for Google Photos: Duplicates & Screenshots                                                              | 67     |
| Summary (short description, ≤ 132) | Free up Google storage: on-device AI finds screenshots, duplicate and blurry photos, receipts and memes. Private, never deletes. | 128    |

### Localised name and summary

The package carries these for all 12 interface languages. Chrome and the Web Store show the
visitor's language automatically. Each language keeps Google's own local name for the product
where people search with it (Google 相册, Google フォト, Google 포토, Google Фото, Google Fotos).

| Locale | Name                                                                   | Summary                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| en     | Vault Tidy – AI Cleaner for Google Photos: Duplicates & Screenshots    | Free up Google storage: on-device AI finds screenshots, duplicate and blurry photos, receipts and memes. Private, never deletes.                        |
| vi     | Vault Tidy – Dọn Google Photos bằng AI: ảnh trùng, ảnh chụp màn hình   | Giải phóng bộ nhớ Google: AI ngay trên máy tìm ảnh chụp màn hình, ảnh trùng, ảnh mờ, hoá đơn, meme. Miễn phí, không tự xoá.                             |
| th     | Vault Tidy – ล้างรูปใน Google Photos ด้วย AI: รูปซ้ำและภาพหน้าจอ             | เพิ่มพื้นที่ Google: AI บนเครื่องของคุณช่วยหาภาพหน้าจอ รูปซ้ำ รูปเบลอ ใบเสร็จ และมีมใน Google Photos ไม่ลบอะไรเองเด็ดขาด                                                  |
| id     | Vault Tidy – Pembersih Google Photos dengan AI: Duplikat & Screenshot  | Kosongkan penyimpanan Google: AI di perangkat menemukan screenshot, foto duplikat & buram, struk, dan meme. Gratis, tidak menghapus.                    |
| zh_CN  | Vault Tidy – Google 相册 AI 清理助手：重复照片和截图                   | 释放 Google 存储空间：本机 AI 帮你找出 Google 相册里的截图、重复照片、模糊照片、收据和表情包。只给建议，绝不自动删除。                                  |
| ja     | Vault Tidy – Google フォトを AI で整理：重複写真とスクリーンショット   | Google の保存容量を空けよう：端末内の AI が Google フォトのスクリーンショット、重複・ブレた写真、レシート、ミーム画像を見つけます。勝手に削除しません。 |
| ko     | Vault Tidy – AI로 Google 포토 정리: 중복 사진·스크린샷                 | Google 저장용량 확보: 기기 안의 AI가 Google 포토에서 스크린샷, 중복·흐린 사진, 영수증, 밈을 찾아 드립니다. 절대 직접 삭제하지 않습니다.                 |
| ru     | Vault Tidy – AI-очистка Google Фото: дубликаты и скриншоты             | Освободите место в Google: AI на вашем компьютере найдёт скриншоты, дубликаты, размытые фото, чеки и мемы. Бесплатно, не удаляет.                       |
| de     | Vault Tidy – KI-Aufräumhilfe für Google Fotos: Duplikate & Screenshots | Google-Speicher freigeben: KI auf deinem Gerät findet Screenshots, doppelte und unscharfe Fotos, Belege, Memes. Gratis, löscht nie.                     |
| fr     | Vault Tidy – Nettoyeur IA pour Google Photos : doublons et captures    | Libérez du stockage Google : une IA locale repère captures, doublons, photos floues, tickets et mèmes. Gratuit, ne supprime rien.                       |
| es     | Vault Tidy – Limpiador con IA para Google Fotos: duplicados y capturas | Libera espacio en Google: una IA en tu equipo halla capturas, fotos duplicadas y borrosas, recibos y memes. Gratis, nunca borra.                        |
| pt_BR  | Vault Tidy – Limpador com IA para Google Fotos: duplicadas e capturas  | Libere espaço no Google: uma IA no seu computador acha capturas, fotos duplicadas e borradas, recibos e memes. Grátis, nunca apaga.                     |

To change any of these, edit `public/_locales/<lang>/messages.json`, rebuild and upload a new
package. All of them fit the limits (checked by character count, not bytes).

### Description

The description is plain text: the Store does not render Markdown, but it keeps line breaks and
shows "•" bullets as typed. The Store limit is 16,000 characters; this is about 4,200. The first
two lines are what visitors see before "Read more", so they carry the main promise. Paste
everything between the lines:

```text
Free up Google storage without the fear of losing a memory. Vault Tidy finds the clutter in your Google Photos library (screenshots, near-duplicate photos, blurry shots, receipts, memes and accidental videos) and lets you decide. It never deletes anything.

An AI model runs on your own computer, so your photos are never uploaded anywhere. Free, no account, no ads.

WHAT IT FINDS
• Screenshots: chats, shopping pages, product ads, tickets, settings screens
• Near-duplicates: bursts and repeated shots taken minutes apart. The sharpest one stays; the rest are suggested
• Blurry, dark or empty photos: measured by sharpness, brightness and contrast
• Receipts and documents, whiteboards and notes
• Memes and forwarded images
• Accidental shots: pocket photos, floors and ceilings
• Videos: clips of 3 seconds or less, screen recordings, and long videos (listed separately at Low, because they are often precious)

HOW IT WORKS
1. Open photos.google.com and click the Vault Tidy icon. A side panel opens next to your photos.
2. Click "Find suggestions". Vault Tidy scrolls through whatever the page is showing: your whole library, a search or an album.
3. Suggestions appear in groups, with the reason for each one ("looks like a screenshot of a chat conversation", "only 2 seconds long", "very similar to a photo taken the same day") and a High, Medium or Low confidence.
4. Review a group. "Likely clutter" starts selected; untick anything you want to keep. Or go one by one with the keyboard: → clutter, ← keep.
5. Your cleanup list shows how much space you could free. Copy the links, export a CSV, or let Vault Tidy put the photos into one new private album (beta), then delete them yourself in Google Photos in a few clicks.

Later scans only read photos added since last time, and photos already analysed are never analysed again.

PRIVATE BY DESIGN
• The AI model (CLIP) is bundled inside the extension and runs on your computer, on the GPU when available
• No servers, no accounts, no analytics, no ads. Nothing is sent to the developer or anyone else
• Results are stored only on your computer. "Clear local data" or uninstalling removes them
• Only works on photos.google.com, and only reads what your own browser tab shows
• Open source (MIT licence)

SAFE BY DESIGN
• Vault Tidy never deletes, edits or shares a photo. You make every decision
• Keep, Add to cleanup list and Remove all have Undo
• The one optional change it can make is creating a private "to remove" album, and only when you confirm

ALSO
• Exact sizes: shows how much each suggestion counts against your Google storage, where Google provides it
• Learns from you: photos nearly identical to ones you kept stop being suggested
• Plays videos inside the panel, so you can check a clip before deciding
• Results are kept apart for each Google account
• Optional monthly reminder (off by default)
• Interface in 12 languages: English, Tiếng Việt, ไทย, Bahasa Indonesia, 简体中文, 日本語, 한국어, Русский, Deutsch, Français, Español, Português

FAQ
Does Vault Tidy delete my photos?
No. It only suggests. You delete photos yourself, and deleted photos stay in the trash for 60 days.

Are my photos uploaded?
No. The AI model ships inside the extension and runs on your computer. Vault Tidy has no server.

Why is the download large?
The AI model (about 150 MB) is included so that nothing is ever downloaded or sent at run time.

Does it work if my Google account is not in English?
Yes. Reading photo dates (used for date ranges and near-duplicates) currently needs the photos site set to English or Vietnamese; everything else works in any language.

Is it free?
Yes, completely: no trial, no premium version, no ads.

Does it work on phones?
No. Chrome extensions run on desktop Chrome (Windows, macOS, Linux, ChromeOS).

Vault Tidy is an independent project. It is not made, affiliated with, endorsed or sponsored by Google. Google Photos is a trademark of Google LLC.

Privacy policy: https://github.com/khoimd13/tidy-vault/blob/main/PRIVACY.md
Questions and bug reports: https://github.com/khoimd13/tidy-vault/issues
```

### Category, language and links

| Field                      | Value                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category                   | **Art & Design**: its Store definition covers organising images, and only one Google Photos cleanup tool is there. Alternative: **Tools**, where most competitors sit. |
| Language                   | English (the dashboard's default language for the listing). The 12 package locales above are picked up automatically.                                                  |
| Official URL               | None (it needs a site verified in Google Search Console). Leave empty.                                                                                                 |
| Homepage URL               | https://github.com/khoimd13/tidy-vault                                                                                                                                 |
| Support URL                | https://github.com/khoimd13/tidy-vault/issues                                                                                                                          |
| Mature content             | No                                                                                                                                                                     |
| Store icon                 | `images/icon-128.png`                                                                                                                                                  |
| Screenshots (1280×800)     | `images/screenshot-1-suggestions.png` … `images/screenshot-5-languages.png`, in that order                                                                             |
| Small promo tile (440×280) | `images/promo-small-440x280.png`                                                                                                                                       |
| Marquee promo (1400×560)   | `images/promo-marquee-1400x560.png`                                                                                                                                    |
| Global promo video         | None                                                                                                                                                                   |

The repository is public (the privacy policy URL returned HTTP 200 on 25 November 2026), so
these links work. If you ever make it private, the privacy policy must move to a public URL.

## Privacy practices tab

### Single purpose

```text
Vault Tidy helps people clean up their Google Photos library. It scans the photos shown in the user's photos.google.com tab, uses an AI model that runs on the user's computer to suggest photos and videos they might not need (screenshots, near-duplicates, blurry photos, receipts, memes, accidental shots and videos), and lists them in a side panel for the user to review. It never deletes anything; the user removes photos in Google Photos.
```

### Permission justifications

**sidePanel**

```text
Vault Tidy's whole interface is a side panel shown next to the Google Photos tab, so the user can see the suggestions and the photos side by side. Clicking the toolbar icon opens the panel (chrome.sidePanel.setPanelBehavior).
```

**storage**

```text
Stores the user's settings (interface language, the optional monthly reminder), which Google account the saved results belong to, how far a scan got (so it can resume), and the number of photos waiting for review, all in chrome.storage.local on the user's computer. chrome.storage.session holds a short-lived token while a video plays in the panel. Nothing is synced or sent anywhere.
```

**scripting**

```text
Chrome only adds content scripts to pages loaded after the extension is installed or updated. When the user opens the panel while a photos.google.com tab is already open, Vault Tidy uses chrome.scripting.executeScript to add its own bundled content script (the same file declared in the manifest) to that tab. It never injects code from anywhere else, and only works on photos.google.com.
```

**alarms**

```text
Powers the optional monthly reminder, which is off by default. Once a month an alarm checks whether the user turned the reminder on and has photos waiting for review; only then it shows a small count on the toolbar icon. Nothing else runs on the alarm.
```

**Host permission: https://photos.google.com/\***

```text
Vault Tidy only works on Google Photos. Its content script reads the photo grid the user is looking at (each item's id, link, date, shape, video length and thumbnail) and downloads the small thumbnails with the user's own session, so the on-device AI can look at them. When the user asks, it also reads a photo's file size, a larger version of a photo, or a video to play in the panel, and, only after the user confirms, creates one private album containing the photos they chose. It never deletes, edits or shares photos. No other site is accessed.
```

### Remote code

Select **"No, I am not using remote code"**, and if a justification box appears, paste:

```text
All code, including the ONNX Runtime WebAssembly files and the CLIP AI model, is bundled in the package. transformers.js runs with remote models disabled (env.allowRemoteModels = false), and the CSP is "script-src 'self' 'wasm-unsafe-eval'", which only allows the bundled WebAssembly.
```

### Data usage

The Store asks what user data the extension _handles_, which includes data that is only
processed or stored on the user's device (User Data FAQ). Vault Tidy sends nothing off the
device, but it does handle these, so tick:

| Category                            | Tick?   | Why                                                                                                                                                                                 |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | **Yes** | The email address of the Google account signed in to Google Photos, read from the page and stored locally to keep each account's results apart and to show which account is in use. |
| Health information                  | No      |                                                                                                                                                                                     |
| Financial and payment information   | No      | Receipts are recognised only as a picture type; no text is read from them.                                                                                                          |
| Authentication information          | No      | See the note below.                                                                                                                                                                 |
| Personal communications             | No      |                                                                                                                                                                                     |
| Location                            | No      | Photo location data is never read.                                                                                                                                                  |
| Web history                         | No      | Only photo links inside photos.google.com are read, not browsing history.                                                                                                           |
| User activity                       | No      | No clicks, keystrokes or scrolling are recorded. The user's keep/clutter choices are stored as part of the results.                                                                 |
| Website content                     | **Yes** | Photo ids, links, dates, thumbnails and file sizes from photos.google.com, and the AI's numbers for each photo, all stored only on the computer.                                    |

**Authentication note (decide before submitting).** To make the requests the user asks for
(exact sizes, playing a video, the "to remove" album), the content script reads Google Photos'
own page session values, including its anti-forgery token (`SNlM0e`,
`src/source/googlePhotosApi.ts`). They are used in memory for requests to photos.google.com
only, exactly like the Google Photos page itself, and are never stored or sent anywhere else.
That is not a password or credential the user enters, so the recommended answer is **No**. If
you prefer to be maximally cautious, tick it; the listing will then say the extension handles
authentication information. `PRIVACY.md` now mentions these session values either way.

Then tick all three certifications:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

These match the "Use of data" section of `PRIVACY.md`, which states the Limited Use commitment.

### Privacy policy URL

```text
https://github.com/khoimd13/tidy-vault/blob/main/PRIVACY.md
```

It must stay reachable without signing in; it was (HTTP 200) on 25 November 2026.

## Distribution tab

| Field      | Value                                                             |
| ---------- | ----------------------------------------------------------------- |
| Payments   | Free of charge                                                    |
| Visibility | Public (or Unlisted for a soft launch: only people with the link) |
| Regions    | All regions                                                       |

## Claims checked against the code

| Claim                                                    | Where it is true                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Never deletes; the only write is one new private album   | `src/source/googlePhotosApi.ts` (create album, add items, read back; no delete call)                                  |
| Model and runtime bundled, no remote code                | `src/ml/clip/clip.worker.ts` (`allowRemoteModels = false`), `scripts/prepare-assets.mjs`, CSP in `manifest.config.ts` |
| Only photos.google.com                                   | `host_permissions` and `content_scripts.matches` in `manifest.config.ts`                                              |
| scripting only re-adds the bundled content script        | `injectContentScript` in `src/ui/lib/chromeApi.ts`                                                                    |
| alarms only for the opt-in reminder                      | `src/background/index.ts` (badge only when `reminder === true` and count > 0)                                         |
| storage contents                                         | `src/ui/lib/accounts.ts`, `src/ui/i18n.tsx`, `src/ui/lib/chromeApi.ts`, `src/content/index.ts`                        |
| Results in IndexedDB only, cleared by "Clear local data" | `src/store/db.ts`                                                                                                     |
| Account email read and stored locally                    | `readAccount` in `src/source/googlePhotosApi.ts`, `src/ui/lib/accounts.ts`                                            |
| Undo on Keep, Add and Remove all                         | Review and Cleanup screens in `src/ui/sidepanel/screens/`                                                             |
| 12 languages                                             | `src/ui/locales/index.ts`                                                                                             |
| Dates only read in English and Vietnamese                | README "Known limits"                                                                                                 |
