import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateBrandPost, type AutopilotPostRow } from "@/lib/autopilot/pipeline";

// One Gemini image gen + upload. ~10-30s typical, cap at 120 to be safe.
export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: idStr } = await params;
    const postId = Number(idStr);
    if (!Number.isFinite(postId)) {
      return Response.json({ ok: false, error: "invalid post id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
      .from("posts")
      .select(
        "id, brand_id, post_number, date, post_type, content_pillar, concept, caption, visual_direction, file_path, status"
      )
      .eq("id", postId)
      .maybeSingle();
    if (error || !data) {
      return Response.json({ ok: false, error: "post not found" }, { status: 404 });
    }

    const result = await generateBrandPost(data as AutopilotPostRow, {
      regenerate: true,
    });
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 400 });
    }
    return Response.json(result);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
