# Vault Tidy launch plan (organic, 3 weeks)

Drafts only. Nothing here has been posted, submitted or sent. Every post below is for you to
publish yourself, from your own accounts, when you are ready.

## What we are launching

Vault Tidy is a free Chrome extension that **suggests** clutter in Google Photos (screenshots,
near-duplicate bursts, blurry or dark shots, receipts and documents, memes, accidental shots,
short, long and screen-recorded videos). A CLIP AI model runs on your own computer. It never
deletes anything: you review the suggestions, and the only change it can make is an optional
private "to remove" album (beta). No account, no servers, no analytics. 12 languages.
Open source (MIT).

**Honest limits to say every time:** it is beta (v0.x); it reads the Google Photos web page, so
it can break when Google changes its site; the download is large (~230 MB, the model is
bundled); dates are read only when Google Photos is in English or Vietnamese. It is an
independent project, not made or endorsed by Google. Never use Google's logo or the Google
Photos icon in any image.

**One-line pitch:** "Find the clutter in your Google Photos with AI that runs on your
computer. It only suggests; you decide. Free, no account."

## Why these channels

A free, privacy-first, open-source tool has no ad budget, but it has three things communities
reward: it is free, the code is public, and nothing leaves the computer. So we pick places
where people (a) already have the problem (a full Google Photos / 15 GB storage limit) or
(b) care about on-device AI and privacy, and where "I built this, here is the code" is welcome.

| Channel                            | Why it fits                                                                     | Metric (one)                                 | Target   |
| ---------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- | -------- |
| GitHub README badge + landing page | Every other post links here; converts readers into installs                     | Store installs (Web Store dashboard)         | baseline |
| Vietnamese Facebook groups         | Your own network and language; UI is in Vietnamese and dates work in Vietnamese | Store installs from VN (dashboard by region) | 100      |
| Reddit (3 subs, spaced out)        | Where people ask "how do I clean up Google Photos?"                             | Upvotes on each post                         | 50+ each |
| Hacker News "Show HN"              | Technical audience that likes on-device CLIP, MV3 and open source               | Points                                       | 30+      |
| Product Hunt                       | Good backlink and "launch day" moment; free tools do fine                       | Upvotes                                      | 150+     |
| X / Threads thread                 | Cheap to post; reuses the demo video; good for reposts from dev/privacy people  | Reposts                                      | 10+      |
| Alternative-to lists               | Slow, steady long-tail traffic                                                  | Listings accepted                            | 3        |
| GitHub                             | Credibility signal for privacy claims                                           | Stars                                        | 100      |

Skipped on purpose: paid ads, influencer outreach, mass DMs, giveaways, upvote groups (HN and
Product Hunt both treat asked-for votes as abuse).

## Order and timing

**Before anything (week 0, gate):** the extension is live on the Chrome Web Store (the
`store/` work). Then:

1. Replace `STORE_URL` everywhere in `marketing/` with the real listing URL
   (`grep -rl STORE_URL marketing/`).
2. Publish the landing page (see "Landing page" below) and add the README badge.
3. Record the 30–45 s demo video (`demo-video-script.md`) and take the gallery shots
   (`producthunt.md`). Use a test Google account with sample photos, never real personal
   photos, and blur any email address shown at the top of the panel.
4. Install it yourself from the Store on a clean Chrome profile and run a full scan once,
   so you can answer "does it work?" with confidence.

**Week 1: friendly audiences first (find bugs while traffic is small)**

| Day     | Post                                                               | File                            |
| ------- | ------------------------------------------------------------------ | ------------------------------- |
| Mon     | Vietnamese Facebook: your own profile, then 1–2 groups (see below) | `facebook-vi.md`                |
| Tue     | r/chrome_extensions                                                | `reddit/r-chrome_extensions.md` |
| Thu     | X / Threads thread with the demo video                             | `x-threads.md`                  |
| Fri–Sun | Fix whatever people report; ship a patch if needed                 | —                               |

**Week 2: bigger technical audiences**

| Day                     | Post                                         | File                       |
| ----------------------- | -------------------------------------------- | -------------------------- |
| Tue, 8–10 am US Eastern | Show HN. Stay online for 3–4 hours to answer | `show-hn.md`               |
| Thu                     | r/googlephotos                               | `reddit/r-googlephotos.md` |
| Weekend                 | Submit to alternative-to lists (below)       | —                          |

**Week 3: Product Hunt and privacy crowd**

| Day                | Post                                                                      | File                  |
| ------------------ | ------------------------------------------------------------------------- | --------------------- |
| Tue, 00:01 Pacific | Product Hunt launch. Post the maker comment right away; answer all day    | `producthunt.md`      |
| Thu                | r/privacy (only if its rules allow it; see below)                         | `reddit/r-privacy.md` |
| Fri                | Short wrap-up post on X/Threads + Facebook: what you learned, what's next | —                     |

Space Reddit posts at least 2 days apart and never cross-post the same text: each draft is
written for its subreddit.

