import "server-only";
import { fetchJson, fetchText } from "../http";
import { parseCsv } from "@/lib/csv";
import { statusFromCwfis } from "@/lib/status";
import type { Fire } from "@/lib/types";
import type { PerimeterCollection } from "./wfigs";

const ACTIVE_FIRES_CSV =
  "https://cwfis.cfs.nrcan.gc.ca/downloads/reportedfires/activefires.csv";
const WFS_BASE =
  "https://cwfis.cfs.nrcan.gc.ca/geoserver/public/ows?service=WFS&version=2.0.0&request=GetFeature";

/** Canadian fire-management agency codes -> display names + public sites. */
export const CA_AGENCIES: Record<string, { name: string; url: string }> = {
  AB: { name: "Alberta Wildfire", url: "https://www.alberta.ca/wildfire-status" },
  BC: { name: "BC Wildfire Service", url: "https://wildfiresituation.nrs.gov.bc.ca/map" },
  SK: { name: "Saskatchewan Public Safety Agency", url: "https://www.saskpublicsafety.ca/emergencies-and-response/active-wildfires-in-saskatchewan" },
  MB: { name: "Manitoba Wildfire Service", url: "https://www.gov.mb.ca/wildfire/" },
  ON: { name: "Ontario Forest Fire Program (MNR)", url: "https://www.ontario.ca/page/forest-fires" },
  QC: { name: "SOPFEU (Québec)", url: "https://sopfeu.qc.ca/en/" },
  NB: { name: "New Brunswick ERD", url: "https://www.gnb.ca/en/topic/fires-burning/forest-fire-watch.html" },
  NS: { name: "Nova Scotia DNRR", url: "https://novascotia.ca/burnsafe/" },
  PE: { name: "PEI Forests, Fish and Wildlife", url: "https://www.princeedwardisland.ca/en/topic/forests-fish-and-wildlife" },
  NL: { name: "Newfoundland & Labrador Forestry", url: "https://www.gov.nl.ca/ffa/public-education/forestry/forest-fires/" },
  YT: { name: "Yukon Wildland Fire Management", url: "https://wildfires.service.yukon.ca/" },
  NT: { name: "NWT Fire (ECC)", url: "https://www.gov.nt.ca/ecc/en/services/wildfire-operations" },
  NU: { name: "Nunavut Community Services", url: "https://www.gov.nu.ca/" },
  PC: { name: "Parks Canada", url: "https://parks.canada.ca/pn-np/cnfa-ncfs" },
};

const CAUSE_LABELS: Record<string, string> = {
  H: "Human",
  "H-PB": "Prescribed burn",
  N: "Natural (lightning)",
  L: "Natural (lightning)",
  U: "Undetermined",
  RE: "Reburn",
};

function parseNum(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null; // CWFIS uses -1 for "unknown"
  return n;
}

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function fetchCaFires(): Promise<Fire[]> {
  const text = await fetchText(ACTIVE_FIRES_CSV);
  const rows = parseCsv(text);
  const fires: Fire[] = [];
  for (const row of rows) {
    const lat = parseNum(row.latitude);
    const lon = row.longitude === "" ? null : Number(row.longitude);
    if (lat === null || lon === null || !Number.isFinite(lon)) continue;
    const agencyCode = (row.agency_code ?? "").toUpperCase();
    const agency = CA_AGENCIES[agencyCode];
    const prescribed = row.fire_was_prescribed === "1";
    const id = row.national_fire_id || row.id || `${agencyCode}-${row.agency_fire_id}`;
    fires.push({
      id: `ca-${id}`,
      name: row.agency_fire_id || row.national_fire_id || "Unnamed fire",
      country: "CA",
      admin: agencyCode === "PC" ? "CA-PC" : `CA-${agencyCode}`,
      lat,
      lon,
      sizeHa: parseNum(row.fire_size),
      containment: parseNum(row.percent_contained),
      status: statusFromCwfis(row.stage_of_control_status, prescribed),
      rawStatus: row.stage_of_control_status || null,
      cause: CAUSE_LABELS[(row.national_fire_cause ?? "").toUpperCase()] ?? null,
      discovered: parseDate(row.situation_report_date),
      updated: parseDate(row.status_date) ?? parseDate(row.situation_report_date),
      agency: agency?.name ?? (agencyCode || null),
      agencyUrl: agency?.url ?? "https://cwfis.cfs.nrcan.gc.ca/interactive-map",
      behavior: null,
      personnel: null,
      evacuation: false,
      source: "CWFIS",
      county: row.region_code || null,
      complexName: null,
    });
  }
  return fires;
}

interface WfsFeature {
  id?: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}
interface WfsCollection {
  features?: WfsFeature[];
}

/** Canadian near-real-time fire perimeter estimates (CWFIS M3). */
export async function fetchCaPerimeters(): Promise<PerimeterCollection> {
  const url =
    `${WFS_BASE}&typeName=public:m3_polygons_current&outputFormat=application/json` +
    `&srsName=EPSG:4326&count=4000`;
  const data = await fetchJson<WfsCollection>(url, { timeoutMs: 45000 });
  return {
    type: "FeatureCollection",
    features: (data.features ?? []).filter((f) => f.geometry),
  };
}

export interface Hotspot {
  lat: number;
  lon: number;
  agency: string | null;
  sensor: string | null;
  reportedAt: string | null;
  frp: number | null;
  estAreaHa: number | null;
}

/**
 * Satellite thermal detections (VIIRS/MODIS) for the last 24 h across North
 * America, from the CWFIS GeoServer. Used both as a map layer and as the
 * data source for Mexico, which has no public incident-level API.
 */
export async function fetchHotspots(): Promise<Hotspot[]> {
  const url =
    `${WFS_BASE}&typeName=public:hotspots_last24hrs&outputFormat=application/json` +
    `&srsName=EPSG:4326&count=10000`;
  const data = await fetchJson<WfsCollection>(url, { timeoutMs: 45000 });
  const spots: Hotspot[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties;
    const lat = typeof p.lat === "number" ? p.lat : null;
    const lon = typeof p.lon === "number" ? p.lon : null;
    if (lat === null || lon === null) continue;
    spots.push({
      lat,
      lon,
      agency: typeof p.agency === "string" ? p.agency : null,
      sensor: typeof p.sensor === "string" ? p.sensor : null,
      reportedAt: typeof p.rep_date === "string" ? p.rep_date : null,
      frp: typeof p.frp === "number" ? p.frp : null,
      estAreaHa: typeof p.estarea === "number" ? p.estarea : null,
    });
  }
  return spots;
}

/** Mexico: represent satellite detections as informational fire records. */
export function mexicoFiresFromHotspots(spots: Hotspot[]): Fire[] {
  return spots
    .filter((s) => s.agency === "MX")
    .slice(0, 2000)
    .map((s, i) => ({
      id: `mx-hs-${s.lat.toFixed(4)}-${s.lon.toFixed(4)}-${i}`,
      name: `Satellite detection (${s.sensor ?? "satellite"})`,
      country: "MX" as const,
      admin: "MX",
      lat: s.lat,
      lon: s.lon,
      sizeHa: s.estAreaHa,
      containment: null,
      status: "info" as const,
      rawStatus: null,
      cause: null,
      discovered: s.reportedAt,
      updated: s.reportedAt,
      agency: "CONAFOR (see national reports)",
      agencyUrl:
        "https://www.gob.mx/conafor/documentos/reporte-semanal-de-incendios",
      behavior: null,
      personnel: null,
      evacuation: false,
      source: "CWFIS_HOTSPOT" as const,
      county: null,
      complexName: null,
    }));
}
