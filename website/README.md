# HitLit Website

The web version of the HitLit app: same Supabase backend, same features, same design system. It is a Vite + React + TypeScript + Tailwind single-page app.

## How it relates to the mobile app

The website **does not copy the app's business logic. It imports it.** Everything under `../src/lib`, `../src/hooks`, `../src/store`, `../src/types` and `../src/constants` (Supabase queries, React Query hooks, Zustand stores, scoring engines, validation, error messages) runs unchanged on the web, through the `@app/*` alias. A fix made there reaches both the app and the website.

A few app files use native-only APIs: AsyncStorage-backed auth, native Google/Apple sign-in, the image picker, share sheets, GPS and NetInfo. Each of those has a web version at the same relative path under `src/platform/overrides/`. The `hitlit-app-bridge` plugin in `vite.config.ts` swaps them in at build time, the same way React Native's `.web.ts` files work, without touching the app's folder.

| Folder | What it holds |
| --- | --- |
| `src/platform/overrides/` | Web versions of native-only app files (same exports) |
| `src/platform/shims/` | Tiny stand-ins for `react-native`, AsyncStorage and icon types |
| `src/components/` | Web UI ported from the app's components (cards, alert dialog, skeletons…) |
| `src/pages/` | One page per app screen |
| `src/routes/` | Session, onboarding and role gate (mirrors `RootNavigator`), URL map, tab state |
| `scripts/` | `sync-paths` (tsconfig ↔ overrides), `gen-icons` (icon registry), `optimize-images` |

**Rules for new code:** import shared logic from `@app/...`, never copy it. If a shared file needs a native API, add a web override with the **same exports**; `npm run prepare` maps it for TypeScript automatically.

## Setup

```bash
cd website
cp .env.example .env    # fill in VITE_SUPABASE_ANON_KEY (same as the app's EXPO_PUBLIC_SUPABASE_ANON_KEY)
npm install             # also runs `prepare`: tsconfig paths, icon registry, optimized images
npm run dev             # http://localhost:5173
npm run build           # type-check + production build into dist/
```

### Supabase / Google configuration needed for web sign-in

The app signs in with native ID tokens. The website uses Supabase's OAuth **redirect** flow, which needs:

1. **Supabase → Authentication → URL Configuration → Redirect URLs:** add `http://localhost:5173/auth/callback` and the production URL, e.g. `https://hitlit.pk/auth/callback`.
2. **Supabase → Authentication → Providers → Google:** the *Web* OAuth client's **Client ID and Client Secret** must be filled in.
3. **Google Cloud Console → that Web OAuth client → Authorized redirect URIs:** `https://gexddahyiaphsjevsnng.supabase.co/auth/v1/callback`.
4. *(Optional)* **Sign in with Apple on the web:** configure an Apple Services ID in Supabase, then set `VITE_ENABLE_APPLE_SIGNIN=true`.

## Deploying

The site is a static build (`dist/`). It needs the parent folder at build time, because it imports `../src` and `../assets`, so deploy from the repo with **root directory = `website`**. SPA fallback and headers are already set up for Vercel (`vercel.json`) and Netlify/Cloudflare Pages (`public/_redirects`, `public/_headers`).

`public/.well-known/` holds the app's deep-link files (from `deep-link-setup/`). Hosting the site on `hitlit.pk` therefore also serves them, once their placeholders are filled in (see `../deep-link-setup/README.md`).