## Reddit: rules to check before posting

I could not read the subreddits' rule pages (Reddit blocks the tools used to prepare these
drafts), so the notes below are **unverified**. Open each subreddit's sidebar and "Rules" tab
before posting, and drop any subreddit whose rules say no.

| Subreddit           | What to look for                                                                                              | Plan                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| r/chrome_extensions | Built for developers sharing their extensions; usually needs a flair                                          | Post here first (draft ready)                     |
| r/googlephotos      | Users with the exact problem. Check whether third-party tools / self-promo are allowed or limited to a thread | Post if allowed (draft ready)                     |
| r/privacy           | Often strict about promotion. Check for "no self-promotion" or a weekly thread                                | Post only if allowed, else skip (draft ready)     |
| r/DataHoarder       | Cares about keeping data, not deleting it; "suggests deletions" can land badly                                | Skip, or only answer existing threads             |
| r/declutter         | About physical stuff; digital tools are often off-topic                                                       | Skip                                              |
| r/SideProject       | Made for "I built this" posts                                                                                 | Optional extra, reuse the chrome_extensions draft |

General Reddit etiquette that applies everywhere: say plainly that you are the developer,
answer every comment, don't post from a brand-new account, and don't ask anyone to upvote.

## Hacker News "Show HN"

Show HN rules (read on news.ycombinator.com/showhn.html): it must be something people can try,
ideally without signups; you must have made it and be around to discuss; don't ask friends to
vote or comment; the title starts with "Show HN". A Chrome extension with public code and no
account fits. Link the GitHub repo (HN prefers code to landing pages).

## Vietnamese Facebook

Post on your own profile first, then in 1–2 groups where members are tech users (for example
groups for Chrome / tips & tricks, software sharing, or Vietnamese developers like J2Team
Community or "Cộng đồng lập trình viên"). Read each group's rules first; many allow sharing a
free tool only on certain days or with admin approval. Don't post the same text to many groups
on the same day (Facebook marks that as spam).

## Alternative-to lists (week 2–3)

Submit a listing to: AlternativeTo (as an alternative to Google Photos' own "clean up
suggestions"), Chrome extension directories that accept free submissions, and an "awesome"
list on GitHub for privacy or self-hosted/on-device tools via pull request. One metric:
listings accepted.

## Landing page

`marketing/landing/index.html` is a single static file: no tracking, no external scripts or
fonts. It can go on GitHub Pages from the personal repo
(`https://khoimd13.github.io/tidy-vault/`):

- Easiest: Settings → Pages → "Deploy from a branch" only serves `/` or `/docs`, so use
  GitHub Actions instead. Copy `marketing/landing/deploy-pages.yml.example` to
  `.github/workflows/deploy-pages.yml`, then Settings → Pages → Source: "GitHub Actions".
- Before publishing: replace `STORE_URL`, and add `og-image.png` (1200×630, a screenshot of
  the panel next to blurred photos, no Google logo) to `marketing/landing/`.

## README badge

Add near the top of `README.md` once the listing is live:

```markdown
[![Available in the Chrome Web Store](https://img.shields.io/chrome-web-store/v/EXTENSION_ID?label=Chrome%20Web%20Store)](STORE_URL)
[![Users](https://img.shields.io/chrome-web-store/users/EXTENSION_ID)](STORE_URL)
```

(Google also offers an official "Available in the Chrome Web Store" badge image; using it is
allowed under its branding guidelines, which you should read first. The shields.io badge
above avoids the question.)

## Tracking (no tools needed)

Once a week, write four numbers in this file: Web Store installs (and by region), GitHub stars,
open issues, and Store rating. Add `?utm_source=` only to the Store link if you want; the
Store dashboard shows it. The landing page itself has no analytics, on purpose.

| Week | Installs | Stars | Issues | Rating | Notes |
| ---- | -------- | ----- | ------ | ------ | ----- |
| 0    |          |       |        |        |       |
| 1    |          |       |        |        |       |
| 2    |          |       |        |        |       |
| 3    |          |       |        |        |       |

## Answers to have ready

- **"Does it delete my photos?"** No. It suggests. You remove photos yourself in Google Photos.
  The optional beta album only collects photos you confirmed into one new private album.
- **"Why should I trust it?"** The code is public (MIT). The model ships inside the extension;
  there are no servers and no analytics. Permissions: photos.google.com, side panel, storage,
  scripting (reconnect), alarms (optional reminder).
- **"Why 230 MB?"** The CLIP model (~150 MB) is bundled so nothing is downloaded at runtime.
- **"Why not the Google Photos API?"** Google's API no longer lets apps read a user's whole
  library, so Vault Tidy reads the web page you are looking at, in your own browser.
- **"Is it from Google?"** No, it is an independent project.
- **"Will it break?"** It can, when Google changes its site. It fails safely (no changes made),
  and the fix lives in one file.
- **"Safari/Firefox/phone?"** Chrome on a computer only, for now (other Chromium browsers are untested).
