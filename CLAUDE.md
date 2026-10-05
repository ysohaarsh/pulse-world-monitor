@AGENTS.md

# Pulse — project conventions

Real-time world events dashboard (mini World Monitor). Next.js 16 App Router + Supabase + Leaflet, deployed on Vercel.
Note: Next 16 renamed `middleware.ts` → `proxy.ts`, and `cookies()`/`params` are async.

## Commands
- `npm run dev` / `npm run build`
- `npm run lint && npm run typecheck && npm test` — must pass before any commit

## Architecture
- `lib/types.ts` — **shared contract** (`NormalizedEvent`, `Category`, `Source`). Don't change it without coordinating; every module depends on it.
- `lib/categories.ts` — category labels/colors. Map, feed and stats must use these.
- `lib/supabase/{client,server,admin}.ts` — browser / per-request server / service-role clients. Never import `admin` in client code.
- `supabase/migrations/` — schema. New changes go in a new timestamped migration file, never edit applied ones.
- Ingestion: `lib/ingest/<source>.ts` implements `Ingester` (`fetchRaw` + pure `normalize`). `lib/ingest/run.ts` upserts on `(source, external_id)`. `POST /api/ingest` (Bearer `CRON_SECRET`) is called by Supabase pg_cron.

## Module ownership (for parallel agents — stay inside your folders)
| Agent | Owns |
|---|---|
| ingest-<source> (usgs, eonet, gdelt, rss, gdacs, who, sports) | `lib/ingest/<source>.ts`, `lib/ingest/<source>.test.ts`, `lib/ingest/__fixtures__/<source>.*` |
| ui-map | `components/map/**`, map half of `app/page.tsx` |
| ui-feed | `components/feed/**`, feed half of `app/page.tsx`, `lib/events/**` (queries + realtime hook) |
| ui-insights | `app/stats/**`, `app/brief/**`, `components/stats/**` |
| ai-brief | `lib/brief/**`, `app/api/brief/**` |
| auth | `app/login/**`, `app/auth/**`, `app/watchlists/**`, `components/auth/**`, `components/nav.tsx` |

If you truly need to touch a shared file (`lib/types.ts`, `package.json`, `app/layout.tsx`), keep the change minimal and mention it in your summary.

## Style
- Dark UI; use the theme tokens in `app/globals.css` (`bg-surface`, `border-border`, `text-muted`, `text-accent`), not raw hex.
- Server Components by default; add `"use client"` only where needed (the map must be client-only, load via `next/dynamic` with `ssr: false`).
- Map: MapLibre GL v6 globe + OpenFreeMap vector tiles (keyless), style in `components/map/pulse-style.ts`. Its worker is served from `public/maplibre/` (copied by `scripts/copy-maplibre-worker.mjs` in `predev`/`prebuild`; gitignored) — don't import the worker through the bundler.
- Validate external API payloads with zod inside `normalize`; skip bad items instead of throwing.
- Tests: Vitest, colocated `*.test.ts`, run against saved fixtures — no network in unit tests.

## Status (2026-10-05) — read this first in a new session
Live: https://pulse-world-monitor.vercel.app (Vercel auto-deploys `main`). Repo: github.com/ysohaarsh/pulse-world-monitor (public).
Supabase project `ckhzvkfkmpuenmfvipew`; pg_cron jobs `pulse-ingest` (10 min), `pulse-brief` (00:15 UTC), `pulse-prune`; app URL + cron secret live in Supabase Vault (`pulse_app_url`, `pulse_cron_secret`) and Vercel env (sensitive). Never print/read production secrets — ask the user to copy them (pbcopy).
Sources: usgs, eonet, gdelt (15-min export files, not the DOC API), rss (15 feeds with AllSides lean in `lib/media-lean.ts`), gdacs, who, sports (opt-in, hidden by default; the World Brief gives it its own closing `## Sports` section + a "Sports in this period" panel, never counted in core stats).
Git author must stay the GitHub noreply address.

### Open items
1. GDELT quality: `categorize()` forces non-hazard titles to conflict/politics (e.g. economy stories → conflict); GDELT geocoder mixes same-name places (Georgia US → Austria). Consider carrying over classify() economy/politics and dropping events whose country isn't mentioned in the title.
2. AI brief: Groq retired `llama-3.3-70b-versatile` on free tier (2026-08-16). Switch default to `openai/gpt-oss-120b` (raise max_tokens ~2000 or reasoning_effort "low"), add ordered fallback provider (Cloudflare Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`), surface when brief falls back to "extractive". User must add LLM_API_KEY in Vercel.
3. Password reset links only work in the requesting browser (PKCE). For cross-device: Supabase "Reset Password" email template → `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">`.
4. Dependabot: npm semver-majors are ignored in `.github/dependabot.yml` (TS 7 needs deps that accept it; ESLint 10 breaks `eslint-config-next`'s react plugin; `@types/node` should track the runtime Node, CI uses 22). Upgrade majors deliberately and remove the ignore when ready.
5. Before real users: custom SMTP in Supabase Auth; consider CAPTCHA on signup.
6. Rows ingested before the lean change have no `#publisher=` fragment → no lean badge until re-fetched (self-heals).
