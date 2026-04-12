import { getDb } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;

  const brandId = searchParams.get("brand_id");
  const status = searchParams.get("status");
  const postType = searchParams.get("post_type");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (brandId) {
    conditions.push("p.brand_id = ?");
    params.push(brandId);
  }
  if (status) {
    conditions.push("p.status = ?");
    params.push(status);
  }
  if (postType) {
    conditions.push("p.post_type = ?");
    params.push(postType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const posts = db
    .prepare(
      `
    SELECT
      p.*,
      a.id AS approval_id,
      a.status AS approval_status,
      a.comment AS approval_comment,
      a.created_at AS approval_created_at
    FROM posts p
    LEFT JOIN (
      SELECT a1.*
      FROM approvals a1
      INNER JOIN (
        SELECT post_id, MAX(created_at) AS max_created_at
        FROM approvals
        GROUP BY post_id
      ) a2 ON a1.post_id = a2.post_id AND a1.created_at = a2.max_created_at
    ) a ON a.post_id = p.id
    ${where}
    ORDER BY p.brand_id, p.post_number
    `
    )
    .all(...params) as Array<Record<string, unknown>>;

  const result = posts.map((row) => ({
    id: row.id,
    brand_id: row.brand_id,
    post_number: row.post_number,
    date: row.date,
    day: row.day,
    post_type: row.post_type,
    content_pillar: row.content_pillar,
    concept: row.concept,
    caption: row.caption,
    hashtags: row.hashtags,
    cta: row.cta,
    visual_direction: row.visual_direction,
    status: row.status,
    file_path: row.file_path,
    version: row.version,
    archetype: row.archetype,
    created_at: row.created_at,
    updated_at: row.updated_at,
    latest_approval: row.approval_id
      ? {
          id: row.approval_id,
          status: row.approval_status,
          comment: row.approval_comment,
          created_at: row.approval_created_at,
        }
      : null,
  }));

  return Response.json(result);
}

export async function PATCH(request: NextRequest) {
  const db = getDb();
  const body = await request.json();

  const { id, status, file_path, version, archetype } = body;

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (status !== undefined) {
    updates.push("status = ?");
    params.push(status);
  }
  if (file_path !== undefined) {
    updates.push("file_path = ?");
    params.push(file_path);
  }
  if (version !== undefined) {
    updates.push("version = ?");
    params.push(version);
  }
  if (archetype !== undefined) {
    updates.push("archetype = ?");
    params.push(archetype);
  }

  if (updates.length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id);

  db.prepare(`UPDATE posts SET ${updates.join(", ")} WHERE id = ?`).run(
    ...params
  );

  const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(id);
  return Response.json(updated);
}
