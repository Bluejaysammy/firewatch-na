/**
 * Group Mexican satellite detections into spatial clusters so the map and
 * list show coherent "detection groups" instead of hundreds of raw points.
 * Grid-based: detections in the same ~0.15° cell (≈15 km) merge; the result
 * carries the detection count, summed estimated area, and latest timestamp.
 * Still clearly labelled as satellite-derived, not agency incidents.
 */
export interface MxDetection {
  lat: number;
  lon: number;
  reportedAt: string | null;
  frp: number | null;
  estAreaHa: number | null;
}

export interface MxCluster {
  lat: number;
  lon: number;
  count: number;
  totalAreaHa: number | null;
  maxFrp: number | null;
  latest: string | null;
}

export function clusterDetections(spots: MxDetection[], cellDeg = 0.15): MxCluster[] {
  const cells = new Map<
    string,
    { latSum: number; lonSum: number; count: number; area: number; hasArea: boolean; frp: number | null; latest: string | null }
  >();
  for (const s of spots) {
    const key = `${Math.floor(s.lat / cellDeg)}:${Math.floor(s.lon / cellDeg)}`;
    const cell =
      cells.get(key) ??
      { latSum: 0, lonSum: 0, count: 0, area: 0, hasArea: false, frp: null, latest: null };
    cell.latSum += s.lat;
    cell.lonSum += s.lon;
    cell.count += 1;
    if (s.estAreaHa !== null && Number.isFinite(s.estAreaHa)) {
      cell.area += s.estAreaHa;
      cell.hasArea = true;
    }
    if (s.frp !== null && (cell.frp === null || s.frp > cell.frp)) cell.frp = s.frp;
    if (s.reportedAt && (!cell.latest || s.reportedAt > cell.latest)) cell.latest = s.reportedAt;
    cells.set(key, cell);
  }
  return [...cells.values()]
    .map((c) => ({
      lat: Math.round((c.latSum / c.count) * 1e5) / 1e5,
      lon: Math.round((c.lonSum / c.count) * 1e5) / 1e5,
      count: c.count,
      totalAreaHa: c.hasArea ? Math.round(c.area * 10) / 10 : null,
      maxFrp: c.frp,
      latest: c.latest,
    }))
    .sort((a, b) => b.count - a.count);
}
