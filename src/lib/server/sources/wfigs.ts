import "server-only";
import { fetchJson } from "../http";
import { statusFromWfigs } from "@/lib/status";
import { acresToHa } from "@/lib/format";
import type { Fire } from "@/lib/types";

const BASE =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services";
const LOCATIONS = `${BASE}/WFIGS_Incident_Locations_Current/FeatureServer/0/query`;
const PERIMETERS = `${BASE}/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query`;

const OUT_FIELDS = [
  "IncidentName",
  "IncidentSize",
  "PercentContained",
  "FireDiscoveryDateTime",
  "ModifiedOnDateTime_dt",
  "ContainmentDateTime",
  "FireOutDateTime",
  "FireCause",
  "FireCauseGeneral",
  "POOState",
  "POOCounty",
  "IncidentTypeCategory",
  "POOProtectingAgency",
  "UniqueFireIdentifier",
  "FireBehaviorGeneral",
  "TotalIncidentPersonnel",
  "IncidentManagementOrganization",
  "CpxName",
].join(",");

interface ArcgisPointFeature {
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: Record<string, unknown>;
}

interface ArcgisGeoJson {
  features: ArcgisPointFeature[];
  properties?: { exceededTransferLimit?: boolean };
}

function toIso(epochMs: unknown): string | null {
  if (typeof epochMs !== "number" || !Number.isFinite(epochMs)) return null;
  return new Date(epochMs).toISOString();
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** US protecting-agency codes -> display names. */
const US_AGENCIES: Record<string, string> = {
  USFS: "US Forest Service",
  BLM: "Bureau of Land Management",
  BIA: "Bureau of Indian Affairs",
  NPS: "National Park Service",
  FWS: "US Fish & Wildlife Service",
  ST: "State agency",
  "C&L": "County & local",
  CNTY: "County & local",
  DOD: "Department of Defense",
  DOE: "Department of Energy",
};

export async function fetchUsFires(): Promise<Fire[]> {
  const fires: Fire[] = [];
  let offset = 0;
  // Paginate defensively; the current view is typically < 2000 records.
  for (let page = 0; page < 10; page++) {
    const url =
      `${LOCATIONS}?where=1%3D1&outFields=${encodeURIComponent(OUT_FIELDS)}` +
      `&f=geojson&outSR=4326&resultOffset=${offset}&resultRecordCount=1000`;
    const data = await fetchJson<ArcgisGeoJson>(url);
    for (const feat of data.features ?? []) {
      if (!feat.geometry) continue;
      const p = feat.properties;
      const [lon, lat] = feat.geometry.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const acres = num(p.IncidentSize);
      const containment = num(p.PercentContained);
      const fireOut = toIso(p.FireOutDateTime) !== null;
      const category = str(p.IncidentTypeCategory);
      const uid = str(p.UniqueFireIdentifier) ?? `obj-${offset}-${fires.length}`;
      const agencyCode = str(p.POOProtectingAgency);
      fires.push({
        id: `us-${uid}`,
        name: str(p.IncidentName) ?? "Unnamed incident",
        country: "US",
        admin: str(p.POOState) ?? "US",
        lat,
        lon,
        sizeHa: acres === null ? null : acresToHa(acres),
        containment,
        status: statusFromWfigs(category, containment, fireOut),
        rawStatus: category,
        cause: str(p.FireCauseGeneral) ?? str(p.FireCause),
        discovered: toIso(p.FireDiscoveryDateTime),
        updated: toIso(p.ModifiedOnDateTime_dt),
        agency: agencyCode ? US_AGENCIES[agencyCode] ?? agencyCode : "NIFC interagency",
        agencyUrl: "https://inciweb.wildfire.gov/",
        behavior: str(p.FireBehaviorGeneral),
        personnel: num(p.TotalIncidentPersonnel),
        evacuation: false,
        source: "WFIGS",
        county: str(p.POOCounty),
        complexName: str(p.CpxName),
      });
    }
    if (!data.properties?.exceededTransferLimit || (data.features ?? []).length === 0) break;
    offset += (data.features ?? []).length;
  }
  return fires;
}

const PERIM_FIELDS = [
  "poly_IncidentName",
  "poly_GISAcres",
  "poly_DateCurrent",
  "attr_UniqueFireIdentifier",
  "attr_PercentContained",
  "attr_IncidentSize",
].join(",");

export interface PerimeterCollection {
  type: "FeatureCollection";
  features: unknown[];
}

/** Current US perimeters, geometry simplified to keep payloads reasonable. */
export async function fetchUsPerimeters(): Promise<PerimeterCollection> {
  const features: unknown[] = [];
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const url =
      `${PERIMETERS}?where=1%3D1&outFields=${encodeURIComponent(PERIM_FIELDS)}` +
      `&f=geojson&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.0005` +
      `&resultOffset=${offset}&resultRecordCount=500`;
    const data = await fetchJson<ArcgisGeoJson & { features: unknown[] }>(url, { timeoutMs: 45000 });
    features.push(...(data.features ?? []));
    if (!data.properties?.exceededTransferLimit || (data.features ?? []).length === 0) break;
    offset += (data.features ?? []).length;
  }
  return { type: "FeatureCollection", features };
}
