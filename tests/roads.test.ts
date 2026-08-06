import { describe, expect, it } from "vitest";
import { classifyRoads, isFireRelatedText, type OverpassWay } from "@/lib/roads";
import {
  filterFireRelevant,
  normalize511v2,
  normalizeOpen511,
} from "@/lib/server/sources/closures";

const perimeter = {
  type: "Polygon",
  coordinates: [
    [
      [-120.5, 50.0],
      [-120.0, 50.0],
      [-120.0, 50.4],
      [-120.5, 50.4],
      [-120.5, 50.0],
    ],
  ],
};

const fires = [
  { id: "f1", name: "Test Fire", lat: 50.2, lon: -120.25 },
  { id: "f2", name: "Far Fire", lat: 55.0, lon: -110.0 },
];

function way(id: number, tags: Record<string, string>, pts: [number, number][]): OverpassWay {
  return { id, tags, geometry: pts.map(([lat, lon]) => ({ lat, lon })) };
}

describe("classifyRoads", () => {
  it("marks roads crossing a perimeter as impacted, others as at risk", () => {
    const ways = [
      way(1, { ref: "BC 97", name: "Okanagan Hwy" }, [
        [50.1, -120.6],
        [50.2, -120.3], // inside perimeter
        [50.3, -120.1],
      ]),
      way(2, { ref: "BC 5A" }, [
        [50.6, -120.9],
        [50.7, -120.8], // outside perimeter
      ]),
    ];
    const { roads, segments } = classifyRoads(ways, [perimeter], fires);
    expect(roads).toHaveLength(2);
    const bc97 = roads.find((r) => r.ref === "BC 97")!;
    expect(bc97.level).toBe("impacted");
    expect(bc97.label).toBe("BC 97 (Okanagan Hwy)");
    expect(bc97.fireId).toBe("f1");
    expect(roads.find((r) => r.ref === "BC 5A")!.level).toBe("at_risk");
    expect(segments.features).toHaveLength(2);
    // impacted roads sort first
    expect(roads[0].ref).toBe("BC 97");
  });

  it("groups multiple ways of the same ref, escalating to the worst level", () => {
    const ways = [
      way(1, { ref: "HWY 1" }, [
        [51.0, -121.0],
        [51.1, -121.1],
      ]),
      way(2, { ref: "HWY 1" }, [
        [50.2, -120.3], // inside perimeter
        [50.25, -120.28],
      ]),
    ];
    const { roads } = classifyRoads(ways, [perimeter], fires);
    expect(roads).toHaveLength(1);
    expect(roads[0].level).toBe("impacted");
    expect(roads[0].segments).toBe(2);
  });

  it("skips unnamed ways and degenerate geometry", () => {
    const ways = [
      way(1, {}, [
        [50.1, -120.1],
        [50.2, -120.2],
      ]),
      way(2, { ref: "X" }, [[50.1, -120.1]]),
    ];
    const { roads } = classifyRoads(ways, [perimeter], fires);
    expect(roads).toHaveLength(0);
  });
});

describe("isFireRelatedText", () => {
  it("matches fire/smoke wording", () => {
    expect(isFireRelatedText("Wildfire. Watch for traffic control.")).toBe(true);
    expect(isFireRelatedText("Smoke drifting across highway")).toBe(true);
    expect(isFireRelatedText("Bridge construction, expect delays")).toBe(false);
  });
});

describe("closure normalizers", () => {
  it("normalizes Open511 events (point + linestring geometry)", () => {
    const out = normalizeOpen511(
      [
        {
          id: "drivebc.ca/DBC-1",
          description: "Highway closed due to wildfire",
          event_type: "INCIDENT",
          severity: "MAJOR",
          updated: "2026-08-01T00:00:00Z",
          geography: { type: "Point", coordinates: [-120.3, 50.2] },
          roads: [{ name: "Highway 97" }],
        },
        {
          id: "drivebc.ca/DBC-2",
          description: "Line event",
          geography: { type: "LineString", coordinates: [[-121, 51], [-121.2, 51.1]] },
        },
        { id: "no-geo", description: "skip me" },
      ],
      "bc-open511",
      "DriveBC"
    );
    expect(out).toHaveLength(2);
    expect(out[0].road).toBe("Highway 97");
    expect(out[0].fullClosure).toBe(true);
    expect(out[0].fireRelated).toBe(true);
    expect(out[1].lat).toBe(51);
  });

  it("normalizes 511 v2 events with epoch timestamps", () => {
    const out = normalize511v2(
      [
        {
          ID: 7,
          RoadwayName: "HWY 401",
          Description: "All lanes closed",
          EventType: "closures",
          Severity: "None",
          IsFullClosure: true,
          Latitude: 42.85,
          Longitude: -81.27,
          LastUpdated: 1785654519,
        },
        { ID: 8, Description: "no coords" },
      ],
      "on-511",
      "Ontario 511"
    );
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBeNull(); // "None" normalized away
    expect(out[0].fullClosure).toBe(true);
    expect(out[0].updated).toBe(new Date(1785654519 * 1000).toISOString());
  });
});

describe("filterFireRelevant", () => {
  const activeFire = {
    name: "Near Fire",
    lat: 50.0,
    lon: -120.0,
    status: "out_of_control" as const,
    sizeHa: 1000,
  };
  const base = {
    id: "x",
    source: "s",
    sourceLabel: "S",
    road: "R",
    description: "Construction delays",
    eventType: null,
    severity: null,
    fullClosure: false,
    updated: null,
    fireRelated: false,
    nearestFireKm: null,
    nearestFireName: null,
  };

  it("keeps fire-keyword events and events near active fires, drops the rest", () => {
    const closures = [
      { ...base, id: "kw", description: "Closed due to wildfire", fireRelated: true, lat: 30, lon: -90 },
      { ...base, id: "near", lat: 50.05, lon: -120.05 },
      { ...base, id: "far", lat: 30, lon: -90 },
    ];
    const out = filterFireRelevant(closures, [activeFire]);
    expect(out.map((c) => c.id)).toEqual(["kw", "near"]);
    const near = out.find((c) => c.id === "near")!;
    expect(near.nearestFireName).toBe("Near Fire");
    expect(near.nearestFireKm).toBeLessThan(10);
  });
});
