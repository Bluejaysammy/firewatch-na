# Contributing to FireWatch NA

## Development setup

```bash
npm install          # Node 24 (see .nvmrc)
cp .env.example .env.local   # optional — the app runs fully keyless
npm run dev          # http://localhost:3000
```

Quality gates (all must pass; CI runs them on every PR):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Where things live

- `src/lib/types.ts` — the unified `Fire` record and shared types
- `src/lib/server/sources/` — one file per upstream data provider
- `src/lib/server/fires.ts` — the fire-source registry + merge/stats
- `src/app/api/*` — route handlers (zod-validated, cached, rate-limited)
- `src/components/` — UI; `map/MapView.tsx` holds all Leaflet layers
- `tests/` — Vitest unit + route tests

## Adding a data source (the most useful contribution)

1. **Fires**: add a fetcher returning `Fire[]` and register it in
   `FIRE_SOURCES` (`src/lib/server/fires.ts`).
2. **Road closures**: no code needed for 511/Open511 feeds — set the
   `EXTRA_511_SOURCES` env var. New schema families go in
   `src/lib/server/sources/closures.ts`.
3. **Evacuation zones**: add a fetcher returning `EvacZone[]` in
   `src/lib/server/sources/evac.ts` (`EVAC_SOURCES` registry).

Ground rules for sources: official/public feeds only, keyless preferred
(key-gated behind env vars otherwise), always attribute in `NOTICE.md` and
the About page, respect upstream rate limits via the shared cache, and never
fabricate or interpolate data — derived data must be labelled as derived.

## Style

- TypeScript strict; no `any` unless unavoidable.
- Server code imports `server-only`; keep pure logic in `src/lib/` so it's
  testable without mocking.
- Accessibility is a requirement, not polish: text labels beside colours,
  keyboard operability, ARIA on interactive elements.
- Match the existing comment style: comments explain constraints, not
  restate code.
