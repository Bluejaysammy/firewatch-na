import "server-only";
import { fetchJson } from "../http";
import { cached } from "../cache";
import { getFires } from "../fires";
import { haversineKm } from "@/lib/geo";
import { isFireRelatedText } from "@/lib/roads";
import type { ClosuresResponse, Fire, RoadClosure, SourceHealth } from "@/lib/types";

/**
 * Official road-event feeds (keyless). Two schema families are supported:
 * - Open511 (BC DriveBC)
 * - 511 "v2" (Alberta, Ontario — the common iCone/Castle Rock schema, also
 *   used by many US state 511 systems; add more entries to the registry).
 */

// ---------- Open511 (DriveBC) ----------
interface Open511Event {
  id?: string;
  headline?: string;
  description?: string;
  event_type?: string;
  severity?: string;
  updated?: string;
  geography?: { type?: string; coordinates?: unknown };
  roads?: { name?: string }[];
}

export function normalizeOpen511(
  events: Open511Event[],
  source: string,
  sourceLabel: string
): RoadClosure[] {
  const out: RoadClosure[] = [];
  for (const ev of events) {
    let lat: number | null = null;
    let lon: number | null = null;
    const g = ev.geography;
    if (g?.type === "Point" && Array.isArray(g.coordinates)) {
      [lon, lat] = g.coordinates as [number, number];
    } else if (g?.type === "LineString" && Array.isArray(g.coordinates)) {
      const first = (g.coordinates as [number, number][])[0];
      if (first) [lon, lat] = first;
    }
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const description = ev.description ?? ev.headline ?? "Road event";
    out.push({
      id: `${source}-${ev.id ?? out.length}`,
      source,
      sourceLabel,
      road: ev.roads?.[0]?.name ?? null,
      description,
      lat,
      lon,
      eventType: ev.event_type ?? null,
      severity: ev.severity ?? null,
      fullClosure: /closed|closure/i.test(description),
      updated: ev.updated ?? null,
      fireRelated: isFireRelatedText(description),
      nearestFireKm: null,
      nearestFireName: null,
    });
  }
  return out;
}

// ---------- 511 v2 (Alberta / Ontario / many US states) ----------
interface Icone511Event {
  ID?: number | string;
  RoadwayName?: string;
  Description?: string;
  EventType?: string;
  Severity?: string;
  IsFullClosure?: boolean;
  Latitude?: number;
  Longitude?: number;
  LastUpdated?: number;
}

export function normalize511v2(
  events: Icone511Event[],
  source: string,
  sourceLabel: string
): RoadClosure[] {
  const out: RoadClosure[] = [];
  for (const ev of events) {
    const lat = ev.Latitude;
    const lon = ev.Longitude;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const description = ev.Description ?? "Road event";
    out.push({
      id: `${source}-${ev.ID ?? out.length}`,
      source,
      sourceLabel,
      road: ev.RoadwayName ?? null,
      description,
      lat,
      lon,
      eventType: ev.EventType ?? null,
      severity: ev.Severity && ev.Severity !== "None" ? ev.Severity : null,
      fullClosure: ev.IsFullClosure ?? /all lanes closed/i.test(description),
      updated:
        typeof ev.LastUpdated === "number"
          ? new Date(ev.LastUpdated * 1000).toISOString()
          : null,
      fireRelated: isFireRelatedText(description),
      nearestFireKm: null,
      nearestFireName: null,
    });
  }
  return out;
}

// ---------- registry ----------
interface ClosureSourceDef {
  id: string;
  label: string;
  fetcher: () => Promise<RoadClosure[]>;
}

/**
 * Operators can add more feeds without code changes: set EXTRA_511_SOURCES
 * to a JSON array like
 * [{"id":"mn-511","label":"Minnesota 511","type":"v2","url":"https://511mn.org/api/v2/get/event"}]
 * Supported types: "v2" (the common 511 schema) and "open511".
 */
