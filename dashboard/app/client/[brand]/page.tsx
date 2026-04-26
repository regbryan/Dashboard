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
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center" style={{ padding: "40px 24px" }}>
        <div className="text-center">
          <h1 className="display-heading" style={{ fontSize: "clamp(36px, 5vw, 48px)" }}>
            Brand <span className="accent">not found</span>
          </h1>
          <p style={{ marginTop: "12px", color: "#9999a6", fontSize: "14px" }}>
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
  const reviewCount = allPosts.filter((p) => p.status === "in_review").length;
  const approvedCount = allPosts.filter((p) => p.status === "approved").length;

  const dates = allPosts.map((p) => p.date).filter(Boolean).sort() as string[];
  const dateRange =
    dates.length > 0
      ? `${dates[0]} — ${dates[dates.length - 1]}`
      : "No dates scheduled";

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ padding: "48px clamp(20px, 4vw, 56px)" }}>
      <div className="mx-auto" style={{ maxWidth: "1200px" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <span className="eyebrow" style={{ color: "#c084fc" }}>
            {brandRow.platform || "Content"} · Calendar
          </span>
          <h1
            className="display-heading"
            style={{ fontSize: "clamp(44px, 6vw, 72px)", marginTop: "10px" }}
          >
            {brandRow.name.split(" ")[0]}{" "}
            <span className="accent">{brandRow.name.split(" ").slice(1).join(" ") || "Review"}</span>
          </h1>

          <div
            className="flex flex-wrap items-center"
            style={{ gap: "20px", marginTop: "20px", fontSize: "13px", color: "#9999a6" }}
          >
            <span>
              <strong style={{ color: "white", fontWeight: 600 }}>{allPosts.length}</strong> posts
            </span>
            <span style={{ color: "#4a4a55" }}>•</span>
            <span>{dateRange}</span>
            {approvedCount > 0 && (
              <>
                <span style={{ color: "#4a4a55" }}>•</span>
                <span style={{ color: "#7de29c" }}>
                  <strong style={{ fontWeight: 600 }}>{approvedCount}</strong> approved
                </span>
              </>
            )}
          </div>

          {reviewCount > 0 && (
            <div
              style={{
                display: "inline-block",
                marginTop: "18px",
                padding: "8px 16px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                background: "rgba(192,132,252,0.12)",
                color: "#e9d5ff",
                border: "1px solid rgba(192,132,252,0.3)",
              }}
            >
              {reviewCount} {reviewCount === 1 ? "POST NEEDS" : "POSTS NEED"} YOUR REVIEW
            </div>
          )}

          <p
            style={{
              marginTop: "20px",
              fontSize: "13px",
              color: "#7a7a88",
              lineHeight: 1.6,
            }}
          >
            Tap any post to see the full design and approve or request changes.
          </p>
        </div>

        {/* Grid */}
        {allPosts.length === 0 ? (
          <div
            className="text-center"
            style={{
              padding: "80px 24px",
              background: "#0f0f1a",
              border: "1px solid #1a1a2e",
              borderRadius: "16px",
              color: "#7a7a88",
            }}
          >
            No posts scheduled yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: "20px" }}>
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
