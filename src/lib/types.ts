export type Country = "CA" | "US" | "MX";

/**
 * Unified fire status across agencies.
 * - Canada (CWFIS) reports stage of control directly (OC/BH/UC/EX).
 * - The US (WFIGS) reports percent containment; we derive a status from it
 *   (documented in the legend and README).
 * - Satellite detections (Mexico) are informational only.
 */
export type FireStatus =
  | "out_of_control"
  | "active"
  | "being_held"
  | "under_control"
  | "contained"
  | "prescribed"
  | "info";

export type FireSource = "WFIGS" | "CWFIS" | "CWFIS_HOTSPOT" | "FIRMS";

export interface Fire {
  id: string;
  name: string;
  country: Country;
  /** ISO-3166-2 style region code, e.g. "CA-BC", "US-CA", or "MX". */
  admin: string;
  lat: number;
  lon: number;
  /** Size in hectares (null when the agency has not reported one). */
  sizeHa: number | null;
  /** Containment percent 0-100, null when not reported. */
  containment: number | null;
  status: FireStatus;
  /** Raw agency stage-of-control / category code, e.g. "OC", "WF", "RX". */
  rawStatus: string | null;
  cause: string | null;
  /** ISO timestamp of discovery/report. */
  discovered: string | null;
  /** ISO timestamp of the agency's last update for this record. */
  updated: string | null;
  /** Responsible / protecting agency (display name). */
  agency: string | null;
  agencyUrl: string | null;
  behavior: string | null;
  personnel: number | null;
  /** True when an active evacuation alert polygon covers this fire. */
  evacuation: boolean;
  source: FireSource;
  county: string | null;
  complexName: string | null;
}

export interface SourceHealth {
  id: string;
  label: string;
  ok: boolean;
  error: string | null;
  fetchedAt: string | null;
  count: number;
}

export interface FiresResponse {
  fires: Fire[];
  fetchedAt: string;
  sources: SourceHealth[];
}

export interface FireStats {
  totalActive: number;
  totalAll: number;
  byCountry: Record<Country, number>;
  byAdmin: Record<string, number>;
  totalHa: number;
  startedToday: number;
  containedToday: number;
  evacuations: number;
  largest: Fire[];
  recentlyUpdated: Fire[];
  fetchedAt: string;
}

export interface AirQuality {
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  time: string | null;
  /** Next 24 h of hourly US AQI values (smoke/air outlook). */
  hourly: { time: string; usAqi: number | null }[];
}

export interface SpotWeather {
  tempC: number | null;
  rh: number | null;
  windKmh: number | null;
  windGustKmh: number | null;
  windDir: number | null;
  precipMm: number | null;
  time: string | null;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  type: string;
}

export interface AppConfig {
  refreshDefaultMs: number;
  /** Optional key-gated integrations; the UI only offers what is enabled. */
  firmsEnabled: boolean;
  owmEnabled: boolean;
  waqiEnabled: boolean;
}

export type RoadThreatLevel = "impacted" | "at_risk";

/**
 * A highway grouped by ref/name that passes close to (or through) an active
 * fire. Derived data: computed from OSM road geometry vs. fire perimeters
 * and proximity — labelled as such in the UI; it is not an official closure.
 */
export interface AffectedRoad {
  key: string;
  /** Display label, e.g. "BC 97 (Okanagan Hwy)". */
  label: string;
  ref: string | null;
  name: string | null;
  level: RoadThreatLevel;
  fireId: string | null;
  fireName: string | null;
  distanceKm: number | null;
  /** Representative point for search fly-to. */
  lat: number;
  lon: number;
  segments: number;
}

export interface RoadsResponse {
  roads: AffectedRoad[];
  /** GeoJSON FeatureCollection of LineString segments for the map layer. */
  segments: { type: "FeatureCollection"; features: unknown[] };
  computedAt: string;
  candidateFires: number;
}

/** Official road event from a provincial/state traffic API (511/Open511). */
export interface RoadClosure {
  id: string;
  source: string;
  sourceLabel: string;
  road: string | null;
  description: string;
  lat: number;
  lon: number;
  eventType: string | null;
  severity: string | null;
  fullClosure: boolean;
  updated: string | null;
  /** True when the event text mentions fire/smoke (vs. only being near one). */
  fireRelated: boolean;
  /** Distance to the nearest active fire, km (null if none in range). */
  nearestFireKm: number | null;
  nearestFireName: string | null;
}

export interface ClosuresResponse {
  closures: RoadClosure[];
  sources: SourceHealth[];
  fetchedAt: string;
}

export const COUNTRY_LABELS: Record<Country, string> = {
  CA: "Canada",
  US: "United States",
  MX: "Mexico",
};
