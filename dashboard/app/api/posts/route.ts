import type { NextRequest } from "next/server";
import {
  requireUser,
  requirePostAccess,
  handleAuthError,
} from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireUser();
    const url = new URL(request.url);
    const brandId = url.searchParams.get("brand_id");
    const status = url.searchParams.get("status");
    const postType = url.searchParams.get("post_type");

    // If non-admin, restrict to brands they have access to.
    let accessibleIds: string[] | null = null;
    if (!ctx.isAdmin) {
      const { data } = await ctx.supabase
        .from("user_brand_access")
        .select("brand_id")
        .eq("user_id", ctx.user.id);
      accessibleIds = (data || []).map((r: { brand_id: string }) => r.brand_id);
      if (brandId && !accessibleIds.includes(brandId)) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      if (accessibleIds.length === 0) return Response.json([]);
    }

    let query = ctx.supabase
      .from("posts")
      .select("*, approvals(id, status, comment, created_at)")
      .order("brand_id")
      .order("post_number");

    if (brandId) query = query.eq("brand_id", brandId);
    else if (accessibleIds) query = query.in("brand_id", accessibleIds);
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
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, file_path, version, archetype } = body;

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const { ctx } = await requirePostAccess(id);

    // Only admins can change file_path / version / archetype (asset management).
    // Clients can only toggle status within approval states.
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      const allowedClientStatus = ["approved", "changes_requested", "in_review"];
      if (!ctx.isAdmin && !allowedClientStatus.includes(status)) {
        return Response.json({ error: "forbidden status" }, { status: 403 });
      }
      updates.status = status;
    }
    if (ctx.isAdmin) {
      if (file_path !== undefined) updates.file_path = file_path;
      if (version !== undefined) updates.version = version;
      if (archetype !== undefined) updates.archetype = archetype;
    } else if (
      file_path !== undefined ||
      version !== undefined ||
      archetype !== undefined
    ) {
      return Response.json(
        { error: "forbidden: admin fields" },
        { status: 403 }
      );
    }

    const { data, error } = await ctx.supabase
      .from("posts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}

