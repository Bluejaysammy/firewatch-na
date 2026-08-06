import { z } from "zod";
import { cached } from "@/lib/server/cache";
import { errorResponse, fetchJson, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";
import type { SpotWeather } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

interface OpenMeteoWx {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    wind_direction_10m?: number;
    precipitation?: number;
  };
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
    const { value } = await cached(`wx:${lat},${lon}`, 10 * 60 * 1000, async () => {
      const d = await fetchJson<OpenMeteoWx>(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation` +
          `&timezone=UTC`
      );
      const wx: SpotWeather = {
        tempC: d.current?.temperature_2m ?? null,
        rh: d.current?.relative_humidity_2m ?? null,
        windKmh: d.current?.wind_speed_10m ?? null,
        windGustKmh: d.current?.wind_gusts_10m ?? null,
        windDir: d.current?.wind_direction_10m ?? null,
        precipMm: d.current?.precipitation ?? null,
        time: d.current?.time ? `${d.current.time}Z` : null,
      };
      return wx;
    });
    return jsonResponse(value, 200, 300);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Weather lookup failed",
      502
    );
  }
}
