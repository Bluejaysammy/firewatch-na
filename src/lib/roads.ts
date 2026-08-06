import {
  bboxOverlaps,
  geometryBbox,
  haversineKm,
  pointInGeometry,
  type GeoJsonGeometry,
} from "./geo";
import type { AffectedRoad, RoadThreatLevel } from "./types";

export interface OverpassWay {
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export interface CandidateFire {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface ClassifiedRoads {
  roads: AffectedRoad[];
  segments: { type: "FeatureCollection"; features: unknown[] };
}

/**
 * Classify OSM highway ways found near active fires:
 * - "impacted"  — the road crosses a mapped/estimated fire perimeter
 * - "at_risk"   — the road is within the query radius of a large active fire
 *
 * Derived data (documented in the UI): perimeter intersection is tested by
 * sampling way vertices against perimeter polygons, pre-filtered by bbox.
 */
export function classifyRoads(
  ways: OverpassWay[],
  perimeters: GeoJsonGeometry[],
  fires: CandidateFire[]
): ClassifiedRoads {
  const perims = perimeters.map((geom) => ({ geom, bbox: geometryBbox(geom) }));

  interface Group {
    ref: string | null;
    name: string | null;
    level: RoadThreatLevel;
    lat: number;
    lon: number;
    segments: number;
  }
  const groups = new Map<string, Group>();
  const features: unknown[] = [];

  for (const way of ways) {
    const pts = way.geometry ?? [];
    if (pts.length < 2) continue;
    const ref = way.tags?.ref?.trim() || null;
    const name = way.tags?.name?.trim() || null;
    if (!ref && !name) continue;

    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const p of pts) {
      if (p.lon < w) w = p.lon;
      if (p.lon > e) e = p.lon;
      if (p.lat < s) s = p.lat;
      if (p.lat > n) n = p.lat;
    }
    const wayBbox: [number, number, number, number] = [w, s, e, n];
    const nearby = perims.filter((p) => bboxOverlaps(wayBbox, p.bbox));

    let level: RoadThreatLevel = "at_risk";
    if (nearby.length > 0) {
      const step = Math.max(1, Math.floor(pts.length / 20));
      outer: for (let i = 0; i < pts.length; i += step) {
        for (const p of nearby) {
          if (pointInGeometry(pts[i].lon, pts[i].lat, p.geom)) {
            level = "impacted";
            break outer;
          }
        }
      }
    }

    const key = (ref ?? name ?? "").toUpperCase();
    const mid = pts[Math.floor(pts.length / 2)];
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ref, name, level, lat: mid.lat, lon: mid.lon, segments: 1 });
    } else {
      existing.segments += 1;
      if (level === "impacted" && existing.level !== "impacted") {
        existing.level = "impacted";
        existing.lat = mid.lat;
        existing.lon = mid.lon;
      }
    }

    features.push({
      type: "Feature",
      properties: { ref, name, level, roadKey: key },
      geometry: {
        type: "LineString",
        coordinates: pts.map((p) => [
          Math.round(p.lon * 1e5) / 1e5,
          Math.round(p.lat * 1e5) / 1e5,
        ]),
      },
    });
  }

  const roads: AffectedRoad[] = [];
  for (const [key, g] of groups) {
    let nearest: CandidateFire | null = null;
    let nearestKm = Infinity;
    for (const f of fires) {
      const d = haversineKm(g.lat, g.lon, f.lat, f.lon);
      if (d < nearestKm) {
        nearestKm = d;
        nearest = f;
      }
    }
    roads.push({
      key,
      label: g.ref && g.name ? `${g.ref} (${g.name})` : (g.ref ?? g.name ?? key),
      ref: g.ref,
      name: g.name,
      level: g.level,
      fireId: nearest?.id ?? null,
      fireName: nearest?.name ?? null,
      distanceKm: nearest ? Math.round(nearestKm * 10) / 10 : null,
      lat: g.lat,
      lon: g.lon,
      segments: g.segments,
    });
  }

  roads.sort((a, b) => {
    if (a.level !== b.level) return a.level === "impacted" ? -1 : 1;
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
  });

  return { roads, segments: { type: "FeatureCollection", features } };
}

/** Fire-related keyword test shared by the closures pipeline and tests. */
export function isFireRelatedText(text: string): boolean {
  return /\b(wild)?fire|smoke|burn(ed|ing)?\s+area/i.test(text);
}
