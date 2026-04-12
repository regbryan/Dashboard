import { getDb } from "@/lib/db";
import { getVersionHistory } from "@/lib/versions";
import StatusBadge from "@/components/StatusBadge";
import ApprovalHistory from "@/components/ApprovalHistory";
import Link from "next/link";
import PostActions from "./PostActions";
import VersionTabs from "./VersionTabs";

interface Post {
  id: number;
  brand_id: string;
  post_number: number;
  date: string | null;
  day: string | null;
  post_type: string | null;
  content_pillar: string | null;
  concept: string | null;
  caption: string | null;
  status: string;
  file_path: string | null;
  archetype: string | null;
}

interface Brand {
  id: string;
  name: string;
  folder_path: string;
  logo_path: string | null;
}

interface Approval {
  id: string;
  status: string;
  comment: string | null;
  created_at: string;
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const db = getDb();

  const post = db
    .prepare(
      `SELECT p.*, b.name as brand_name, b.folder_path, b.logo_path
       FROM posts p
       JOIN brands b ON b.id = p.brand_id
       WHERE p.id = ? AND p.brand_id = ?`
    )
    .get(id, slug) as (Post & { brand_name: string; folder_path: string; logo_path: string | null }) | undefined;

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

  const approvals = db
    .prepare("SELECT id, status, comment, created_at FROM approvals WHERE post_id = ? ORDER BY created_at ASC")
    .all(post.id) as Approval[];

  const versions = post.file_path
    ? getVersionHistory(post.folder_path, post.file_path)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          {" / "}
          <Link href={`/dashboard/brand/${slug}`} className="hover:underline">
            {post.brand_name}
          </Link>
          {" / "}
          <span className="text-gray-900">Post #{post.post_number}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column — Image & Versions */}
          <div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {post.file_path ? (
                <VersionTabs
                  postId={post.id}
                  versions={versions}
                  currentFilePath={post.file_path}
                />
              ) : (
                <div className="aspect-[4/5] bg-gray-100 flex items-center justify-center text-gray-400">
                  No image generated
                </div>
              )}
            </div>
          </div>

          {/* Right column — Metadata & Actions */}
          <div className="space-y-6">
            {/* Post header */}
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

            {/* Caption */}
            {post.caption && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Caption</h2>
                <div className="max-h-48 overflow-y-auto text-sm text-gray-800 whitespace-pre-wrap">
                  {post.caption}
                </div>
              </div>
            )}

            {/* Labels */}
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

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Actions</h2>
              <PostActions
                postId={post.id}
                currentStatus={post.status}
                hasLogo={!!post.logo_path}
              />
            </div>

            {/* Approval History */}
            {approvals.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Approval History
                </h2>
                <ApprovalHistory approvals={approvals} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
