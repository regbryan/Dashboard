import Link from "next/link";
import ClientReviewLink from "@/components/ClientReviewLink";
import NotifyClientButton from "@/components/NotifyClientButton";
import SelectableDesignsGrid from "@/components/SelectableDesignsGrid";
import GenerateCalendarButton from "@/components/GenerateCalendarButton";
import { getBrandClientEmails } from "@/lib/brand-clients";
import { getBrand, getBrandPosts } from "@/lib/brand-data";
import { requireUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// The post's scheduled CALENDAR date (YYYY-MM-DD) as ms; invalid/missing → 0.
// This is the primary Designs sort so the grid reads like the content calendar.
function dateOf(p: { date: string | null }): number {
  const t = Date.parse(p.date ?? "");
  return Number.isNaN(t) ? 0 : t;
}

// Generation recency — used only as a tiebreaker between same-date posts so the
// one you most recently generated shows first. updated_at is a TEXT column:
// autopilot rows hold real ISO timestamps, but legacy seed rows hold the literal
// string "now()" (never set). Prefer the generation ms embedded in the autopilot
// filename (.../post-N-v<ms>.png), then a valid parsed updated_at; bogus → 0.
function recencyOf(p: { file_path: string | null; updated_at: string | null }): number {
  const m = p.file_path?.match(/-v(\d{10,})\./);
  if (m) return Number(m[1]);
  const t = Date.parse(p.updated_at ?? "");
  return Number.isNaN(t) ? 0 : t;
}

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

  // Designs tab leads with the most recently generated DESIGNS at the top — no
  // scrolling to find what you just made. Posts that actually have a generated
  // image (file_path) sort first; posts not yet generated (freshly authored
  // calendar drafts) sink to the bottom so empty calendar slots never bury real
  // designs. Within the designs, sort by the post's CALENDAR DATE (newest first)
  // so the grid reads like the content calendar; generation recency only breaks
  // ties between same-date posts (the one you just generated shows first).
  const recentFirst = [...filteredPosts].sort((a, b) => {
    const aHasDesign = a.file_path ? 1 : 0;
    const bHasDesign = b.file_path ? 1 : 0;
    if (aHasDesign !== bHasDesign) return bHasDesign - aHasDesign;
    const byDate = dateOf(b) - dateOf(a);
    if (byDate !== 0) return byDate;
    return recencyOf(b) - recencyOf(a);
  });

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
        {/* Brand-state row — voice + palette confidence + last sync.
            Mirrors PROJECT_INDEX.md so the operator can see at a glance
            whether brand-render will accept this brand. */}
        <BrandStateRow
          voiceConfidence={brand.voice_confidence}
          colorConfidence={brand.color_confidence}
          colorPrimary={brand.color_primary}
          colorSecondary={brand.color_secondary}
          colorAccent={brand.color_accent}
          hasBrandDoc={brand.has_brand_doc}
          hasKitDoc={brand.has_kit_doc}
          syncedAt={brand.brand_json_synced_at}
          slug={slug}
        />

        {brand.compliance && (
          <p style={{ marginTop: "-12px", marginBottom: "20px", fontSize: "11px", color: "#8a8a98", letterSpacing: "0.04em" }}>
            {brand.compliance}
          </p>
        )}

        {isAdmin && (
          <div className="flex flex-wrap items-center" style={{ gap: "12px" }}>
            <GenerateCalendarButton
              brandId={brand.id}
              defaultYear={defaultYear}
              defaultMonth={defaultMonth}
              todayIso={todayIso}
            />
            {(statusCounts["approved"] ?? 0) > 0 && (
              <a
                href={`/api/brands/${brand.id}/export`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                  background: "rgba(255,255,255,0.04)",
                  color: "#e9e9f0",
                  border: "1px solid rgba(255,255,255,0.16)",
                }}
              >
                ↓ Export {statusCounts["approved"]} approved (.zip)
              </a>
            )}
          </div>
        )}

        <div className="flex flex-col" style={{ marginBottom: "28px", gap: "14px" }}>
          <ClientReviewLink
            path={`/client/${slug}`}
            label={`Share with ${brand.name}`}
            emailSubject={`${brand.name}: Content calendar ready for review`}
            emailBody={`Hi,\n\nYour content calendar is ready for review. You can see every post, approve the ones you love, and request changes on anything you'd like tweaked here:\n\n`}
            to={clientEmails}
            brandId={brand.id}
          />
          {isAdmin && clientEmails.length > 0 && (statusCounts["in_review"] ?? 0) > 0 && (
            <NotifyClientButton brandId={brand.id} recipientLabel={clientEmails[0]} />
          )}
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

function BrandStateRow({
  voiceConfidence,
  colorConfidence,
  colorPrimary,
  colorSecondary,
  colorAccent,
  hasBrandDoc,
  hasKitDoc,
  syncedAt,
  slug,
}: {
  voiceConfidence: string | null | undefined;
  colorConfidence: string | null | undefined;
  colorPrimary: string | null | undefined;
  colorSecondary: string | null | undefined;
  colorAccent: string | null | undefined;
  hasBrandDoc: number | boolean | null | undefined;
  hasKitDoc: boolean | null | undefined;
  syncedAt: string | null | undefined;
  slug: string;
}) {
  if (voiceConfidence == null && colorConfidence == null) return null;

  const voiceOk = voiceConfidence === "high";
  const colorOk = colorConfidence === "high";
  const palette = [colorPrimary, colorSecondary, colorAccent].filter(
    (c): c is string => !!c,
  );

  const syncedDate = syncedAt
    ? new Date(syncedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "10px",
        marginBottom: "24px",
        padding: "10px 14px",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px",
        fontSize: "12px",
        color: "#bfbfcc",
      }}
    >
      <span style={{ color: "#9999a6" }}>Brand state</span>
      <span style={{ color: "#3a3a45" }}>·</span>

      <StateChip label="Voice" ok={voiceOk} okText="✓" missingText="TBD" />
      <StateChip label="Palette" ok={colorOk} okText="✓" missingText="TBD" />

      {palette.length > 0 && (
        <div className="flex items-center" style={{ gap: "3px" }}>
          {palette.map((c, i) => (
            <span
              key={`${c}-${i}`}
              title={c}
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: c,
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
      )}

      <span style={{ color: "#3a3a45", marginLeft: "auto" }}>
        Docs: {hasBrandDoc ? "brand.json ✓" : "brand.json ✗"} ·{" "}
        {hasKitDoc ? "kit.md ✓" : "kit.md ✗"}
      </span>
      {syncedDate && (
        <span style={{ color: "#7a7a88", marginLeft: "8px" }}>
          Synced {syncedDate}
        </span>
      )}
      <Link
        href={`/dashboard/brand/${slug}/kit`}
        style={{
          marginLeft: "8px",
          color: "#c084fc",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Open Kit →
      </Link>
    </div>
  );
}

function StateChip({
  label,
  ok,
  okText,
  missingText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  missingText: string;
}) {
  const palette = ok
    ? {
        bg: "rgba(74, 222, 128, 0.10)",
        fg: "#86efac",
        border: "rgba(74, 222, 128, 0.30)",
      }
    : {
        bg: "rgba(251, 191, 36, 0.12)",
        fg: "#fcd34d",
        border: "rgba(251, 191, 36, 0.30)",
      };
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
      }}
    >
      {label} {ok ? okText : missingText}
    </span>
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
