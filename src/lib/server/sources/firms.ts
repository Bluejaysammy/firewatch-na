import "server-only";
import { fetchText } from "../http";
import { parseCsv } from "@/lib/csv";
import type { Hotspot } from "./cwfis";

/**
 * NASA FIRMS hotspot enrichment (optional). Requires a free MAP_KEY from
 * https://firms.modaps.eosdis.nasa.gov/api/ set as FIRMS_MAP_KEY. When
 * configured, FIRMS VIIRS detections replace the CWFIS hotspot feed as the
 * "Satellite hotspots" layer (higher update cadence, confidence values).
 */
export function firmsEnabled(): boolean {
  return Boolean(process.env.FIRMS_MAP_KEY);
}

// North America: [west, south, east, north]
const NA_BBOX = "-170,14,-50,72";

export async function fetchFirmsHotspots(): Promise<Hotspot[]> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return [];
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_NOAA20_NRT/${NA_BBOX}/1`;
  const rows = parseCsv(await fetchText(url, { timeoutMs: 60000 }));
  const spots: Hotspot[] = [];
  for (const row of rows) {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const date = row.acq_date;
    const time = (row.acq_time ?? "0000").padStart(4, "0");
    spots.push({
      lat,
      lon,
      agency: null,
      sensor: "VIIRS (FIRMS)",
      reportedAt: date ? `${date}T${time.slice(0, 2)}:${time.slice(2)}:00Z` : null,
      frp: Number.isFinite(Number(row.frp)) ? Number(row.frp) : null,
      estAreaHa: null,
    });
  }
  return spots;
}
