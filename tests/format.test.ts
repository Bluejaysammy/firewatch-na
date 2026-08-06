import { describe, expect, it } from "vitest";
import {
  acresToHa,
  formatArea,
  haToAcres,
  parseCoordinates,
} from "@/lib/format";

describe("unit conversion", () => {
  it("round-trips hectares and acres", () => {
    expect(haToAcres(acresToHa(1000))).toBeCloseTo(1000);
    expect(acresToHa(1)).toBeCloseTo(0.404686, 5);
  });
});

describe("formatArea", () => {
  it("shows both units and handles null", () => {
    expect(formatArea(null)).toBe("Not reported");
    expect(formatArea(1000)).toMatch(/ha/);
    expect(formatArea(1000)).toMatch(/ac\)/);
  });
});

describe("parseCoordinates", () => {
  it("parses decimal pairs", () => {
    expect(parseCoordinates("49.28, -123.12")).toEqual({ lat: 49.28, lon: -123.12 });
    expect(parseCoordinates("49.28 -123.12")).toEqual({ lat: 49.28, lon: -123.12 });
  });

  it("parses hemisphere notation", () => {
    expect(parseCoordinates("49.28N 123.12W")).toEqual({ lat: 49.28, lon: -123.12 });
    expect(parseCoordinates("N49.28, W123.12")).toEqual({ lat: 49.28, lon: -123.12 });
    expect(parseCoordinates("19.4S 99.1W")).toEqual({ lat: -19.4, lon: -99.1 });
  });

  it("rejects out-of-range and non-coordinates", () => {
    expect(parseCoordinates("95, 10")).toBeNull();
    expect(parseCoordinates("Kelowna")).toBeNull();
    expect(parseCoordinates("49.28")).toBeNull();
  });
});
