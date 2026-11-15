# Rivva

Watch together. Even when apart. A mobile-first web app (Next.js, installable as a PWA) on Supabase.

## One-time Supabase setup
1. Supabase dashboard → SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. Authentication → Sign In / Providers → turn on "Allow anonymous sign-ins" (powers Continue as Guest).
3. While developing, optionally turn off "Confirm email" (Email provider) so sign-up works instantly.

## Run it
    npm install
    npm run dev      # http://localhost:3000 — open on your phone via your LAN IP

`.env.local` already holds the project URL and publishable key (both safe to expose). Never put the secret/service-role key in this app.

## Status
- Done: shell, tokens (dark + light), Home, Explore, Login/Sign up/Guest (real Supabase auth)
- Done: create room, join by code, rooms list, lobby (editable title/description, private toggle, copy/share code, live chat, live participants + online presence, host-only room settings)
- Next: synced watch screen, uploads + shared library, saved, settings (theme switch), light-mode polish

## Notes
- Tokens live in `src/app/globals.css`; light theme is `[data-theme='light']`.
- Movie posters and avatars are placeholders. The header logo is a placeholder: export the real mark from Figma into `public/` and swap it in `src/components/Logo.tsx`.
- "Choose Content & Start watching" is not wired yet (next phase).
