import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const brands = db
    .prepare(
      `
    SELECT
      b.id,
      b.name,
      b.handle,
      b.platform,
      b.color_primary,
      b.color_secondary,
      b.color_accent,
      b.cadence,
      COALESCE(SUM(CASE WHEN p.status = 'not_started' THEN 1 ELSE 0 END), 0) AS not_started,
      COALESCE(SUM(CASE WHEN p.status = 'generating' THEN 1 ELSE 0 END), 0) AS generating,
      COALESCE(SUM(CASE WHEN p.status = 'in_review' THEN 1 ELSE 0 END), 0) AS in_review,
      COALESCE(SUM(CASE WHEN p.status = 'changes_requested' THEN 1 ELSE 0 END), 0) AS changes_requested,
      COALESCE(SUM(CASE WHEN p.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
      COALESCE(SUM(CASE WHEN p.status = 'scheduled' THEN 1 ELSE 0 END), 0) AS scheduled,
      COALESCE(SUM(CASE WHEN p.status = 'posted' THEN 1 ELSE 0 END), 0) AS posted,
      COUNT(p.id) AS total
    FROM brands b
    LEFT JOIN posts p ON p.brand_id = b.id
    GROUP BY b.id
    ORDER BY b.name
    `
    )
    .all() as Array<Record<string, unknown>>;

  const result = brands.map((row) => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    platform: row.platform,
    colorPrimary: row.color_primary ?? null,
    colorSecondary: row.color_secondary ?? null,
    colorAccent: row.color_accent ?? null,
    cadence: row.cadence,
    stats: {
      not_started: row.not_started as number,
      generating: row.generating as number,
      in_review: row.in_review as number,
      changes_requested: row.changes_requested as number,
      approved: row.approved as number,
      scheduled: row.scheduled as number,
      posted: row.posted as number,
      total: row.total as number,
    },
  }));

  return Response.json(result);
}
