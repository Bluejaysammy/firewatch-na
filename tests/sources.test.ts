import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCaFires, mexicoFiresFromHotspots } from "@/lib/server/sources/cwfis";
import { fetchUsFires } from "@/lib/server/sources/wfigs";

const CWFIS_CSV =
  " FID,id,agency_code,region_code,national_fire_id,agency_fire_id,national_fire_cause,fire_type_ics,severity_nearest_dsr,fire_was_prescribed,percent_contained,fire_size,response_type,stage_of_control_status,situation_report_date,status_date,latitude,longitude,geometry,fire_year,status_year,record_start,record_end\n" +
  "f1,18019887,AB,SWF,2026_AB_SWF-054-2026,SWF-054-2026,U,5,-1,-1,-1,0.5,FUL,OC,2026-07-16T14:33:00,2026-07-16T14:33:00,55.4693,-114.6172,POINT (1 2),2026,2026,2026-07-16T20:45:00,2026-12-31T23:59:59.999\n" +
  "f2,18019603,QC,HWF,2026_QC_X-1,X-1,N,5,-1,-1,60,1200,FUL,UC,2026-07-16T14:37:00,2026-07-17T09:00:00,48.1,-77.2,POINT (1 2),2026,2026,2026-07-16T20:45:00,2026-12-31T23:59:59.999\n";

const WFIGS_PAGE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-120.5, 44.8] },
      properties: {
        IncidentName: "Rowe Creek",
        IncidentSize: 324000,
        PercentContained: 60,
        FireDiscoveryDateTime: 1768000000000,
        ModifiedOnDateTime_dt: 1785800000000,
        FireCause: "Human",
        FireCauseGeneral: null,
        POOState: "US-OR",
        POOCounty: "Wheeler",
        IncidentTypeCategory: "WF",
        POOProtectingAgency: "BLM",
        UniqueFireIdentifier: "2026-ORPRD-000391",
        FireBehaviorGeneral: "Active",
        TotalIncidentPersonnel: 1739,
        IncidentManagementOrganization: null,
        CpxName: null,
        FireOutDateTime: null,
        ContainmentDateTime: null,
      },
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchCaFires", () => {
  it("normalizes CWFIS CSV rows into unified fires", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(CWFIS_CSV, { status: 200 }))
    );
    const fires = await fetchCaFires();
    expect(fires).toHaveLength(2);
    const [ab, qc] = fires;
    expect(ab.id).toBe("ca-2026_AB_SWF-054-2026");
    expect(ab.country).toBe("CA");
    expect(ab.admin).toBe("CA-AB");
    expect(ab.status).toBe("out_of_control");
    expect(ab.sizeHa).toBe(0.5);
    expect(ab.containment).toBeNull(); // -1 means unknown
    expect(ab.agency).toBe("Alberta Wildfire");
    expect(qc.status).toBe("under_control");
    expect(qc.containment).toBe(60);
    expect(qc.agency).toBe("SOPFEU (Québec)");
    expect(qc.cause).toBe("Natural (lightning)");
  });
});

describe("fetchUsFires", () => {
  it("normalizes WFIGS GeoJSON into unified fires (acres -> ha)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(WFIGS_PAGE), { status: 200 }))
    );
    const fires = await fetchUsFires();
    expect(fires).toHaveLength(1);
    const f = fires[0];
    expect(f.id).toBe("us-2026-ORPRD-000391");
    expect(f.admin).toBe("US-OR");
    expect(f.sizeHa).toBeCloseTo(324000 * 0.404686, 0);
    expect(f.status).toBe("active"); // 60% contained
    expect(f.agency).toBe("Bureau of Land Management");
    expect(f.updated).toBe(new Date(1785800000000).toISOString());
  });

  it("throws on upstream failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    await expect(fetchUsFires()).rejects.toThrow(/503/);
  });
});

describe("mexicoFiresFromHotspots", () => {
  it("keeps only MX detections and marks them informational", () => {
    const fires = mexicoFiresFromHotspots([
      { lat: 25.9, lon: -98.0, agency: "MX", sensor: "VIIRS-I", reportedAt: "2026-08-03T18:11:00Z", frp: 2.7, estAreaHa: 14.2 },
      { lat: 30.3, lon: -89.6, agency: "MS", sensor: "VIIRS-I", reportedAt: null, frp: 1, estAreaHa: null },
    ]);
    expect(fires).toHaveLength(1);
    expect(fires[0].country).toBe("MX");
    expect(fires[0].status).toBe("info");
    expect(fires[0].source).toBe("CWFIS_HOTSPOT");
  });
});