function extraSources(): ClosureSourceDef[] {
  const raw = process.env.EXTRA_511_SOURCES;
  if (!raw) return [];
  try {
    const defs = JSON.parse(raw) as { id: string; label: string; type: string; url: string }[];
    return defs
      .filter(
        (d) =>
          d.id && d.label && /^https:\/\//.test(d.url) &&
          (d.type === "v2" || d.type === "open511")
      )
      .map((d) => ({
        id: d.id,
        label: d.label,
        fetcher: async () => {
          if (d.type === "open511") {
            const res = await fetchJson<{ events?: Open511Event[] }>(d.url);
            return normalizeOpen511(res.events ?? [], d.id, d.label);
          }
          const res = await fetchJson<Icone511Event[]>(d.url);
          return normalize511v2(res, d.id, d.label);
        },
      }));
  } catch {
    return [];
  }
}

const CLOSURE_SOURCES: ClosureSourceDef[] = [
  {
    id: "bc-open511",
    label: "DriveBC (Open511)",
    fetcher: async () => {
      const d = await fetchJson<{ events?: Open511Event[] }>(
        "https://api.open511.gov.bc.ca/events?format=json&status=ACTIVE&limit=500"
      );
      return normalizeOpen511(d.events ?? [], "bc-open511", "DriveBC");
    },
  },
  {
    id: "ab-511",
    label: "Alberta 511",
    fetcher: async () => {
      const d = await fetchJson<Icone511Event[]>("https://511.alberta.ca/api/v2/get/event");
      return normalize511v2(d, "ab-511", "Alberta 511");
    },
  },
  {
    id: "on-511",
    label: "Ontario 511",
    fetcher: async () => {
      const d = await fetchJson<Icone511Event[]>("https://511on.ca/api/v2/get/event");
      return normalize511v2(d, "on-511", "Ontario 511");
    },
  },
];

/**
 * Keep events that are fire-related by text, or physically near an active
 * fire — a plain construction closure 400 km from any fire is off-topic
 * for a wildfire dashboard.
 */
export function filterFireRelevant(
  closures: RoadClosure[],
  fires: Pick<Fire, "name" | "lat" | "lon" | "status" | "sizeHa">[],
  nearKm = 30
): RoadClosure[] {
  const active = fires.filter(
    (f) =>
      (f.status === "out_of_control" || f.status === "active" || f.status === "being_held") &&
      (f.sizeHa ?? 0) >= 50
  );
  const out: RoadClosure[] = [];
  for (const c of closures) {
    let nearestKm = Infinity;
    let nearestName: string | null = null;
    for (const f of active) {
      const d = haversineKm(c.lat, c.lon, f.lat, f.lon);
      if (d < nearestKm) {
        nearestKm = d;
        nearestName = f.name;
      }
    }
    const isNear = nearestKm <= nearKm;
    if (c.fireRelated || isNear) {
      out.push({
        ...c,
        nearestFireKm: isNear ? Math.round(nearestKm * 10) / 10 : null,
        nearestFireName: isNear ? nearestName : null,
      });
    }
  }
  return out.slice(0, 600);
}

const CLOSURES_TTL_MS = Number(process.env.CLOSURES_TTL_SECONDS ?? 300) * 1000;

export async function getClosures() {
  const sources = [...CLOSURE_SOURCES, ...extraSources()];
  return cached("closures", CLOSURES_TTL_MS, async (): Promise<ClosuresResponse> => {
    const [firesResult, ...results] = await Promise.allSettled([
      getFires(),
      ...sources.map((s) => s.fetcher()),
    ]);
    const fires =
      firesResult.status === "fulfilled"
        ? (firesResult.value as Awaited<ReturnType<typeof getFires>>).value.fires
        : [];

    const closures: RoadClosure[] = [];
    const health: SourceHealth[] = [];
    results.forEach((r, i) => {
      const def = sources[i];
      if (r.status === "fulfilled") {
        const list = r.value as RoadClosure[];
        closures.push(...list);
        health.push({
          id: def.id,
          label: def.label,
          ok: true,
          error: null,
          fetchedAt: new Date().toISOString(),
          count: list.length,
        });
      } else {
        health.push({
          id: def.id,
          label: def.label,
          ok: false,
          error: r.reason instanceof Error ? r.reason.message : "fetch failed",
          fetchedAt: null,
          count: 0,
        });
      }
    });

    return {
      closures: filterFireRelevant(closures, fires),
      sources: health,
      fetchedAt: new Date().toISOString(),
    };
  });
}

