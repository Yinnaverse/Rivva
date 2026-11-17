# Rivva

Watch together. Even when apart. A mobile-first web app (Next.js, installable as a PWA) on Supabase.

## One-time Supabase setup
1. Supabase dashboard → SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. Authentication → Sign In / Providers → turn on "Allow anonymous sign-ins" (powers Continue as Guest).
3. While developing, optionally turn off "Confirm email" (Email provider) so sign-up works instantly.

4. SQL Editor → new query → paste `supabase/phase4.sql` → Run (videos, subtitles, synced playback, private storage bucket).
5. SQL Editor → new query → paste `supabase/phase5.sql` → Run (saved videos, delete-my-account).
6. SQL Editor → new query → paste `supabase/phase6.sql` → Run (pause the room while someone buffers).
7. SQL Editor → new query → paste `supabase/phase7.sql` → Run (usernames, friends, room invites).
8. SQL Editor → new query → paste `supabase/phase8.sql` → Run (notifications).
9. Authentication → URL Configuration: Site URL = your live address; add `<your address>/**` under Redirect URLs (needed for password-reset links).

## Run it
    npm install
    npm run dev      # http://localhost:3000 — open on your phone via your LAN IP

`.env.local` already holds the project URL and publishable key (both safe to expose). Never put the secret/service-role key in this app.

## Status
- Done: shell, tokens (dark + light), Home, Explore, real auth (email + guest)
- Done: rooms (create, join by code, lobby with chat, presence, host settings)
- Done: Choose Content (upload a file, paste an https link, shared library), synced watch screen (play/pause/seek sync, personal volume, personal subtitles, reactions, room chat, landscape)
- Done: Home/Explore show real shared videos, heart to save, Saved page, Settings (name, dark/light/system theme, download my data, clear device choices, delete account, logout)
- Done: usernames, friend requests (accept / decline / remove), a copyable friend link, inviting friends into a room, invites shown on Home (friends need a full account, not a guest)
- Done: forgot / reset password, change password in Settings, menu drawer, bell with unread count and a notifications page, back buttons, 404 and error pages
- Done: in-app notifications (friend requests, accepts, invites, movie started) plus browser alerts while Rivva is open in a tab or installed app
- Not built: alerts while Rivva is fully closed (needs a push server), avatar upload, language, streaming-service linking

- Done: uploads show live progress with Cancel, and files over 50 MB are rejected up front
- Done: the room pauses for everyone when one person's video stalls, then resumes together (max wait 20s)

## How sync works
The host (or anyone, when "Sync controls" is on) sends play/pause/seek to the database; every device receives it over Realtime and works out where the movie should be using a server clock offset (re-measured every minute, and play/seek positions are sent half a round trip ahead). Small drift is fixed by nudging playback speed by up to 8% (no jump); only drift over 2.5s causes a seek. Volume and subtitles never leave your device.

Troubleshooting: in the watch screen open the gear, then "Sync info" → Showing. It prints drift, speed, buffering, clock offset and round trip.

## Limits to know
- Free Supabase plan: 50 MB per uploaded file. For longer films, upgrade and raise the limit, or paste a direct https link to an MP4/WebM instead.
- Browsers play MP4 (H.264/AAC) and WebM. MKV and AVI usually won't play; convert them (e.g. HandBrake).
- Netflix and other streaming apps can't be synced inside another app.

## Your real logo
In Figma, select the "Yinnaverse" vector on the Home screen (node 366:201), export it as SVG, and save it as `public/logo.svg`. The app picks it up automatically (header and login). Until then it shows a placeholder.

## Notes
- Tokens live in `src/app/globals.css`; light theme is `[data-theme='light']`.
- Movie posters and avatars are placeholders. The logo is a placeholder until you add `public/logo.svg` (see above).
