import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getDb, UPLOADS_DIR } from "./db";

/**
 * Community wildfire reports: user-submitted, clearly labelled as
 * unverified in the UI. Safety rails:
 * - text only (rendered as text, never HTML), length-capped, zod-validated
 * - photos re-encoded to JPEG via sharp, which strips EXIF (incl. GPS) and
 *   neutralizes malformed/polyglot files; size-capped before processing
 * - per-user posting quotas enforced in the database
 * - community flagging auto-hides a report at three unique flags
 * - reports older than REPORT_MAX_AGE_DAYS stop being served (stale smoke
 *   reports are misinformation)
 */

export const reportSchema = z.object({
  kind: z.enum(["smoke", "fire", "note"]),
  body: z.string().trim().min(3).max(1000),
  lat: z.coerce.number().min(14).max(84),
  lon: z.coerce.number().min(-179).max(-40),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const REPORT_MAX_AGE_DAYS = Number(process.env.REPORT_MAX_AGE_DAYS ?? 7);
const REPORTS_PER_HOUR = 6;
const COMMENTS_PER_HOUR = 30;
const FLAGS_TO_HIDE = 3;

export interface PublicReport {
  id: number;
  kind: "smoke" | "fire" | "note";
  body: string;
  lat: number;
  lon: number;
  photoUrl: string | null;
  username: string;
  createdAt: number;
  commentCount: number;
  flagged: boolean;
}

export function listReports(): PublicReport[] {
  const db = getDb();
  const cutoff = Date.now() - REPORT_MAX_AGE_DAYS * 86_400_000;
  const rows = db
    .prepare(
      `SELECT r.id, r.kind, r.body, r.lat, r.lon, r.photo, r.username, r.created_at,
              (SELECT COUNT(*) FROM comments c WHERE c.report_id = r.id) AS comment_count
       FROM reports r
       WHERE r.status = 'visible' AND r.created_at >= ?
       ORDER BY r.created_at DESC LIMIT 1000`
    )
    .all(cutoff) as {
    id: number; kind: "smoke" | "fire" | "note"; body: string; lat: number; lon: number;
    photo: string | null; username: string; created_at: number; comment_count: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    lat: r.lat,
    lon: r.lon,
    photoUrl: r.photo ? `/api/media/${r.photo}` : null,
    username: r.username,
    createdAt: r.created_at,
    commentCount: r.comment_count,
    flagged: false,
  }));
}

export function userReportCountLastHour(userId: number): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND created_at >= ?")
      .get(userId, Date.now() - 3_600_000) as { n: number }
  ).n;
}

export function userCommentCountLastHour(userId: number): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at >= ?")
      .get(userId, Date.now() - 3_600_000) as { n: number }
  ).n;
}

export function canPostReport(userId: number): boolean {
  return userReportCountLastHour(userId) < REPORTS_PER_HOUR;
}

export function canPostComment(userId: number): boolean {
  return userCommentCountLastHour(userId) < COMMENTS_PER_HOUR;
}

/** Re-encode an uploaded image: strips all metadata, bounds dimensions. */
export async function storePhoto(buffer: Buffer): Promise<string> {
  const out = await sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate() // apply EXIF orientation before metadata is discarded
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  const name = `${randomUUID()}.jpg`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), out);
  return name;
}

export function createReport(
  user: { id: number; username: string },
  input: z.infer<typeof reportSchema>,
  photo: string | null
): PublicReport {
  const now = Date.now();
  const info = getDb()
    .prepare(
      `INSERT INTO reports (user_id, username, kind, body, lat, lon, photo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(user.id, user.username, input.kind, input.body, input.lat, input.lon, photo, now);
  return {
    id: Number(info.lastInsertRowid),
    kind: input.kind,
    body: input.body,
    lat: input.lat,
    lon: input.lon,
    photoUrl: photo ? `/api/media/${photo}` : null,
    username: user.username,
    createdAt: now,
    commentCount: 0,
    flagged: false,
  };
}

export function listComments(reportId: number) {
  return getDb()
    .prepare(
      "SELECT id, username, body, created_at AS createdAt FROM comments WHERE report_id = ? ORDER BY created_at ASC LIMIT 200"
    )
    .all(reportId);
}

export function reportExists(reportId: number): boolean {
  return !!getDb()
    .prepare("SELECT 1 FROM reports WHERE id = ? AND status = 'visible'")
    .get(reportId);
}

export function addComment(
  user: { id: number; username: string },
  reportId: number,
  body: string
) {
  const now = Date.now();
  const info = getDb()
    .prepare(
      "INSERT INTO comments (report_id, user_id, username, body, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(reportId, user.id, user.username, body, now);
  return { id: Number(info.lastInsertRowid), username: user.username, body, createdAt: now };
}

/** Returns the new flag count; auto-hides at the threshold. */
export function flagReport(userId: number, reportId: number): number {
  const db = getDb();
  try {
    db.prepare("INSERT INTO flags (report_id, user_id, created_at) VALUES (?, ?, ?)").run(
      reportId,
      userId,
      Date.now()
    );
  } catch {
    /* duplicate flag — idempotent */
  }
  const n = (db.prepare("SELECT COUNT(*) AS n FROM flags WHERE report_id = ?").get(reportId) as { n: number }).n;
  if (n >= FLAGS_TO_HIDE) {
    db.prepare("UPDATE reports SET status = 'hidden' WHERE id = ? AND status = 'visible'").run(reportId);
  }
  return n;
}

/** Owner or admin removal. Returns false when not permitted. */
export function removeReport(
  user: { id: number; role: string },
  reportId: number
): boolean {
  const db = getDb();
  const row = db.prepare("SELECT user_id, photo FROM reports WHERE id = ?").get(reportId) as
    | { user_id: number; photo: string | null }
    | undefined;
  if (!row) return false;
  if (row.user_id !== user.id && user.role !== "admin") return false;
  db.prepare("UPDATE reports SET status = 'removed' WHERE id = ?").run(reportId);
  if (row.photo && /^[a-f0-9-]+\.jpg$/.test(row.photo)) {
    try {
      fs.unlinkSync(path.join(UPLOADS_DIR, row.photo));
    } catch {
      /* photo already gone */
    }
  }
  return true;
}
