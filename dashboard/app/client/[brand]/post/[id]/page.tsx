import { getDb } from "@/lib/db";
import ApprovalHistory from "@/components/ApprovalHistory";
import ApprovalForm from "./ApprovalForm";

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
}

interface Approval {
  id: string;
  status: string;
  comment: string | null;
  created_at: string;
}

export default async function ClientPostReviewPage({
  params,
}: {
  params: Promise<{ brand: string; id: string }>;
}) {
  const { brand, id } = await params;
  const db = getDb();

  const post = db
    .prepare(
      `SELECT id, brand_id, post_number, date, day, post_type, content_pillar, concept, caption, status
       FROM posts
       WHERE id = ? AND brand_id = ?`
    )
    .get(id, brand) as Post | undefined;

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

  const approvals = db
    .prepare(
      "SELECT id, status, comment, created_at FROM approvals WHERE post_id = ? ORDER BY created_at ASC"
    )
    .all(post.id) as Approval[];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column — Image */}
          <div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <img
                src={`/api/posts/${post.id}/image`}
                alt={post.concept || "Post image"}
                className="w-full aspect-[4/5] object-cover"
              />
            </div>
          </div>

          {/* Right column — Details & Approval */}
          <div className="space-y-6">
            {/* Post header */}
            <div>
              <p className="text-sm text-gray-500">
                #{post.post_number} · Scheduled for {post.date || "TBD"}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                {post.concept || "Untitled Post"}
              </h1>
            </div>

            {/* Caption */}
            {post.caption && (
              <div className="max-h-64 overflow-y-auto text-sm text-gray-800 whitespace-pre-wrap bg-white rounded-lg shadow p-4">
                {post.caption}
              </div>
            )}

            {/* Approval Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <ApprovalForm postId={post.id} status={post.status} />
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