## Feature flags

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_ENABLE_APPLE_SIGNIN` | `false` | Show "Sign in with Apple" (needs Apple web OAuth in Supabase). |
| `VITE_ENABLE_ONLINE_BOOKING` | `false` | Make courts bookable (slot picker → checkout → confirmation). **It is off in the app today:** courts are info-only and players book through the venue's WhatsApp or phone. Turn it on together with the app. |

## Phases

1. ✅ **Foundation:** shared-logic bridge, design system, auth (Google OAuth), onboarding, role gate, responsive shell, Home, privacy page
2. ✅ **Venues and booking:** venues list (search, Location, Sports, Distance and Price filters, all kept in the URL), venue detail (gallery, maps link, hours, WhatsApp/call booking, facilities, amenities, courts), My Bookings. The in-app slot picker → checkout → confirmation flow is ported too, behind `VITE_ENABLE_ONLINE_BOOKING` (see below).
3. ✅ **Community:** community hub and chat (posts, replies, comment threads, mentions, polls, likes, report/block), notifications, Top Players and player profiles, games and tournaments (list, create, detail, join requests, invites, teams, fixtures and the tournament dashboard), game/team/group chats, and Groups (list with filters, detail with captain/host management, create). The app's Edit Game and Edit Group screens are registered but nothing navigates to them, so they are not ported.
4. ✅ **Scorecard:** the hub plus all seven sports — each sport's match list (All / Live / Completed / View Scoring by code), New Match (with tournament prefill and Add From a Group) and live scoring: Padel, Tennis, Pickleball, Badminton and Table Tennis point/rally scoring, Football (match clock, stop/start time, end-of-half alarm, scorers, extra time, penalties) and the cricket Match Centre (full keypad, extras, every dismissal incl. run out / stumped, More menu with abandon, end innings, penalty, retired hurt, D/L, change target, Last Man Stand, and the Summary / Scorecard / Stats / Super Stars / Balls / Info tabs). Offline scoring queue, PDF match reports, the cricket summary share image, and Manual Score for tournament fixtures. The app's old Full Scorecard screen is unreachable there (the Match Centre's Scorecard tab replaced it), so it is not ported separately.
5. ✅ **Profile:** your own profile (avatar upload, copyable ID, member since, followers, stat cards with the sport filter and the nine per-sport tabs, jersey card), Account Settings (display name, jersey number, profile visibility, Blocked Users, type-DELETE account deletion, sign out) and Blocked Users (view, unblock). My Bookings stays unlinked from settings, as in the app.
6. ✅ **Admin:** venue owners get My Venues and a full venue dashboard (venue switcher, today's revenue and stat cards, today's schedule with the hour-by-hour view, revenue chart, upcoming bookings, top venues, recent notifications) and the venue menu (a sidebar on desktop, full-screen on phones): Edit Venue Details (hours, contacts, maps link, facilities), Sports & Courts (add/edit courts, peak-hour price rules, surface, amenities, court photos, block/unblock slots), Venue Photos, Bookings (sport filter, date/range calendar, CSV export), AI Analytics, Reviews (public replies), Notifications, Boost Venue ("coming soon", as in the app) and Manage Admins for the primary owner. Superadmins get Venues (search, create, delete, assign or remove the owner, extra admins, open any venue's dashboard), Games, Squads, Events (delete any), Reports (remove content, eject user, dismiss) and Users (eject/reactivate). Note: short `maps.app.goo.gl` links can't be expanded in the browser (CORS), so the website asks for the full Google Maps link instead.
7. ✅ **App sync (November 2026 pull, 156 commits):** every change in the app's `main` branch is mirrored:
   - **Light/dark theme:** the app now defaults to dark. Colors live as CSS variables in `src/theme.css`, and Tailwind reads them, so a single `ThemeRoot` switches the whole site. The Home switch saves the choice (`jazba.theme.preference`), and it applies before the first paint.
   - **New gates:** Account Suspended (checked first), then Accept Terms (scroll to unlock), in the same order as the app.
   - **Events:** explore, host, details, join requests and event chat.
   - **Team challenges:** challenge a team, my challenges, challenge details and fixtures, with scoring started from a fixture.
   - **Squads:** Team/Club squads with team tabs (Overview, Players, Matches, Tournaments, Statistics, Compare), Add by ID and Training Camps.
   - **Games:** the MANUAL tournament format (team statuses, stages, final limit), co-hosts, Add Team, select scorer, and generated game/squad icons.
   - **Creating things:** a map location picker for games and squads.
   - **Other:** the redesigned Home, Community, Notifications (with in-app banners) and Scorecard hubs, the Help & User Guide, report/block on comments and profiles, and the objectionable-content filter.

   Push notifications have no web equivalent: the in-app banner shows new notifications while the site is open.
8. Polish: SEO, performance, PWA, accessibility pass, deployment
