# Rivva

Watch together. Even when apart. A mobile-first web app (Next.js, installable as a PWA) on Supabase.

## One-time Supabase setup
1. Supabase dashboard → SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. Authentication → Sign In / Providers → turn on "Allow anonymous sign-ins" (powers Continue as Guest).
3. While developing, optionally turn off "Confirm email" (Email provider) so sign-up works instantly.

4. SQL Editor → new query → paste `supabase/phase4.sql` → Run (videos, subtitles, synced playback, private storage bucket).
5. SQL Editor → new query → paste `supabase/phase5.sql` → Run (saved videos, delete-my-account).

## Run it
    npm install
    npm run dev      # http://localhost:3000 — open on your phone via your LAN IP

`.env.local` already holds the project URL and publishable key (both safe to expose). Never put the secret/service-role key in this app.

## Status
- Done: shell, tokens (dark + light), Home, Explore, real auth (email + guest)
- Done: rooms (create, join by code, lobby with chat, presence, host settings)
- Done: Choose Content (upload a file, paste an https link, shared library), synced watch screen (play/pause/seek sync, personal volume, personal subtitles, reactions, room chat, landscape)
- Done: Home/Explore show real shared videos, heart to save, Saved page, Settings (name, dark/light/system theme, download my data, clear device choices, delete account, logout)
- Not built (needs backend work): Friends, notifications, avatar upload, language, streaming-service linking, wait-for-everyone buffering

## How sync works
The host (or anyone, when "Sync controls" is on) sends play/pause/seek to the database; every device receives it over Realtime, works out where the movie should be using a server clock offset, and nudges itself back if it drifts more than ~0.75s. Volume and subtitles never leave your device.

## Limits to know
- Free Supabase plan: 50 MB per uploaded file. For longer films, upgrade and raise the limit, or paste a direct https link to an MP4/WebM instead.
- Browsers play MP4 (H.264/AAC) and WebM. MKV and AVI usually won't play; convert them (e.g. HandBrake).
- Netflix and other streaming apps can't be synced inside another app.

## Notes
- Tokens live in `src/app/globals.css`; light theme is `[data-theme='light']`.
- Movie posters and avatars are placeholders. The header logo is a placeholder: export the real mark from Figma into `public/` and swap it in `src/components/Logo.tsx`.
