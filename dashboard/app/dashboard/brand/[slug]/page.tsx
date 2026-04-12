import Link from "next/link";
import { getDb } from "@/lib/db";
import PostCard from "@/components/PostCard";

interface Brand {
  id: string;
  name: string;
  handle: string | null;
  color_primary: string | null;
  cadence: string | null;
}

interface Post {
  id: string;
  post_number: number;
  date: string;
  day: string | null;
  post_type: string;
  content_pillar: string;
  concept: string;
  status: string;
}

export default async function BrandDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status: filterStatus } = await searchParams;

  const db = getDb();

  const brand = db
    .prepare("SELECT id, name, handle, color_primary, cadence FROM brands WHERE id = ?")
    .get(slug) as Brand | undefined;

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Brand not found</h1>
          <p className="mt-2 text-gray-600">
            No brand exists with the identifier &ldquo;{slug}&rdquo;.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const posts = db
    .prepare(
      "SELECT id, post_number, date, day, post_type, content_pillar, concept, status FROM posts WHERE brand_id = ? ORDER BY post_number"
    )
    .all(slug) as Post[];

  // Compute date range
  const dates = posts
    .map((p) => p.date)
    .filter(Boolean)
    .sort();
  const dateRange =
    dates.length > 0
      ? `${dates[0]} — ${dates[dates.length - 1]}`
      : "No dates";

  // Compute status counts
  const statusCounts: Record<string, number> = {};
  for (const post of posts) {
    statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
  }

  // Filter posts if a status filter is active
  const filteredPosts = filterStatus
    ? posts.filter((p) => p.status === filterStatus)
    : posts;

  const accentColor = brand.color_primary || "#3b82f6";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        &larr; All brands
      </Link>

      {/* Brand Header */}
      <div
        className="bg-white rounded-lg shadow-sm p-6 mb-6 border-t-4"
        style={{ borderTopColor: accentColor }}
      >
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{brand.name}</h1>
          {brand.handle && (
            <span className="text-gray-500">@{brand.handle}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
          <span>{posts.length} posts</span>
          {brand.cadence && <span>Cadence: {brand.cadence}</span>}
          <span>{dateRange}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={`/dashboard/brand/${slug}`}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !filterStatus
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
          }`}
        >
          All ({posts.length})
        </Link>
        {Object.entries(statusCounts).map(([status, count]) => (
          <Link
            key={status}
            href={`/dashboard/brand/${slug}?status=${status}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterStatus === status
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
            }`}
          >
            {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}{" "}
            ({count})
          </Link>
        ))}
      </div>

      {/* Post Grid */}
      {filteredPosts.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No posts match this filter.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                id: String(post.id),
                concept: post.concept,
                date: post.date,
                post_type: post.post_type,
                content_pillar: post.content_pillar,
                status: post.status,
              }}
              brandSlug={slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
