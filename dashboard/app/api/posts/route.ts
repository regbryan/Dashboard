import { supabase } from "@/lib/supabase";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const brandId = url.searchParams.get("brand_id");
  const status = url.searchParams.get("status");
  const postType = url.searchParams.get("post_type");

  let query = supabase
    .from("posts")
    .select("*, approvals(id, status, comment, created_at)")
    .order("brand_id")
    .order("post_number");

  if (brandId) query = query.eq("brand_id", brandId);
  if (status) query = query.eq("status", status);
  if (postType) query = query.eq("post_type", postType);

  const { data: posts } = await query;

  const result = (posts || []).map((row) => {
    const latestApproval = row.approvals?.length
      ? row.approvals.sort((a: { created_at: string }, b: { created_at: string }) =>
          b.created_at.localeCompare(a.created_at)
        )[0]
      : null;

    return {
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
      latest_approval: latestApproval,
    };
  });

  return Response.json(result);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, file_path, version, archetype } = body;

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (status !== undefined) updates.status = status;
  if (file_path !== undefined) updates.file_path = file_path;
  if (version !== undefined) updates.version = version;
  if (archetype !== undefined) updates.archetype = archetype;

  const { data, error } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
