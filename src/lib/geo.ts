type Position = [number, number];
type PolygonCoords = Position[][];
type MultiPolygonCoords = Position[][][];

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

/** Ray-casting point-in-ring test. Ring is [lon, lat][] . */
function inRing(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolygon(lon: number, lat: number, poly: PolygonCoords): boolean {
  if (poly.length === 0 || !inRing(lon, lat, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) {
    if (inRing(lon, lat, poly[i])) return false; // inside a hole
  }
  return true;
}

export function pointInGeometry(lon: number, lat: number, geom: GeoJsonGeometry | null): boolean {
  if (!geom) return false;
  if (geom.type === "Polygon") {
    return inPolygon(lon, lat, geom.coordinates as PolygonCoords);
  }
  if (geom.type === "MultiPolygon") {
    return (geom.coordinates as MultiPolygonCoords).some((p) => inPolygon(lon, lat, p));
  }
  return false;
}

/** Round a bbox outward to a grid so nearby requests share a cache entry. */
export function roundBbox(
  [w, s, e, n]: [number, number, number, number],
  step = 0.5
): [number, number, number, number] {
  const f = (v: number, up: boolean) => (up ? Math.ceil(v / step) : Math.floor(v / step)) * step;
  return [f(w, false), f(s, false), f(e, true), f(n, true)];
}

const EARTH_R_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(a));
}

/** Bounding box [w, s, e, n] of a (Multi)Polygon geometry. */
export function geometryBbox(geom: GeoJsonGeometry): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === "number") {
      const [x, y] = coords as [number, number];
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    } else if (Array.isArray(coords)) {
      for (const c of coords) walk(c);
    }
  };
  walk(geom.coordinates);
  return [w, s, e, n];
}

export function bboxOverlaps(
  [aw, as_, ae, an]: [number, number, number, number],
  [bw, bs, be, bn]: [number, number, number, number]
): boolean {
  return aw <= be && ae >= bw && as_ <= bn && an >= bs;
}

export function clampBbox(
  [w, s, e, n]: [number, number, number, number]
): [number, number, number, number] {
  return [
    Math.max(-180, Math.min(180, w)),
    Math.max(-85, Math.min(85, s)),
    Math.max(-180, Math.min(180, e)),
    Math.max(-85, Math.min(85, n)),
  ];
}
