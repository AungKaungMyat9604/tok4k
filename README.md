# Tok4K

**Tok4K** by **Menzies Organization** — mobile-first [SvelteKit](https://svelte.dev/docs/kit) app focused on **near-original quality on TikTok**. UI uses [Menzies Design Wash UI](https://www.npmjs.com/package/@menzies-mariesta-com/menzies-design-wash-ui) `@1.3.0`.

## Primary path: Optimize + TikTok web HD

1. Open **[/optimize](/optimize)** (no TikTok login required).
2. Pick an **MP4 / MOV** (H.264 or H.265).
3. Tok4K runs **on-device**:
   - Container normalize (`isom`, moov before mdat / fast-start)
   - Sample-table **frame-density inflate** (no pixel re-encode)
4. **Download** the optimized file.
5. Upload on [TikTok Studio / web](https://www.tiktok.com/tiktokstudio/upload):
   - Enable **Upload HD** / high-quality uploads
   - Visibility **Everyone**
   - Do **not** edit after upload
   - On iOS, upload from **Files**, not Photos

This path usually beats Direct Post for delivered resolution/FPS.

## Secondary: Direct Post (official API)

[/studio](/studio) still supports TikTok Login Kit + Content Posting API (`FILE_UPLOAD`, byte passthrough). TikTok may still re-encode after ingest. Unaudited apps are limited to private / `SELF_ONLY`, which often compresses more.

## Setup

1. (Optional, for Direct Post only) Create an app at [TikTok for Developers](https://developers.tiktok.com/).
2. Copy env:

```bash
cp .env.example .env
```

```env
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
TIKTOK_REDIRECT_URI=http://localhost:5173/auth/tiktok/callback
SESSION_SECRET= # openssl rand -hex 32
```

3. Install & run:

```bash
pnpm install
pnpm run dev
```

Optimize works without TikTok keys. Connect TikTok only if you need Studio Direct Post.

## Architecture

- **Optimize:** browser-only MP4 box rewrite — video bytes never leave the device
- **Direct Post:** OAuth → sealed session → `creator_info` / `video/init` → chunked PUT to TikTok `upload_url`

## Deploy (Netlify)

```bash
pnpm run build
npx netlify deploy --prod
```

Set env vars in Netlify if using Direct Post. Update `TIKTOK_REDIRECT_URI` to the production callback.

## License note

Wash UI is GPL-3.0-or-later; keep distribution terms in mind if you ship this app publicly.

Density-inflate technique follows the publicly documented sample-table approach used by open tools such as [tiktok-quality](https://github.com/BastienGimbert/tiktok-quality) (MIT).
