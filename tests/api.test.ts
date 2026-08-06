import { beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/server/rateLimit";

function reqWithIp(ip: string, url = "http://localhost/api/fires"): Request {
  return new Request(url, { headers: { "x-forwarded-for": ip } });
}

describe("rateLimit", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_DISABLED = "";
  });

  it("allows requests under the limit and blocks above it", () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 250)}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(reqWithIp(ip), "test-group", 5)).toBeNull();
    }
    const blocked = rateLimit(reqWithIp(ip), "test-group", 5);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });

  it("tracks IPs independently", () => {
    expect(rateLimit(reqWithIp("10.1.1.1"), "iso", 1)).toBeNull();
    expect(rateLimit(reqWithIp("10.1.1.2"), "iso", 1)).toBeNull();
    expect(rateLimit(reqWithIp("10.1.1.1"), "iso", 1)?.status).toBe(429);
  });

  it("can be disabled via env", () => {
    process.env.RATE_LIMIT_DISABLED = "1";
    const ip = "10.2.2.2";
    for (let i = 0; i < 20; i++) {
      expect(rateLimit(reqWithIp(ip), "off", 1)).toBeNull();
    }
  });
});

describe("/api/fires input validation", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_DISABLED = "1";
    vi.resetModules();
  });

  it("rejects malformed query parameters with 400", async () => {
    const { GET } = await import("@/app/api/fires/route");
    const res = await GET(new Request("http://localhost/api/fires?country=FRANCE"));
    expect(res.status).toBe(400);
    const res2 = await GET(
      new Request("http://localhost/api/fires?minSizeHa=-5")
    );
    expect(res2.status).toBe(400);
  });

  it("serves merged fires with filters applied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("WFIGS_Incident_Locations")) {
          return new Response(
            JSON.stringify({
              type: "FeatureCollection",
              features: [
                {
                  geometry: { type: "Point", coordinates: [-120, 44] },
                  properties: {
                    IncidentName: "A",
                    IncidentSize: 10,
                    PercentContained: 0,
                    POOState: "US-OR",
                    IncidentTypeCategory: "WF",
                    UniqueFireIdentifier: "u1",
                  },
                },
              ],
            }),
            { status: 200 }
          );
        }
        if (url.includes("activefires.csv")) {
          return new Response(
            "id,agency_code,national_fire_id,percent_contained,fire_size,stage_of_control_status,latitude,longitude\n" +
              "1,BC,ca1,-1,50,OC,50.0,-120.0\n",
            { status: 200 }
          );
        }
        // hotspots + alerts
        return new Response(
          JSON.stringify({ type: "FeatureCollection", features: [] }),
          { status: 200 }
        );
      })
    );
    const { GET } = await import("@/app/api/fires/route");
    const res = await GET(new Request("http://localhost/api/fires"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      fires: { id: string; country: string }[];
      sources: { ok: boolean }[];
    };
    expect(body.fires.length).toBe(2);
    expect(body.sources.every((s) => s.ok)).toBe(true);

    const filtered = await GET(new Request("http://localhost/api/fires?country=CA"));
    const fb = (await filtered.json()) as { fires: { country: string }[] };
    expect(fb.fires.every((f) => f.country === "CA")).toBe(true);
    vi.unstubAllGlobals();
  });
});
