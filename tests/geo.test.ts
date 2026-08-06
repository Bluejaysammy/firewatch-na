import { describe, expect, it } from "vitest";
import { pointInGeometry, roundBbox } from "@/lib/geo";

const square = {
  type: "Polygon",
  coordinates: [
    [
      [-120, 49],
      [-110, 49],
      [-110, 55],
      [-120, 55],
      [-120, 49],
    ],
  ],
};

const withHole = {
  type: "Polygon",
  coordinates: [
    square.coordinates[0],
    [
      [-117, 51],
      [-113, 51],
      [-113, 53],
      [-117, 53],
      [-117, 51],
    ],
  ],
};

describe("pointInGeometry", () => {
  it("detects points inside and outside a polygon", () => {
    expect(pointInGeometry(-115, 52, square)).toBe(true);
    expect(pointInGeometry(-125, 52, square)).toBe(false);
  });

  it("excludes points inside holes", () => {
    expect(pointInGeometry(-115, 52, withHole)).toBe(false);
    expect(pointInGeometry(-119, 50, withHole)).toBe(true);
  });

  it("supports MultiPolygon and null geometry", () => {
    const multi = { type: "MultiPolygon", coordinates: [square.coordinates] };
    expect(pointInGeometry(-115, 52, multi)).toBe(true);
    expect(pointInGeometry(-115, 52, null)).toBe(false);
  });
});

describe("roundBbox", () => {
  it("rounds outward on a grid", () => {
    expect(roundBbox([-123.4, 49.1, -122.9, 49.6], 0.5)).toEqual([
      -123.5, 49, -122.5, 50,
    ]);
  });
});
