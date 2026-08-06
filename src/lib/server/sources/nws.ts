import "server-only";
import { fetchJson } from "../http";

export interface AlertFeature {
  type: "Feature";
  id: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: {
    event: string;
    headline: string | null;
    severity: string | null;
    areaDesc: string | null;
    effective: string | null;
    expires: string | null;
    instruction: string | null;
  };
}

export interface AlertCollection {
  type: "FeatureCollection";
  features: AlertFeature[];
}

/**
 * Fire-related active alerts from the US National Weather Service.
 * Events are fetched independently so one failing filter cannot break the
 * others. Zone-based alerts without polygon geometry are kept (they still
 * render in lists) but only polygon alerts appear on the map and are used
 * for evacuation flagging.
 */
const EVENTS = [
  "Evacuation - Immediate",
  "Fire Warning",
  "Red Flag Warning",
  "Fire Weather Watch",
  "Air Quality Alert",
];

interface RawAlerts {
  features?: {
    id?: string;
    geometry: { type: string; coordinates: unknown } | null;
    properties?: Record<string, unknown>;
  }[];
}

function s(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export async function fetchFireAlerts(): Promise<AlertCollection> {
  const results = await Promise.allSettled(
    EVENTS.map((event) =>
      fetchJson<RawAlerts>(
        `https://api.weather.gov/alerts/active?event=${encodeURIComponent(event)}`
      )
    )
  );
  const features: AlertFeature[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const f of r.value.features ?? []) {
      const p = f.properties ?? {};
      features.push({
        type: "Feature",
        id: (f.id as string) ?? `alert-${features.length}`,
        geometry: f.geometry,
        properties: {
          event: s(p.event) ?? "Alert",
          headline: s(p.headline),
          severity: s(p.severity),
          areaDesc: s(p.areaDesc),
          effective: s(p.effective),
          expires: s(p.expires),
          instruction: s(p.instruction),
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

export function isEvacuationEvent(event: string): boolean {
  return /evacuation/i.test(event);
}
