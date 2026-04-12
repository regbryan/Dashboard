import Link from "next/link";
import { getDb } from "@/lib/db";

interface Brand {
  id: string;
  name: string;
}

interface Post {
  id: number;
  post_number: number;
  date: string | null;
  day: string | null;
  post_type: string | null;
  content_pillar: string | null;
  concept: string | null;
  status: string;
}

export default async function ClientCalendarPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  const db = getDb();

  const brandRow = db
    .prepare("SELECT id, name FROM brands WHERE id = ?")
    .get(brand) as Brand | undefined;

  if (!brandRow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Brand not found</h1>
          <p className="mt-2 text-gray-600">
            No brand exists with the identifier &ldquo;{brand}&rdquo;.
          </p>
        </div>
      </div>
    );
  }

  const posts = db
    .prepare(
      "SELECT id, post_number, date, day, post_type, content_pillar, concept, status FROM posts WHERE brand_id = ? ORDER BY date ASC"
    )
    .all(brand) as Post[];

  const reviewCount = posts.filter((p) => p.status === "in_review").length;

  const dates = posts.map((p) => p.date).filter(Boolean).sort() as string[];
  const dateRange =
    dates.length > 0
      ? `${dates[0]} — ${dates[dates.length - 1]}`
      : "No dates scheduled";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Brand Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {brandRow.name} — Content Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-1">{dateRange}</p>
        </div>

        {/* Review Badge */}
        {reviewCount > 0 && (
          <div className="mb-6 inline-block px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200">
            {reviewCount} needs your review
          </div>
        )}

        {/* Post List */}
        {posts.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            No posts scheduled yet.
          </p>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => {
              const isReview = post.status === "in_review";
              const isNotReady =
                post.status === "not_started" || post.status === "generating";

              return (
                <div
                  key={post.id}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg bg-white border border-gray-100 ${
                    isReview ? "bg-blue-50 border-blue-200" : ""
                  } ${isNotReady ? "opacity-50" : ""}`}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-12 h-[60px] rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                    {post.status !== "not_started" ? (
                      <img
                        src={`/api/posts/${post.id}/image`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-300 text-lg">—</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {post.concept || "Untitled"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {[post.date, post.day, post.post_type, post.content_pillar]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0 text-sm">
                    {post.status === "approved" && (
                      <span className="text-green-600 font-medium">
                        approved ✓
                      </span>
                    )}
                    {post.status === "in_review" && (
                      <Link
                        href={`/client/${brand}/post/${post.id}`}
                        className="text-blue-600 font-medium hover:underline"
                      >
                        review →
                      </Link>
                    )}
                    {post.status !== "approved" && post.status !== "in_review" && (
                      <span className="text-gray-400">in progress</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
