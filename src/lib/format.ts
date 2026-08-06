const HA_PER_ACRE = 0.40468564224;

export function acresToHa(acres: number): number {
  return acres * HA_PER_ACRE;
}

export function haToAcres(ha: number): number {
  return ha / HA_PER_ACRE;
}

function compact(n: number): string {
  if (n >= 100000) return `${Math.round(n / 1000)}k`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 100) return `${Math.round(n)}`;
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** "1.2k ha (3.1k ac)" — always shows both unit systems. */
export function formatArea(ha: number | null): string {
  if (ha === null || !Number.isFinite(ha)) return "Not reported";
  return `${compact(ha)} ha (${compact(haToAcres(ha))} ac)`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "Not reported";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not reported";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "unknown";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Parse free-text coordinates: "49.28, -123.12", "49.28 -123.12",
 * "49.28N 123.12W", "N49.28 W123.12".
 */
export function parseCoordinates(input: string): { lat: number; lon: number } | null {
  const s = input.trim();
  let m = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    return null;
  }
  m = s
    .toUpperCase()
    .match(/^([NS])?\s*(\d{1,2}(?:\.\d+)?)\s*([NS])?\s*[,;\s]\s*([EW])?\s*(\d{1,3}(?:\.\d+)?)\s*([EW])?$/);
  if (m) {
    const latHem = m[1] ?? m[3];
    const lonHem = m[4] ?? m[6];
    if (!latHem || !lonHem) return null;
    let lat = parseFloat(m[2]);
    let lon = parseFloat(m[5]);
    if (latHem === "S") lat = -lat;
    if (lonHem === "W") lon = -lon;
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return null;
}

export function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
}
