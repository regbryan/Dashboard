import { supabase } from "@/lib/supabase";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
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

  const { data: post } = await supabase
    .from("posts")
    .select("id")
    .eq("id", post_id)
    .single();

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  const { data: approval, error } = await supabase
    .from("approvals")
    .insert({ post_id, status, comment: comment || null, created_at: now })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("posts")
    .update({ status, updated_at: now })
    .eq("id", post_id);

  return Response.json(approval);
}
