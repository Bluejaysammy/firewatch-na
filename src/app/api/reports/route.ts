import { getSessionUser, originAllowed } from "@/lib/server/auth";
import {
  canPostReport,
  createReport,
  listReports,
  reportSchema,
  storePhoto,
  MAX_PHOTO_BYTES,
} from "@/lib/server/community";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, "data", 120);
  if (limited) return limited;
  return jsonResponse({ reports: listReports() }, 200, 60);
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const limited = rateLimit(req, "post", 20);
  if (limited) return limited;
  if (!originAllowed(req)) return errorResponse("Bad origin", 403);

  const user = getSessionUser(req);
  if (!user) return errorResponse("Sign in to post a report", 401);
  if (!canPostReport(user.id)) {
    return errorResponse("Posting limit reached (6 reports per hour) — thanks for contributing, please pace it out", 429);
  }

  let fields: Record<string, unknown> = {};
  let photoFile: File | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      fields = {
        kind: form.get("kind"),
        body: form.get("body"),
        lat: form.get("lat"),
        lon: form.get("lon"),
      };
      const p = form.get("photo");
      if (p instanceof File && p.size > 0) photoFile = p;
    } else {
      fields = (await req.json()) as Record<string, unknown>;
    }
  } catch {
    return errorResponse("Malformed request body", 400);
  }

  const parsed = reportSchema.safeParse(fields);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid report", 400);
  }

  let photoName: string | null = null;
  if (photoFile) {
    if (!PHOTO_TYPES.has(photoFile.type)) {
      return errorResponse("Photos must be JPEG, PNG or WebP", 400);
    }
    if (photoFile.size > MAX_PHOTO_BYTES) {
      return errorResponse("Photos must be under 6 MB", 400);
    }
    try {
      photoName = await storePhoto(Buffer.from(await photoFile.arrayBuffer()));
    } catch {
      return errorResponse("That image could not be processed", 400);
    }
  }

  const report = createReport(user, parsed.data, photoName);
  return jsonResponse({ report }, 201);
}
