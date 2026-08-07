import { describe, expect, it } from "vitest";
import { clusterDetections } from "@/lib/mxcluster";
import { normalizeBcEvac } from "@/lib/server/sources/evac";

describe("clusterDetections", () => {
  it("merges detections in the same grid cell and keeps distant ones apart", () => {
    const clusters = clusterDetections([
      { lat: 19.401, lon: -99.101, reportedAt: "2026-08-05T01:00:00Z", frp: 5, estAreaHa: 10 },
      { lat: 19.402, lon: -99.102, reportedAt: "2026-08-05T03:00:00Z", frp: 9, estAreaHa: 4 },
      { lat: 25.0, lon: -104.0, reportedAt: null, frp: null, estAreaHa: null },
    ]);
    expect(clusters).toHaveLength(2);
    const big = clusters[0]; // sorted by count desc
    expect(big.count).toBe(2);
    expect(big.totalAreaHa).toBe(14);
    expect(big.maxFrp).toBe(9);
    expect(big.latest).toBe("2026-08-05T03:00:00Z");
    expect(big.lat).toBeCloseTo(19.4015, 3);
    expect(clusters[1].totalAreaHa).toBeNull();
  });

  it("returns empty for no detections", () => {
    expect(clusterDetections([])).toEqual([]);
  });
});

describe("normalizeBcEvac", () => {
  const geometry = {
    type: "Polygon",
    coordinates: [[[-119, 50], [-118, 50], [-118, 51], [-119, 50]]],
  };

  it("maps BC WFS features to evacuation zones", () => {
    const zones = normalizeBcEvac([
      {
        geometry,
        properties: {
          EMRG_OAA_SYSID: 18,
          EVENT_NAME: "Bradley Creek Wildfire",
          EVENT_TYPE: "Fire",
          ORDER_ALERT_STATUS: "Order",
          ISSUING_AGENCY: "RDNO",
          DATE_MODIFIED: "2026-08-04Z",
        },
      },
      { geometry, properties: { ORDER_ALERT_STATUS: "Alert", EVENT_NAME: "X" } },
      { geometry, properties: { ORDER_ALERT_STATUS: "Rescinded", EVENT_NAME: "Old" } },
      { geometry: null, properties: { ORDER_ALERT_STATUS: "Order" } },
    ]);
    expect(zones).toHaveLength(2);
    expect(zones[0].status).toBe("order");
    expect(zones[0].name).toBe("Bradley Creek Wildfire");
    expect(zones[0].agency).toBe("RDNO");
    expect(zones[1].status).toBe("alert");
  });
});
