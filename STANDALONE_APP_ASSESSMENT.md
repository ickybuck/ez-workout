# Standalone App Assessment (ez-workout)

## What you already have

This project is already a strong baseline for a standalone product:

- **Frontend:** React + TypeScript + Vite + Tailwind.
- **Routing and auth flows:** React Router and Supabase auth wiring are present.
- **Backend/data layer:** Supabase is used for database, auth, and migrations.
- **Build pipeline:** Production build succeeds with `vite build`.

## Recommendation: build a PWA first, then native wrapper if needed

### Why this is the best path

For this codebase, the fastest/lowest-risk route to "standalone app" is:

1. **Turn this into a production-quality PWA** (installable on iOS/Android/Desktop).
2. **Deploy on a stable host** (Netlify/Vercel/Cloudflare Pages).
3. **Only add a native shell (Capacitor)** if you need app-store distribution or deeper device APIs.

This lets you ship quickly without rewriting your frontend or backend. You preserve one codebase and keep your Supabase integration largely unchanged.

## Target architecture

- **Client:** Existing React app (same repo).
- **API/Data/Auth:** Existing Supabase project.
- **Hosting:** Static hosting for Vite output + proper SPA redirects.
- **PWA layer:** service worker, web app manifest, app icons, offline fallback.
- **Optional native packaging:** Capacitor wrapper for App Store / Play Store.

## Practical roadmap

## Phase 1 — Production web hardening (1–2 days)

- Add and document required environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Add `.env.example` and deployment notes.
- Confirm auth redirect URLs in Supabase (local + production domains).
- Add Sentry (or equivalent) for runtime error tracking.

## Phase 2 — PWA conversion (1–2 days)

- Add `vite-plugin-pwa`.
- Create manifest (`name`, `short_name`, `theme_color`, icons, display mode).
- Add service worker strategy:
  - cache shell assets
  - network-first for API-driven dynamic screens
  - optional offline UI for last-synced workout history
- Add install prompts and basic "offline" UX messaging.

## Phase 3 — Mobile UX polish (2–4 days)

- Test layout behavior on narrow devices and dynamic viewport heights.
- Improve touch targets and keyboard handling for set entry/timers.
- Validate timer behavior when app is backgrounded.
- Add app icon, splash visuals, and meta tags.

## Phase 4 — Optional app stores via Capacitor (2–5 days)

Only do this if you need:

- discovery in app stores,
- push notifications,
- deeper OS features (background tasks, health integrations, etc.).

Steps:

- Add Capacitor to this existing build output.
- Configure iOS/Android projects.
- Verify Supabase auth redirect/deep-link behavior in native webview.
- Submit builds to TestFlight / Internal Testing.

## Key risks and mitigations

- **Large JS bundle warning (~588 kB):** do route-level lazy loading and split heavy modules.
- **Auth/session edge cases in mobile browsers:** test login/logout/refresh flows on iOS Safari and Android Chrome early.
- **Offline expectations:** be explicit that logging new workouts may require connectivity unless you build an offline queue.
- **Environment drift across staging/prod:** use separate Supabase projects and strict env management.

## Decision framework

Choose this path based on your goal:

- **Need fastest launch + lowest maintenance:** PWA only.
- **Need app-store listing soon:** PWA now, then Capacitor wrapper.
- **Need heavy native integrations:** plan a deeper native strategy later, but still keep this web client as your core UI layer unless requirements fundamentally change.

## Suggested next actions for this repo

1. Add `.env.example` and production deployment README section.
2. Add route-based code splitting for major pages.
3. Add PWA plugin and manifest.
4. Deploy to production domain and configure Supabase auth redirects.
5. Run a mobile QA pass on iOS and Android physical devices.
