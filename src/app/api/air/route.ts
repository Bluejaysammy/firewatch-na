import { z } from "zod";
import { cached } from "@/lib/server/cache";
import { errorResponse, fetchJson, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import type { AirQuality } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

interface OpenMeteoAq {
  current?: { time?: string; us_aqi?: number; pm2_5?: number; pm10?: number };
  hourly?: { time?: string[]; us_aqi?: (number | null)[] };
}

export async function GET(req: Request) {
  const limited = rateLimit(req, "point", 60);
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return errorResponse("lat/lon required", 400);
  const lat = parsed.data.lat.toFixed(2);
  const lon = parsed.data.lon.toFixed(2);

  try {
    const { value } = await cached(`air:${lat},${lon}`, 10 * 60 * 1000, async () => {
      const d = await fetchJson<OpenMeteoAq>(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
          `&current=us_aqi,pm2_5,pm10&hourly=us_aqi&forecast_days=2&timezone=UTC`
      );
      const hourly: AirQuality["hourly"] = [];
      const times = d.hourly?.time ?? [];
      const aqis = d.hourly?.us_aqi ?? [];
      const now = Date.now();
      for (let i = 0; i < times.length && hourly.length < 24; i++) {
        const t = new Date(`${times[i]}Z`).getTime();
        if (t >= now) hourly.push({ time: `${times[i]}Z`, usAqi: aqis[i] ?? null });
      }
      const aq: AirQuality = {
        usAqi: d.current?.us_aqi ?? null,
        pm25: d.current?.pm2_5 ?? null,
        pm10: d.current?.pm10 ?? null,
        time: d.current?.time ? `${d.current.time}Z` : null,
        hourly,
      };
      return aq;
    });
    return jsonResponse(value, 200, 300);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Air quality lookup failed",
      502
    );
  }
}
