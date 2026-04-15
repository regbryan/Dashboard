import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PostCard from "@/components/PostCard";
import ClientReviewLink from "@/components/ClientReviewLink";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; filter?: string }>;
}) {
  const { slug } = await params;
  const { status: filterStatus, filter } = await searchParams;

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, handle, color_primary, cadence, compliance")
    .eq("id", slug)
    .single();

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

  const { data: posts } = await supabase
    .from("posts")
    .select("id, post_number, date, day, post_type, content_pillar, concept, status, file_path")
    .eq("brand_id", slug)
    .order("post_number");

  const allPosts = posts || [];

  const dates = allPosts.map((p) => p.date).filter(Boolean).sort();
  const dateRange =
    dates.length > 0
      ? `${dates[0]} — ${dates[dates.length - 1]}`
      : "No dates";

  const statusCounts: Record<string, number> = {};
  for (const post of allPosts) {
    statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
  }

  const needsGeneration = allPosts.filter((p) => !p.file_path).length;

  let filteredPosts = allPosts;
  if (filter === "needs_generation") {
    filteredPosts = allPosts.filter((p) => !p.file_path);
  } else if (filterStatus) {
    filteredPosts = allPosts.filter((p) => p.status === filterStatus);
  }

  const accentColor = brand.color_primary || "#3b82f6";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        &larr; All brands
      </Link>

      <div
        className="bg-white rounded-lg shadow-sm p-6 mb-6 border-t-4"
        style={{ borderTopColor: accentColor }}
      >
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{brand.name}</h1>
          {brand.handle && (
            <span className="text-gray-500">{brand.handle.startsWith("@") ? brand.handle : `@${brand.handle}`}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
          <span>{allPosts.length} posts</span>
          {brand.cadence && <span>Cadence: {brand.cadence}</span>}
          <span>{dateRange}</span>
        </div>
        {brand.compliance && (
          <p className="mt-2 text-xs text-gray-400 tracking-wide">{brand.compliance}</p>
        )}
      </div>

      <div className="mb-6">
        <ClientReviewLink
          path={`/client/${slug}`}
          label={`Share with ${brand.name}`}
          emailSubject={`${brand.name} — Content calendar ready for review`}
          emailBody={`Hi,\n\nYour content calendar is ready for review. You can see every post, approve the ones you love, and request changes on anything you'd like tweaked here:\n\n`}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={`/dashboard/brand/${slug}`}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !filterStatus && !filter
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
          }`}
        >
          All ({allPosts.length})
        </Link>
        {needsGeneration > 0 && (
          <Link
            href={`/dashboard/brand/${slug}?filter=needs_generation`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === "needs_generation"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100"
            }`}
          >
            Needs Generation ({needsGeneration})
          </Link>
        )}
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
            {status === "not_started" ? "Approval Not Started" : status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}{" "}
            ({count})
          </Link>
        ))}
      </div>

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
