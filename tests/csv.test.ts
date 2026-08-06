import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows keyed by trimmed headers", () => {
    const rows = parseCsv(" a,b ,c\n1,2,3\n4,5,6\n");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('name,notes\n"Smith, Fire","said ""hot"""\n');
    expect(rows[0].name).toBe("Smith, Fire");
    expect(rows[0].notes).toBe('said "hot"');
  });

  it("handles CRLF and skips blank lines", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ a: "3", b: "4" });
  });

  it("returns [] for header-only or empty input", () => {
    expect(parseCsv("a,b\n")).toEqual([]);
    expect(parseCsv("")).toEqual([]);
  });

  it("parses a realistic CWFIS row", () => {
    const csv =
      "FID,id,agency_code,national_fire_id,national_fire_cause,percent_contained,fire_size,stage_of_control_status,latitude,longitude\n" +
      "x1,18019887,AB,2026_AB_SWF-054-2026,U,-1,0.5,OC,55.4693,-114.6172\n";
    const [row] = parseCsv(csv);
    expect(row.agency_code).toBe("AB");
    expect(row.stage_of_control_status).toBe("OC");
    expect(Number(row.latitude)).toBeCloseTo(55.4693);
  });
});