// ---------- highway cameras (511 v2 `get/cameras`) ----------
export interface HighwayCamera {
  id: string;
  source: string;
  sourceLabel: string;
  name: string;
  road: string | null;
  lat: number;
  lon: number;
  views: { url: string; description: string | null }[];
  nearestFireKm: number;
  nearestFireName: string;
}

interface Icone511Camera {
  Id?: number | string;
  Roadway?: string;
  Location?: string;
  Latitude?: number;
  Longitude?: number;
  Views?: { Url?: string; Status?: string; Description?: string }[];
}

const CAMERA_SOURCES = [
  { id: "ab-511", label: "Alberta 511", url: "https://511.alberta.ca/api/v2/get/cameras" },
  { id: "on-511", label: "Ontario 511", url: "https://511on.ca/api/v2/get/cameras" },
];

/** Cameras within `nearKm` of an active fire — situational views, not a full atlas. */
export function filterCamerasNearFires(
  cams: HighwayCamera[],
  fires: Pick<Fire, "name" | "lat" | "lon" | "status" | "sizeHa">[],
  nearKm = 60
): HighwayCamera[] {
  const active = fires.filter(
    (f) =>
      (f.status === "out_of_control" || f.status === "active" || f.status === "being_held") &&
      (f.sizeHa ?? 0) >= 100
  );
  const out: HighwayCamera[] = [];
  for (const c of cams) {
    let best = Infinity;
    let bestName = "";
    for (const f of active) {
      const d = haversineKm(c.lat, c.lon, f.lat, f.lon);
      if (d < best) {
        best = d;
        bestName = f.name;
      }
    }
    if (best <= nearKm) {
      out.push({ ...c, nearestFireKm: Math.round(best * 10) / 10, nearestFireName: bestName });
    }
  }
  return out.sort((a, b) => a.nearestFireKm - b.nearestFireKm).slice(0, 400);
}

const CAMERAS_TTL_MS = Number(process.env.CAMERAS_TTL_SECONDS ?? 900) * 1000;

export async function getCameras() {
  return cached("cameras", CAMERAS_TTL_MS, async () => {
    const [firesResult, ...results] = await Promise.allSettled([
      getFires(),
      ...CAMERA_SOURCES.map((s) => fetchJson<Icone511Camera[]>(s.url, { timeoutMs: 45000 })),
    ]);
    const fires =
      firesResult.status === "fulfilled"
        ? (firesResult.value as Awaited<ReturnType<typeof getFires>>).value.fires
        : [];
    const cams: HighwayCamera[] = [];
    results.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const src = CAMERA_SOURCES[i];
      for (const c of r.value) {
        if (typeof c.Latitude !== "number" || typeof c.Longitude !== "number") continue;
        const views = (c.Views ?? [])
          .filter((v) => v.Url && v.Status !== "Disabled")
          .map((v) => ({ url: v.Url as string, description: v.Description ?? null }));
        if (views.length === 0) continue;
        cams.push({
          id: `${src.id}-${c.Id ?? cams.length}`,
          source: src.id,
          sourceLabel: src.label,
          name: c.Location ?? "Highway camera",
          road: c.Roadway ?? null,
          lat: c.Latitude,
          lon: c.Longitude,
          views,
          nearestFireKm: Infinity,
          nearestFireName: "",
        });
      }
    });
    return { cameras: filterCamerasNearFires(cams, fires), fetchedAt: new Date().toISOString() };
  });
}
