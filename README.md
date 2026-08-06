# FireWatch NA 🔥

Real-time active wildfire map and dashboard for **Canada, the United States and
Mexico**, built on official government data services. Next.js 16 + TypeScript +
Leaflet + TanStack Query + Tailwind CSS 4, with a Node backend (Next route
handlers) that proxies, caches, validates and rate-limits every upstream feed.

> **Safety notice** — FireWatch NA is an informational aggregator, not an
> emergency alerting service. Data can be delayed or incomplete. Always follow
> local authorities during an emergency.

## Features

- **Live data, no API keys required** for the core experience:
  - 🇺🇸 NIFC **WFIGS** current incidents + interagency fire perimeters
  - 🇨🇦 **CWFIS** (NRCan) national active fires + M3 satellite perimeter estimates
  - 🇲🇽 Satellite thermal detections (CWFIS VIIRS/MODIS feed; NASA FIRMS optional)
  - **NWS** evacuation / fire weather / air-quality alerts (US)
  - **NOAA NDGD** near-surface smoke forecast overlay
  - **RainViewer** live precipitation radar
  - **Open-Meteo** air quality (US AQI, PM2.5/PM10 + 24 h outlook) and spot
    weather (temp, RH, wind, gusts) at each fire
  - **OpenStreetMap** geocoding (Nominatim) and fire stations (Overpass)
- Interactive Leaflet map: road / satellite / terrain / hybrid base layers,
  smooth zoom & pan, full-screen, geolocate, scale bar, marker clustering
  (cluster colour = worst contained status inside), perimeter polygons,
  hotspots, legend
- Colour coding: green contained · yellow under control/being held · orange
  active · red out of control · purple evacuation ring · blue prescribed
  burns / satellite detections — always paired with text labels
- Detail panel per fire: size (ha + acres), containment, status, cause,
  discovery & update times, behaviour, personnel, agency link, county/region,
  coordinates, live AQI and weather
- Dashboard: totals, by-country and by-province/state breakdowns, area burned,
  started/contained today, evacuation count, largest fires, recently updated
- Filters: country, province/state, status, agency, min size, containment
  range, discovery window, evacuation-only
- **Fire-affected highways**: major roads (OSM motorway/trunk/primary) near
  large active fires, classified **impacted** (crosses a fire perimeter,
  solid red) or **at risk** (near an active fire, dashed amber), listed on
  the dashboard and searchable by name/ref — clearly labelled as derived data
- **Official road closures (511)**: DriveBC (Open511), Alberta 511 and
  Ontario 511 events, filtered to fire-related or fire-adjacent, shown as
  map markers with full descriptions — registry-extensible to more states
  and provinces (most US 511 systems share the same v2 schema)
- Interactive dashboard: every stat tile, status chip, country and province
  row applies the matching filter and jumps to the list; a status
  distribution bar, a "roads affected" tile, "find fires near me"
  (distance-sorted, geolocation stays in-browser), animated counters and
  smooth tab transitions — all disabled under `prefers-reduced-motion`
- Search: highways and closures (instant, local) plus address / city /
  province / state / postal code via Nominatim, plus direct coordinate entry
  (`49.28, -123.12`, `49.28N 123.12W`)
- Auto-refresh (default 5 min, user-configurable 1–30 min) + SSE push: the
  server broadcasts a `fires` event whenever its cache refreshes, so open
  clients update immediately
- Light / dark / system themes + a dedicated high-contrast mode
- Accessibility (WCAG 2.2 AA targets): keyboard operability, combobox search
  with listbox semantics, live-region announcements, skip link, visible focus,
  reduced-motion support, text-labelled statuses, and a fully accessible fire
  list as the screen-reader alternative to the map canvas
- Performance: server-side TTL caching with stale-while-error, request
  coalescing, marker clustering with chunked loading, canvas-rendered
  hotspots, lazy-loaded map bundle, zoom-gated Overpass queries, HTTP cache
  headers

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — works without any keys
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t firewatch-na .
docker run -p 3000:3000 --env-file .env.local firewatch-na
```

The image is a multi-stage build on `node:24-alpine`, runs as a non-root user,
uses Next.js standalone output, and ships a container healthcheck hitting
`/api/health`.

### Tests

```bash
npm test        # vitest: unit + route/integration tests (37 tests)
npm run typecheck
npm run lint
```

## Architecture

```
Browser ── Leaflet map + React UI (TanStack Query polling + SSE push)
   │  connect-src 'self' — all data flows through our origin
   ▼
