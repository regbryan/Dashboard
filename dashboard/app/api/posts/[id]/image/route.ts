import { getDb } from "@/lib/db";
import { postImagePath } from "@/lib/paths";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const post = db
    .prepare(
      `
    SELECT p.file_path, b.folder_path
    FROM posts p
    JOIN brands b ON b.id = p.brand_id
    WHERE p.id = ?
    `
    )
    .get(id) as { file_path: string | null; folder_path: string } | undefined;

  if (!post) {
    return Response.json({ error: "No image available" }, { status: 404 });
  }

  // Allow ?file= query param to override file_path (for version history)
  const fileOverride = request.nextUrl.searchParams.get("file");
  const filePath = fileOverride || post.file_path;

  if (!filePath) {
    return Response.json({ error: "No image available" }, { status: 404 });
  }

  const fullPath = postImagePath(post.folder_path, filePath);

  if (!fs.existsSync(fullPath)) {
    return Response.json({ error: "No image available" }, { status: 404 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".mp4": "video/mp4",
    ".webp": "image/webp",
  };

  const contentType = contentTypeMap[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(fullPath);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=60",
    },
  });
}
