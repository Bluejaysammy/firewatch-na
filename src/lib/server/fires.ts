import "server-only";
import { broadcast, cached } from "./cache";
import { fetchUsFires } from "./sources/wfigs";
import { fetchCaFires, fetchHotspots, mexicoFiresFromHotspots } from "./sources/cwfis";
import { fetchFireAlerts, isEvacuationEvent } from "./sources/nws";
import { pointInGeometry, type GeoJsonGeometry } from "@/lib/geo";
import type { Country, Fire, FireStats, FiresResponse, SourceHealth } from "@/lib/types";

export const FIRES_TTL_MS = Number(process.env.FIRES_TTL_SECONDS ?? 120) * 1000;
const ALERTS_TTL_MS = Number(process.env.ALERTS_TTL_SECONDS ?? 120) * 1000;

/**
 * Source registry. To add another provincial/state/agency feed, append an
 * entry that returns unified `Fire` records — nothing else needs to change.
 */
interface FireSourceDef {
  id: string;
  label: string;
  fetcher: () => Promise<Fire[]>;
}

const FIRE_SOURCES: FireSourceDef[] = [
  { id: "wfigs", label: "NIFC WFIGS (United States)", fetcher: fetchUsFires },
  { id: "cwfis", label: "CWFIS (Canada)", fetcher: fetchCaFires },
  {
    id: "cwfis-hotspots-mx",
    label: "CWFIS satellite detections (Mexico)",
    fetcher: async () => mexicoFiresFromHotspots(await fetchHotspots()),
  },
];

export async function getAlerts() {
  return cached("alerts", ALERTS_TTL_MS, fetchFireAlerts);
}

async function aggregateFires(): Promise<FiresResponse> {
  const results = await Promise.allSettled(FIRE_SOURCES.map((s) => s.fetcher()));
  const fires: Fire[] = [];
  const sources: SourceHealth[] = [];
  results.forEach((r, i) => {
    const def = FIRE_SOURCES[i];
    if (r.status === "fulfilled") {
      fires.push(...r.value);
      sources.push({
        id: def.id,
        label: def.label,
        ok: true,
        error: null,
        fetchedAt: new Date().toISOString(),
        count: r.value.length,
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

  // Flag fires covered by an active evacuation alert polygon (US NWS).
  try {
    const alerts = await getAlerts();
    const evacGeoms = alerts.value.features
      .filter((f) => f.geometry && isEvacuationEvent(f.properties.event))
      .map((f) => f.geometry as GeoJsonGeometry);
    if (evacGeoms.length > 0) {
      for (const fire of fires) {
        fire.evacuation = evacGeoms.some((g) => pointInGeometry(fire.lon, fire.lat, g));
      }
    }
  } catch {
    // Alerts are supplementary; fire data still ships without them.
  }

  const response: FiresResponse = {
    fires,
    fetchedAt: new Date().toISOString(),
    sources,
  };
  broadcast("fires", JSON.stringify({ fetchedAt: response.fetchedAt }));
  return response;
}

export async function getFires() {
  return cached("fires", FIRES_TTL_MS, aggregateFires);
}

const ACTIVE_STATUSES = new Set(["out_of_control", "active", "being_held", "under_control"]);

export function computeStats(data: FiresResponse): FireStats {
  const byCountry: Record<Country, number> = { CA: 0, US: 0, MX: 0 };
  const byAdmin: Record<string, number> = {};
  let totalHa = 0;
  let startedToday = 0;
  let containedToday = 0;
  let evacuations = 0;
  let totalActive = 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = todayStart.getTime();

  for (const f of data.fires) {
    const isActive = ACTIVE_STATUSES.has(f.status);
    if (isActive || f.status === "info") {
      byCountry[f.country] += 1;
      byAdmin[f.admin] = (byAdmin[f.admin] ?? 0) + 1;
    }
    if (isActive) totalActive += 1;
    if (f.sizeHa !== null && f.status !== "prescribed") totalHa += f.sizeHa;
    if (f.discovered && new Date(f.discovered).getTime() >= today) startedToday += 1;
    if (
      f.status === "contained" &&
      f.updated &&
      new Date(f.updated).getTime() >= today
    ) {
      containedToday += 1;
    }
    if (f.evacuation) evacuations += 1;
  }

  const real = data.fires.filter((f) => f.source !== "CWFIS_HOTSPOT");
  const largest = [...real]
    .filter((f) => f.sizeHa !== null && ACTIVE_STATUSES.has(f.status))
    .sort((a, b) => (b.sizeHa ?? 0) - (a.sizeHa ?? 0))
    .slice(0, 8);
  const recentlyUpdated = [...real]
    .filter((f) => f.updated !== null)
    .sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""))
    .slice(0, 8);

  return {
    totalActive,
    totalAll: data.fires.length,
    byCountry,
    byAdmin,
    totalHa,
    startedToday,
    containedToday,
    evacuations,
    largest,
    recentlyUpdated,
    fetchedAt: data.fetchedAt,
  };
}
