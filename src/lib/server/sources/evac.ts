import "server-only";
import { fetchJson } from "../http";
import { cached } from "../cache";
import type { GeoJsonGeometry } from "@/lib/geo";
import type { SourceHealth } from "@/lib/types";

/**
 * Canadian evacuation orders/alerts. There is no unified national feed, so
 * this is a per-province registry (same pattern as fires and closures).
 * Currently implemented: British Columbia's official EmergencyInfoBC layer
 * (BC Data Catalogue, Open Government Licence – BC). Other provinces publish
 * via Alert Ready/NAAD or municipal ArcGIS layers and can be added here.
 */
export interface EvacZone {
  id: string;
  source: string;
  sourceLabel: string;
  name: string;
  /** "order" = leave now; "alert" = be ready to leave. */
  status: "order" | "alert";
  eventType: string | null;
  agency: string | null;
  updated: string | null;
  geometry: GeoJsonGeometry;
}

const BC_WFS =
  "https://openmaps.gov.bc.ca/geo/pub/WHSE_HUMAN_CULTURAL_ECONOMIC.EMRG_ORDER_AND_ALERT_AREAS_SP/ows" +
  "?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeName=pub:WHSE_HUMAN_CULTURAL_ECONOMIC.EMRG_ORDER_AND_ALERT_AREAS_SP" +
  "&outputFormat=application/json&srsName=EPSG:4326&count=1000";

interface BcFeature {
  id?: string;
  geometry: GeoJsonGeometry | null;
  properties?: Record<string, unknown>;
}

export function normalizeBcEvac(features: BcFeature[]): EvacZone[] {
  const zones: EvacZone[] = [];
  for (const f of features) {
    if (!f.geometry) continue;
    const p = f.properties ?? {};
    const rawStatus = String(p.ORDER_ALERT_STATUS ?? "").toLowerCase();
    if (rawStatus !== "order" && rawStatus !== "alert") continue;
    zones.push({
      id: `bc-${String(p.EMRG_OAA_SYSID ?? f.id ?? zones.length)}`,
      source: "bc-evac",
      sourceLabel: "EmergencyInfoBC",
      name: String(p.EVENT_NAME ?? "Evacuation area"),
      status: rawStatus,
      eventType: p.EVENT_TYPE ? String(p.EVENT_TYPE) : null,
      agency: p.ISSUING_AGENCY ? String(p.ISSUING_AGENCY) : null,
      updated: p.DATE_MODIFIED ? String(p.DATE_MODIFIED) : null,
      geometry: f.geometry,
    });
  }
  return zones;
}

interface EvacSourceDef {
  id: string;
  label: string;
  fetcher: () => Promise<EvacZone[]>;
}

const EVAC_SOURCES: EvacSourceDef[] = [
  {
    id: "bc-evac",
    label: "EmergencyInfoBC (British Columbia)",
    fetcher: async () => {
      const d = await fetchJson<{ features?: BcFeature[] }>(BC_WFS, { timeoutMs: 45000 });
      return normalizeBcEvac(d.features ?? []);
    },
  },
];

export interface EvacResult {
  zones: EvacZone[];
  sources: SourceHealth[];
}

const EVAC_TTL_MS = Number(process.env.EVAC_TTL_SECONDS ?? 300) * 1000;

export async function getEvacZones() {
  return cached("evac", EVAC_TTL_MS, async (): Promise<EvacResult> => {
    const results = await Promise.allSettled(EVAC_SOURCES.map((s) => s.fetcher()));
    const zones: EvacZone[] = [];
    const sources: SourceHealth[] = [];
    results.forEach((r, i) => {
      const def = EVAC_SOURCES[i];
      if (r.status === "fulfilled") {
        zones.push(...r.value);
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
    return { zones, sources };
  });
}
