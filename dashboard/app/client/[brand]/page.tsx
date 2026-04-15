import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import ClientPostCard from "@/components/ClientPostCard";

export const dynamic = "force-dynamic";

export default async function ClientCalendarPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id, name, color_primary, platform")
    .eq("id", brand)
    .single();

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

  const { data: posts } = await supabase
    .from("posts")
    .select("id, post_number, date, concept, status, file_path, brand_id")
    .eq("brand_id", brand)
    .order("post_number");

  const allPosts = posts || [];
  const reviewCount = allPosts.filter(
    (p) => p.status === "in_review" || p.status === "changes_requested"
  ).length;
  const approvedCount = allPosts.filter((p) => p.status === "approved").length;

  const dates = allPosts.map((p) => p.date).filter(Boolean).sort() as string[];
  const dateRange =
    dates.length > 0
      ? `${dates[0]} — ${dates[dates.length - 1]}`
      : "No dates scheduled";

  const accentColor = brandRow.color_primary || "#3b82f6";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div
          className="bg-white rounded-lg shadow-sm p-6 mb-6 border-t-4"
          style={{ borderTopColor: accentColor }}
        >
          <h1 className="text-2xl font-bold text-gray-900">
            {brandRow.name} — Content Calendar
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
            <span>{allPosts.length} posts</span>
            <span>{dateRange}</span>
            {approvedCount > 0 && (
              <span className="text-green-700">
                {approvedCount} approved
              </span>
            )}
          </div>
          {reviewCount > 0 && (
            <div className="mt-3 inline-block px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200">
              {reviewCount} {reviewCount === 1 ? "post needs" : "posts need"} your review
            </div>
          )}
          <p className="mt-4 text-sm text-gray-500">
            Tap any post to see the full design and approve or request changes.
          </p>
        </div>

        {allPosts.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            No posts scheduled yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allPosts.map((post) => (
              <ClientPostCard
                key={post.id}
                brand={brand}
                postId={post.id}
                postNumber={post.post_number}
                concept={post.concept}
                date={post.date}
                status={post.status}
                imageUrl={getImageUrl(post.brand_id, post.file_path)}
                platform={brandRow.platform}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
