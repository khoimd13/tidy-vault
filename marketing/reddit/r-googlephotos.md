# r/googlephotos (draft)

Check the rules first: if self-promotion or third-party tools are not allowed, or only in a
pinned thread, follow that (or skip). Lead with the user's problem, not the tech. Say you are
the developer.

## Title

```
Made a free tool that suggests screenshots, bursts and blurry shots to clear out of Google Photos (never deletes anything)
```

## Body

> My storage kept filling up, and most of it wasn't memories: screenshots, 10-shot bursts,
> pocket videos, photos of receipts. Finding them by hand took forever, so I made a Chrome
> extension for it. Full disclosure: I'm the developer, it's free and open source.
>
> **How it works:** open Google Photos on your computer, click the Vault Tidy icon, and it
> scrolls through what you're viewing (whole library, a search, or an album). It groups what it
> finds:
>
> - Screenshots, shopping pages, memes, receipts and documents, whiteboards
> - Blurry, dark or empty photos and accidental shots
> - Near-duplicate bursts (keeps the sharpest, suggests the rest)
> - Very short clips, screen recordings, and long videos (long ones only as "low", since
>   they're often precious)
>
> It shows how much space you could free, using real sizes from Google Photos where it can.
>
> **What it doesn't do:** it never deletes anything. You tick what you don't need and get a
> list. Optionally it puts those photos into one new private album, so you can select all and
> move them to trash yourself (trash keeps them 60 days).
>
> **Privacy:** the AI runs on your own computer. No account, no servers, nothing uploaded.
>
> **Limits:** computer + Chrome only, beta, and it reads the Google Photos website, so if
> Google changes the site something may break for a while. Not made by or affiliated with
> Google.
>
> Link: STORE_URL (code: https://github.com/khoimd13/tidy-vault)
>
> If it flags something it shouldn't, I'd love to know what kind of photo it was.
