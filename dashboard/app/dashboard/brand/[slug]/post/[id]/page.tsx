import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import StatusBadge from "@/components/StatusBadge";
import ApprovalHistory from "@/components/ApprovalHistory";
import ClientReviewLink from "@/components/ClientReviewLink";
import PostImageViewer from "@/components/PostImageViewer";
import Link from "next/link";
import PostActions from "./PostActions";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const { data: post } = await supabase
    .from("posts")
    .select("*, brands(name, folder_path, logo_path, platform)")
    .eq("id", id)
    .eq("brand_id", slug)
    .single();

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Post not found</h1>
          <p className="mt-2 text-gray-600">
            No post exists with ID &ldquo;{id}&rdquo; for this brand.
          </p>
          <Link
            href={`/dashboard/brand/${slug}`}
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Back to brand
          </Link>
        </div>
      </div>
    );
  }

  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, status, comment, created_at")
    .eq("post_id", post.id)
    .order("created_at");

  const brandData = post.brands as { name: string; folder_path: string; logo_path: string | null; platform: string | null } | null;
  const imageUrl = getImageUrl(post.brand_id, post.file_path);
  const thumbAspect: "portrait" | "landscape" =
    brandData?.platform === "linkedin" ? "landscape" : "portrait";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <nav className="mb-6 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          {" / "}
          <Link href={`/dashboard/brand/${slug}`} className="hover:underline">
            {brandData?.name || slug}
          </Link>
          {" / "}
          <span className="text-gray-900">Post #{post.post_number}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <PostImageViewer
              imageUrl={imageUrl}
              alt={post.concept || "Post image"}
              thumbAspect={thumbAspect}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                <span>#{post.post_number}</span>
                {post.date && (
                  <>
                    <span>&middot;</span>
                    <span>{post.date}</span>
                  </>
                )}
                {post.day && (
                  <>
                    <span>&middot;</span>
                    <span>{post.day}</span>
                  </>
                )}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                {post.concept || "Untitled Post"}
              </h1>

              <StatusBadge status={post.status} />
            </div>

            {post.caption && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Copy</h2>
                <div className="max-h-48 overflow-y-auto text-sm text-gray-800 whitespace-pre-wrap">
                  {post.caption}
                </div>
              </div>
            )}

            {post.hashtags && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Hashtags</h2>
                <p className="text-sm text-gray-800">{post.hashtags}</p>
              </div>
            )}

            {post.cta && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">CTA</h2>
                <p className="text-sm text-gray-800">{post.cta}</p>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Details</h2>
              <div className="flex flex-wrap gap-2">
                {post.post_type && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {post.post_type}
                  </span>
                )}
                {post.content_pillar && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {post.content_pillar}
                  </span>
                )}
                {post.archetype && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {post.archetype}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Actions</h2>
              <PostActions
                postId={post.id}
                currentStatus={post.status}
                hasLogo={!!brandData?.logo_path}
              />
            </div>

            <ClientReviewLink
              path={`/client/${slug}/post/${post.id}`}
              label="Share this post with client"
              emailSubject={`${brandData?.name || "Your brand"} — Post #${post.post_number} ready for review`}
              emailBody={`Hi,\n\nPost #${post.post_number} (${post.concept || "Untitled"}) is ready for your review. Tap the link below to approve or request changes:\n\n`}
            />

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
