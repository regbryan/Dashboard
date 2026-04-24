import { requirePostAccess, handleAuthError } from "@/lib/api-auth";
import { getImageUrl } from "@/lib/image-url";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { ctx, brandId } = await requirePostAccess(id);

    const { data: post } = await ctx.supabase
      .from("posts")
      .select("file_path")
      .eq("id", id)
      .single();

    if (!post?.file_path) {
      return Response.json({ error: "No image available" }, { status: 404 });
    }

    const fileOverride = request.nextUrl.searchParams.get("file");
    const filePath = fileOverride || post.file_path;
    const imageUrl = getImageUrl(brandId, filePath);

    if (!imageUrl) {
      return Response.json({ error: "No image available" }, { status: 404 });
    }

    return Response.redirect(imageUrl);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
