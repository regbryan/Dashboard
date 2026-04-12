import { getDb } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();

  const { post_id, status, comment } = body;

  if (!post_id || !status) {
    return Response.json(
      { error: "post_id and status are required" },
      { status: 400 }
    );
  }

  if (status !== "approved" && status !== "changes_requested") {
    return Response.json(
      { error: 'status must be "approved" or "changes_requested"' },
      { status: 400 }
    );
  }

  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(post_id);
  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Insert approval record
  const result = db
    .prepare(
      "INSERT INTO approvals (post_id, status, comment, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(post_id, status, comment || null, now);

  // Update post status and updated_at
  db.prepare("UPDATE posts SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    now,
    post_id
  );

  const approval = db
    .prepare("SELECT * FROM approvals WHERE id = ?")
    .get(result.lastInsertRowid);

  return Response.json(approval);
}