Next.js route handlers (Node runtime)
   ├─ /api/fires        merged unified Fire records (WFIGS + CWFIS + MX detections)
   ├─ /api/perimeters   US (WFIGS) & Canada (CWFIS M3) GeoJSON, simplified
   ├─ /api/hotspots     VIIRS/MODIS detections (CWFIS, or FIRMS when keyed)
   ├─ /api/alerts       NWS evacuation / fire / red-flag / AQ alerts
   ├─ /api/stats        live dashboard aggregates
   ├─ /api/air /api/weather   Open-Meteo point lookups (cached per coordinate)
   ├─ /api/geocode      Nominatim proxy (1 req/s politeness + 1 h cache)
   ├─ /api/stations     OSM Overpass fire stations (bbox-gated, 24 h cache)
   ├─ /api/smoke        NOAA NDGD smoke exportImage proxy
   ├─ /api/radar        RainViewer frame index
   ├─ /api/owm/* /api/waqi/*  key-gated tile proxies (keys stay server-side)
   ├─ /api/roads        fire-affected highways (Overpass + perimeter tests)
   ├─ /api/closures     official 511/Open511 road events near fires
   ├─ /api/stream       Server-Sent Events (`fires` refresh notifications)
   ├─ /api/config       which optional layers are enabled
   └─ /api/health       liveness + cache state
```

Shared server infrastructure: TTL cache with stale-while-error and in-flight
coalescing (`src/lib/server/cache.ts`), token-bucket rate limiter per IP+route
group (`src/lib/server/rateLimit.ts`), zod validation on every query
parameter, timeouts on every upstream call.

### Adding another agency feed

`src/lib/server/fires.ts` holds a `FIRE_SOURCES` registry. Add one entry:

```ts
{ id: "bc-wildfire", label: "BC Wildfire Service", fetcher: fetchBcFires }
```

where `fetcher` returns unified `Fire` records (`src/lib/types.ts`). Merging,
stats, filtering, clustering, and the UI pick it up automatically. Health of
each source is reported per-request in `sources[]` and surfaced in the header.

### Status mapping (documented in-app)

- Canada reports stage of control directly: `OC` → out of control, `BH` →
  being held, `UC` → under control, `EX/OUT` → contained.
- The US reports percent containment; we derive: 100 % contained · ≥70 %
  under control · ≥30 % active · <30 % out of control (uncontained).
- Prescribed burns (`RX`) are blue; Mexican records are satellite detections
  (information only). Purple rings mark fires inside active NWS evacuation
  polygons.

## Security

- **CSP**: `default-src 'self'`; `connect-src 'self'` (no third-party calls
  from the browser); tile CDNs allow-listed under `img-src` only.
  (`'unsafe-inline'` script/style is required by Next.js bootstrap and
  Leaflet; `'unsafe-eval'` is enabled in development only.)
- `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`,
  `Referrer-Policy`, `Permissions-Policy` (geolocation self-only), HSTS.
- Input validation with zod on every route; tile coordinates and bboxes are
  range-checked; Overpass queries are size-capped.
- Rate limiting per IP and route group (60–240 req/min; 429 + `Retry-After`).
  In-memory per instance — put a shared store (Redis) behind
  `src/lib/server/rateLimit.ts` for multi-instance deployments.
- API keys (FIRMS/OWM/WAQI) live server-side only and are never sent to the
  browser; tiles are proxied.
- No database and no personal data stored server-side (nothing to inject;
  parameterize queries if you add persistence). Authentication is not
  required for a public read-only app; if you need it, Auth.js drops into
  Next 16 route handlers without touching the data layer.

## Privacy & legal

- No cookies, no analytics, no tracking. Geolocation runs only on user
  request and never leaves the browser. Preferences live in `localStorage`.
  This keeps the app consent-banner-free under GDPR / CCPA / PIPEDA.
- Data licences and attribution are listed on the in-app **About & data**
  page and rendered in the map attribution control: US federal data (public
  domain), CWFIS © NRCan under the Open Government Licence – Canada, OSM ©
  OpenStreetMap contributors (ODbL), Esri imagery, OpenTopoMap (CC-BY-SA),
  Open-Meteo (CC-BY 4.0), RainViewer, NOAA, NASA FIRMS acknowledgement.
- Set `UPSTREAM_USER_AGENT` to a real contact — Nominatim's usage policy
  requires it, and it identifies you politely to every upstream provider.

## Launch assets

- **CI**: `.github/workflows/ci.yml` runs lint, type-check, tests, the
  production build and a Docker build on every push/PR.
- **Deploy configs**: `render.yaml` (Render blueprint), `fly.toml` (Fly.io),
  `docker-compose.yml` (any VPS) — all wired to the `/api/health` check.
- **SEO/PWA**: canonical metadata + OpenGraph image, `robots.txt`,
  `sitemap.xml`, web manifest and a flame favicon are generated by the app
  router; set `NEXT_PUBLIC_SITE_URL` to your public URL.
- **Error surfaces**: branded 404 and error-boundary pages.
- **Legal**: the About page carries data licences/attribution, a privacy
  statement, terms of use, and the derived-data disclaimer for the roads
  layer.

## Deployment notes

- Any Node 20+ host works: `npm run build && npm start`, the Docker image, or
  a PaaS. Behind a reverse proxy, forward `X-Forwarded-For` so rate limiting
  sees real client IPs, and terminate TLS (HSTS header is already sent).
- Serverless platforms: API routes are stateless and work, but the in-memory
  cache/SSE loop assume a long-lived process — on serverless, expect more
  upstream fetches (or wire the cache interface to Redis/KV).
- The SSE endpoint (`/api/stream`) needs response streaming (disable proxy
  buffering; `X-Accel-Buffering: no` is already set).

## Known limitations (honest by design)

- **Mexico** has no public machine-readable incident feed; we show satellite
  detections labelled as such, with links to CONAFOR's official reports.
- **Canadian evacuation orders** are issued per-province/municipality with no
  unified feed; the purple evacuation flag currently covers US NWS alerts.
  Provincial feeds can be added via the source registry.
- Wind/temperature/AQI *map tiles* and FIRMS hotspots need free keys (see
  `.env.example`); per-fire wind, temperature and AQI numbers work keyless.
- Road closures, highway cameras and shelters have no continent-wide open
  feeds; regional 511/ArcGIS feeds can be added as layers via the registry.
- Leaflet does not support map rotation; a compass rose is therefore omitted.
