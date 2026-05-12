import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PostCard from "@/components/PostCard";
import ClientReviewLink from "@/components/ClientReviewLink";
import BrandKitPanel from "@/components/BrandKitPanel";
import { getBrandClientEmails } from "@/lib/brand-clients";
import { loadBrandKit } from "@/lib/brand-kit";

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
    .select("id, name, handle, color_primary, cadence, compliance, platform")
    .eq("id", slug)
    .single();

  if (!brand) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center" style={{ padding: "40px 24px" }}>
        <div className="text-center">
          <h1 className="display-heading" style={{ fontSize: "clamp(36px, 5vw, 48px)" }}>
            Brand <span className="accent">not found</span>
          </h1>
          <p style={{ marginTop: "12px", color: "#9999a6", fontSize: "14px" }}>
            No brand exists with the identifier &ldquo;{slug}&rdquo;.
          </p>
          <Link
            href="/dashboard"
            style={{ marginTop: "20px", display: "inline-block", color: "#c084fc", fontSize: "13px", textDecoration: "none" }}
          >
            ← Back to dashboard
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
  const dateRange = dates.length > 0 ? `${dates[0]} — ${dates[dates.length - 1]}` : "No dates";

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

  const accentColor = brand.color_primary || "#8b5cff";

  const isAllActive = !filterStatus && !filter;

  const clientEmails = await getBrandClientEmails(brand.id).catch(() => []);
  const brandKitView = await loadBrandKit(slug).catch(() => null);

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ padding: "32px clamp(20px, 4vw, 56px) 64px" }}>
      <div className="mx-auto" style={{ maxWidth: "1280px" }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "#9999a6",
            textDecoration: "none",
            marginBottom: "24px",
          }}
        >
          ← All brands
        </Link>

        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <div className="flex items-center" style={{ gap: "12px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: accentColor,
                boxShadow: `0 0 14px ${accentColor}`,
                flexShrink: 0,
              }}
            />
            <span className="eyebrow" style={{ color: "#c084fc" }}>
              {brand.platform || "Brand"} · {dateRange}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline" style={{ gap: "12px", marginTop: "10px" }}>
            <h1
              className="display-heading"
              style={{ fontSize: "clamp(40px, 5vw, 64px)" }}
            >
              {brand.name}
            </h1>
            {brand.handle && (
              <span style={{ fontSize: "16px", color: "#7a7a88", fontWeight: 400 }}>
                {brand.handle.startsWith("@") ? brand.handle : `@${brand.handle}`}
              </span>
            )}
          </div>
          <div
            className="flex flex-wrap"
            style={{ gap: "20px", marginTop: "16px", fontSize: "13px", color: "#9999a6" }}
          >
            <span>
              <strong style={{ color: "white", fontWeight: 600 }}>{allPosts.length}</strong> posts
            </span>
            {brand.cadence && (
              <>
                <span style={{ color: "#4a4a55" }}>•</span>
                <span>Cadence: {brand.cadence}</span>
              </>
            )}
          </div>
          {brand.compliance && (
            <p style={{ marginTop: "12px", fontSize: "11px", color: "#6f6f7e", letterSpacing: "0.04em" }}>
              {brand.compliance}
            </p>
          )}
        </div>

        {brandKitView && <BrandKitPanel view={brandKitView} />}

        <div style={{ marginBottom: "28px" }}>
          <ClientReviewLink
            path={`/client/${slug}`}
            label={`Share with ${brand.name}`}
            emailSubject={`${brand.name} — Content calendar ready for review`}
            emailBody={`Hi,\n\nYour content calendar is ready for review. You can see every post, approve the ones you love, and request changes on anything you'd like tweaked here:\n\n`}
            to={clientEmails}
            brandId={brand.id}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap" style={{ gap: "8px", marginBottom: "28px" }}>
          <FilterPill
            href={`/dashboard/brand/${slug}`}
            active={isAllActive}
            label={`All (${allPosts.length})`}
          />
          {needsGeneration > 0 && (
            <FilterPill
              href={`/dashboard/brand/${slug}?filter=needs_generation`}
              active={filter === "needs_generation"}
              label={`Needs Generation (${needsGeneration})`}
              accent="#fbb27a"
            />
          )}
          {Object.entries(statusCounts)
            .filter(([status]) => status !== "changes_requested")
            .map(([status, count]) => (
              <FilterPill
                key={status}
                href={`/dashboard/brand/${slug}?status=${status}`}
                active={filterStatus === status}
                label={`${status === "not_started" ? "Approval Not Started" : status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} (${count})`}
              />
            ))}
        </div>

        {/* Grid */}
        {filteredPosts.length === 0 ? (
          <div
            className="text-center"
            style={{
              padding: "80px 24px",
              background: "#0f0f1a",
              border: "1px solid #1a1a2e",
              borderRadius: "16px",
              color: "#7a7a88",
              fontSize: "14px",
            }}
          >
            No posts match this filter.
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            style={{ gap: "20px" }}
          >
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
                  file_path: post.file_path,
                }}
                brandSlug={slug}
                platform={brand.platform}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  accent,
}: {
  href: string;
  active: boolean;
  label: string;
  accent?: string;
}) {
  const activeBg = accent || "white";
  const activeColor = accent ? "#1a0a0a" : "#07070e";
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 14px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 500,
        textDecoration: "none",
        background: active ? activeBg : "rgba(255,255,255,0.03)",
        color: active ? activeColor : "#bfbfcc",
        border: active ? `1px solid ${activeBg}` : "1px solid rgba(255,255,255,0.1)",
        transition: "all 0.2s ease",
      }}
    >
      {label}
    </Link>
  );
}
