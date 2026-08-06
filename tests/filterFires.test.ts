import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterFires, isDefaultFilters } from "@/lib/filterFires";
import type { Fire } from "@/lib/types";

const NOW = Date.parse("2026-08-03T12:00:00Z");

function fire(overrides: Partial<Fire>): Fire {
  return {
    id: "x",
    name: "Test",
    country: "CA",
    admin: "CA-BC",
    lat: 50,
    lon: -120,
    sizeHa: 100,
    containment: null,
    status: "active",
    rawStatus: null,
    cause: null,
    discovered: "2026-08-01T00:00:00Z",
    updated: "2026-08-03T00:00:00Z",
    agency: "BC Wildfire Service",
    agencyUrl: null,
    behavior: null,
    personnel: null,
    evacuation: false,
    source: "CWFIS",
    county: null,
    complexName: null,
    ...overrides,
  };
}

const fires: Fire[] = [
  fire({ id: "a", country: "CA", admin: "CA-BC", sizeHa: 5000, status: "out_of_control" }),
  fire({ id: "b", country: "US", admin: "US-OR", sizeHa: 10, status: "contained", containment: 100, agency: "US Forest Service" }),
  fire({ id: "c", country: "MX", admin: "MX", sizeHa: null, status: "info", discovered: "2026-08-03T06:00:00Z" }),
  fire({ id: "d", country: "US", admin: "US-CA", sizeHa: 800, status: "active", containment: 40, evacuation: true, agency: "CAL FIRE" }),
];

const ids = (list: Fire[]) => list.map((f) => f.id);

describe("filterFires", () => {
  it("returns everything with default filters", () => {
    expect(filterFires(fires, DEFAULT_FILTERS, NOW)).toHaveLength(4);
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it("filters by country and admin", () => {
    expect(ids(filterFires(fires, { ...DEFAULT_FILTERS, countries: ["US"] }, NOW))).toEqual(["b", "d"]);
    expect(ids(filterFires(fires, { ...DEFAULT_FILTERS, admins: ["CA-BC"] }, NOW))).toEqual(["a"]);
  });

  it("filters by status, agency and evacuation", () => {
    expect(ids(filterFires(fires, { ...DEFAULT_FILTERS, statuses: ["out_of_control"] }, NOW))).toEqual(["a"]);
    expect(ids(filterFires(fires, { ...DEFAULT_FILTERS, agencies: ["CAL FIRE"] }, NOW))).toEqual(["d"]);
    expect(ids(filterFires(fires, { ...DEFAULT_FILTERS, evacOnly: true }, NOW))).toEqual(["d"]);
  });

  it("filters by minimum size treating null as 0", () => {
    expect(ids(filterFires(fires, { ...DEFAULT_FILTERS, minSizeHa: 500 }, NOW))).toEqual(["a", "d"]);
  });

  it("narrowed containment excludes fires without a reported value", () => {
    const result = filterFires(fires, { ...DEFAULT_FILTERS, containMin: 30, containMax: 100 }, NOW);
    expect(ids(result)).toEqual(["b", "d"]);
  });

  it("filters by discovery window", () => {
    expect(ids(filterFires(fires, { ...DEFAULT_FILTERS, discoveredDays: 1 }, NOW))).toEqual(["c"]);
  });
});
