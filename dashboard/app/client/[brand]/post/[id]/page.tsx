import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import ApprovalHistory from "@/components/ApprovalHistory";
import PostImageViewer from "@/components/PostImageViewer";
import ApprovalForm from "./ApprovalForm";

export const dynamic = "force-dynamic";

export default async function ClientPostReviewPage({
  params,
}: {
  params: Promise<{ brand: string; id: string }>;
}) {
  const { brand, id } = await params;

  const { data: post } = await supabase
    .from("posts")
    .select("id, brand_id, post_number, date, day, post_type, content_pillar, concept, caption, hashtags, cta, status, file_path, brands(platform)")
    .eq("id", id)
    .eq("brand_id", brand)
    .single();

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Post not found</h1>
          <p className="mt-2 text-gray-600">
            No post exists with ID &ldquo;{id}&rdquo; for this brand.
          </p>
        </div>
      </div>
    );
  }

  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, status, comment, created_at")
    .eq("post_id", post.id)
    .order("created_at");

  const imageUrl = getImageUrl(post.brand_id, post.file_path);
  const brandPlatform = (post.brands as { platform: string | null } | null)?.platform;
  const thumbAspect: "portrait" | "landscape" =
    brandPlatform === "linkedin" ? "landscape" : "portrait";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <PostImageViewer
              imageUrl={imageUrl}
              alt={post.concept || "Post image"}
              thumbAspect={thumbAspect}
            />
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500">
                #{post.post_number} · Scheduled for {post.date || "TBD"}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                {post.concept || "Untitled Post"}
              </h1>
            </div>

            {post.caption && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Copy</h2>
                <div className="max-h-64 overflow-y-auto text-sm text-gray-800 whitespace-pre-wrap">
                  {post.caption}
                </div>
              </div>
            )}

            {post.hashtags && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Hashtags</h2>
                <p className="text-sm text-gray-800">{post.hashtags}</p>
              </div>
            )}

            {post.cta && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">CTA</h2>
                <p className="text-sm text-gray-800">{post.cta}</p>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-6">
              <ApprovalForm postId={post.id} status={post.status} />
            </div>

            {(approvals || []).length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Approval History
                </h2>
                <ApprovalHistory approvals={approvals || []} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
