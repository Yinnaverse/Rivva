# Rivva

Watch together. Even when apart. A mobile-first web app (Next.js, installable as a PWA).

## Run it
    npm install
    npm run dev      # http://localhost:3000 — open on your phone via your LAN IP

## Status
- Phase 1 (done): app shell, design tokens (dark + light), bottom nav, shared components
- Phase 2 (done): Home, Explore, Login, Sign up (auth is a stub that routes home; Google/Apple disabled until Supabase)
- Next: Rooms + lobby + chat (Supabase), synced watch screen, uploads, settings

## Notes
- Tokens live in `src/app/globals.css`; light theme is `[data-theme='light']`.
- Posters and avatars are placeholders (no licensed artwork).
- The header logo is a placeholder; export the real mark from Figma into `public/` and swap it in `AppHeader.tsx`.
