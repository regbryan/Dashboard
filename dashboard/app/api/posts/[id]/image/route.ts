import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: post } = await supabase
    .from("posts")
    .select("file_path, brand_id")
    .eq("id", id)
    .single();

  if (!post?.file_path) {
    return Response.json({ error: "No image available" }, { status: 404 });
  }

  const fileOverride = request.nextUrl.searchParams.get("file");
  const filePath = fileOverride || post.file_path;
  const imageUrl = getImageUrl(post.brand_id, filePath);

  if (!imageUrl) {
    return Response.json({ error: "No image available" }, { status: 404 });
  }

  // Redirect to the Supabase Storage public URL
  return Response.redirect(imageUrl);
}
