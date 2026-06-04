import Link from "next/link";
import ClientReviewLink from "@/components/ClientReviewLink";
import SelectableDesignsGrid from "@/components/SelectableDesignsGrid";
import GenerateCalendarButton from "@/components/GenerateCalendarButton";
import { getBrandClientEmails } from "@/lib/brand-clients";
import { getBrand, getBrandPosts } from "@/lib/brand-data";
import { requireUser } from "@/lib/api-auth";

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

  const brand = await getBrand(slug);

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

  const allPosts = await getBrandPosts(slug);
  const dates = allPosts.map((p) => p.date).filter(Boolean).sort();
  const dateRange = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : "No dates";

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

  let isAdmin = false;
  try {
    ({ isAdmin } = await requireUser());
  } catch {
    isAdmin = false;
  }
  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const defaultMonth = now.getUTCMonth() + 1;
  const todayIso = now.toISOString().slice(0, 10);

  // Designs tab leads with the most recently generated/updated posts so freshly
  // generated work is at the top — no scrolling to find what you just made.
  // (ISO timestamps sort lexically; missing timestamps sink to the bottom.)
  // The calendar tab keeps its own chronological order — this sort is local.
  const recentFirst = [...filteredPosts].sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
  );

  const gridPosts = recentFirst.map((post) => ({
    id: String(post.id),
    concept: post.concept ?? "",
    date: post.date ?? "",
    post_type: post.post_type ?? "",
    content_pillar: post.content_pillar ?? "",
    status: post.status,
    file_path: post.file_path,
  }));

  return (
    <div style={{ padding: "28px 0 48px" }}>
      <div>
        {/* Brand stats row (name + handle live in the layout chrome above) */}
        <div
          className="flex flex-wrap items-center"
          style={{ gap: "16px", marginBottom: "24px", color: "#9999a6", fontSize: "13px" }}
        >
          <div className="flex items-center" style={{ gap: "8px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: accentColor,
                boxShadow: `0 0 10px ${accentColor}80`,
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#c084fc", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
              {brand.platform || "Brand"} · {dateRange}
            </span>
          </div>
          <span style={{ color: "#3a3a45" }}>·</span>
          <span>
            <strong style={{ color: "white", fontWeight: 600 }}>{allPosts.length}</strong> posts
          </span>
          {brand.cadence && (
            <>
              <span style={{ color: "#3a3a45" }}>·</span>
              <span>Cadence: {brand.cadence}</span>
            </>
          )}
        </div>
        {brand.compliance && (
          <p style={{ marginTop: "-12px", marginBottom: "20px", fontSize: "11px", color: "#8a8a98", letterSpacing: "0.04em" }}>
            {brand.compliance}
          </p>
        )}

        {isAdmin && (
          <GenerateCalendarButton
            brandId={brand.id}
            defaultYear={defaultYear}
            defaultMonth={defaultMonth}
            todayIso={todayIso}
          />
        )}

        <div style={{ marginBottom: "28px" }}>
          <ClientReviewLink
            path={`/client/${slug}`}
            label={`Share with ${brand.name}`}
            emailSubject={`${brand.name}: Content calendar ready for review`}
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

        {/* Grid + selection / generation toolbar */}
        <SelectableDesignsGrid
          posts={gridPosts}
          brandSlug={slug}
          platform={brand.platform}
          isAdmin={isAdmin}
        />
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
