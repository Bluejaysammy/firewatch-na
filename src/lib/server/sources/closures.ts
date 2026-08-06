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
  return cached("closures", CLOSURES_TTL_MS, async (): Promise<ClosuresResponse> => {
    const [firesResult, ...results] = await Promise.allSettled([
      getFires(),
      ...CLOSURE_SOURCES.map((s) => s.fetcher()),
    ]);
    const fires =
      firesResult.status === "fulfilled"
        ? (firesResult.value as Awaited<ReturnType<typeof getFires>>).value.fires
        : [];

    const closures: RoadClosure[] = [];
    const sources: SourceHealth[] = [];
    results.forEach((r, i) => {
      const def = CLOSURE_SOURCES[i];
      if (r.status === "fulfilled") {
        const list = r.value as RoadClosure[];
        closures.push(...list);
        sources.push({
          id: def.id,
          label: def.label,
          ok: true,
          error: null,
          fetchedAt: new Date().toISOString(),
          count: list.length,
        });
      } else {
        sources.push({
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
      sources,
      fetchedAt: new Date().toISOString(),
    };
  });
}
