# Third-party data & software notices

FireWatch NA aggregates data from the sources below. Operating a public
instance requires keeping the attributions shown in the app (map credits and
the About page) intact. This file consolidates the licences for the record.

## Data sources

| Source | Used for | Licence / terms |
|---|---|---|
| NIFC WFIGS (National Interagency Fire Center) | US fire incidents & perimeters | US federal public domain |
| CWFIS © Natural Resources Canada | Canadian fires, M3 perimeters, NA hotspots | [Open Government Licence – Canada 2.0](https://open.canada.ca/en/open-government-licence-canada) |
| NOAA / US National Weather Service | Alerts, smoke forecast | US federal public domain |
| Open-Meteo | Air quality & spot weather | [CC-BY 4.0](https://open-meteo.com/en/license) |
| OpenStreetMap contributors | Road base map, geocoding (Nominatim), highways & fire stations (Overpass) | [ODbL 1.0](https://www.openstreetmap.org/copyright) — attribution required; the derived "fire-affected highways" dataset is a derivative database and inherits ODbL share-alike terms if redistributed |
| OpenTopoMap | Terrain base map | CC-BY-SA |
| Esri, Maxar, Earthstar Geographics | Satellite imagery & hybrid labels | Esri basemap terms (attribution required) |
| RainViewer | Precipitation radar tiles | RainViewer free API terms (attribution required) |
| DriveBC (Open511) | BC road events | BC Open Government Licence |
| Alberta 511 / Ontario 511 | AB/ON road events | Provincial open data terms |
| NASA FIRMS (optional, key-gated) | Hotspot enrichment | "We acknowledge the use of data and imagery from NASA's Fire Information for Resource Management System (FIRMS)" |

Respect the upstream services: keep the built-in caching and rate limits, and
set `UPSTREAM_USER_AGENT` to a reachable contact (required by Nominatim's
usage policy).

## Software

Runtime dependencies (Next.js, React, Leaflet, Leaflet.markercluster,
TanStack Query, zod, Tailwind CSS) and all transitive packages are used under
their respective MIT / ISC / BSD-style licences — the authoritative list is
`package-lock.json`. Leaflet is BSD-2-Clause; Leaflet.markercluster is MIT.
