import "server-only";
import { fetchUpstream } from "../http";
import { cached } from "../cache";
import { getFires } from "../fires";
import { fetchUsPerimeters } from "./wfigs";
import { fetchCaPerimeters } from "./cwfis";
import { classifyRoads, type CandidateFire, type OverpassWay } from "@/lib/roads";
import type { GeoJsonGeometry } from "@/lib/geo";
import type { Fire, RoadsResponse } from "@/lib/types";

const PERIM_TTL_MS = Number(process.env.PERIMETERS_TTL_SECONDS ?? 300) * 1000;

const ACTIVE = new Set(["out_of_control", "active", "being_held"]);

/** Fires large or dangerous enough to check highways around. */
export function candidateFires(fires: Fire[]): Fire[] {
  return fires
    .filter(
      (f) =>
        ACTIVE.has(f.status) && ((f.sizeHa ?? 0) >= 500 || f.evacuation)
    )
    .sort((a, b) => {
      if (a.evacuation !== b.evacuation) return a.evacuation ? -1 : 1;
      return (b.sizeHa ?? 0) - (a.sizeHa ?? 0);
    })
    .slice(0, 45);
}

function fireBox(f: Fire): [number, number, number, number] {
  // Radius grows with reported size; clamped so boxes stay Overpass-friendly.
  const rKm = Math.min(18, Math.max(5, 3 + Math.sqrt(f.sizeHa ?? 0) / 9));
  const dLat = rKm / 111;
  const dLon = rKm / (111 * Math.max(0.3, Math.cos((f.lat * Math.PI) / 180)));
  return [f.lat - dLat, f.lon - dLon, f.lat + dLat, f.lon + dLon]; // s,w,n,e
}

async function fetchOverpassWays(boxes: [number, number, number, number][]): Promise<OverpassWay[]> {
  const clauses = boxes
    .map(
      ([s, w, n, e]) =>
        `way["highway"~"^(motorway|trunk|primary)$"](${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)});`
    )
    .join("");
  const query = `[out:json][timeout:55];(${clauses});out geom 4000;`;
  const res = await fetchUpstream("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    timeoutMs: 60000,
  });
  const data = (await res.json()) as { elements?: OverpassWay[] };
  return (data.elements ?? []).filter((el) => el.geometry && el.geometry.length > 1);
}

function perimeterGeometries(collection: { features: unknown[] }): GeoJsonGeometry[] {
  const out: GeoJsonGeometry[] = [];
  for (const f of collection.features) {
    const geom = (f as { geometry?: GeoJsonGeometry | null }).geometry;
    if (geom && (geom.type === "Polygon" || geom.type === "MultiPolygon")) out.push(geom);
  }
  return out;
}

async function computeAffectedRoads(): Promise<RoadsResponse> {
  const { value: firesData } = await getFires();
  const candidates = candidateFires(firesData.fires);
  if (candidates.length === 0) {
    return {
      roads: [],
      segments: { type: "FeatureCollection", features: [] },
      computedAt: new Date().toISOString(),
      candidateFires: 0,
    };
  }

  const [ways, perimUs, perimCa] = await Promise.all([
    fetchOverpassWays(candidates.map(fireBox)),
    cached("perimeters:us", PERIM_TTL_MS, fetchUsPerimeters).then(
      (r) => r.value,
      () => ({ type: "FeatureCollection" as const, features: [] })
    ),
    cached("perimeters:ca", PERIM_TTL_MS, fetchCaPerimeters).then(
      (r) => r.value,
      () => ({ type: "FeatureCollection" as const, features: [] })
    ),
  ]);

  const perims = [...perimeterGeometries(perimUs), ...perimeterGeometries(perimCa)];
  const fireRefs: CandidateFire[] = candidates.map((f) => ({
    id: f.id,
    name: f.name,
    lat: f.lat,
    lon: f.lon,
  }));

  const { roads, segments } = classifyRoads(ways, perims, fireRefs);
  return {
    roads,
    segments,
    computedAt: new Date().toISOString(),
    candidateFires: candidates.length,
  };
}

const ROADS_TTL_MS = Number(process.env.ROADS_TTL_SECONDS ?? 600) * 1000;

export async function getAffectedRoads() {
  return cached("roads", ROADS_TTL_MS, computeAffectedRoads);
}
