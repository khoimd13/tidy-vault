# r/privacy (draft, only if the rules allow it)

r/privacy is usually strict about promotion. Read the rules; if self-promotion is banned or
limited to a weekly thread, post there or skip this one. Frame it as a discussion about
on-device AI, invite scrutiny, and make no claim you can't back with code.

## Title

```
Photo-cleanup tools usually upload your library. I built one where the AI runs in the browser instead. Happy to have it picked apart.
```

## Body

> Most "clean up your photos" services want access to your whole library on their servers. I
> wanted the opposite, so I built Vault Tidy, a free, open-source (MIT) Chrome extension for
> Google Photos. I'm the developer.
>
> What I did to keep it private, all checkable in the code:
>
> - The AI model (CLIP, ~150 MB) ships inside the extension and runs locally in a Web
>   Worker. The CSP only allows the bundled WebAssembly; no code or model is fetched at runtime.
> - No servers, no account, no analytics, no ads. The developer receives nothing.
> - It only talks to photos.google.com (and Google's video servers if you play a video),
>   through the session you're already signed in with.
> - Results stay in the extension's local storage. "Clear local data" or uninstalling wipes
>   them.
> - It never deletes, edits or shares photos. The one optional write is a private album you
>   confirm.
>
> Obvious caveat: your photos are still in Google Photos. This doesn't change what Google
> has; it just avoids adding another company to the list while you clean up.
>
> Privacy policy: https://github.com/khoimd13/tidy-vault/blob/main/PRIVACY.md
> Code: https://github.com/khoimd13/tidy-vault
>
> If you see something in the permissions or code that contradicts the above, please tell me.
