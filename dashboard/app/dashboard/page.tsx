import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BrandCard from "@/components/BrandCard";
import QuickActions from "@/components/QuickActions";
import { cardBackdropFilter } from "@/lib/glass-style";

export const dynamic = "force-dynamic";

interface BrandStats {
  total: number;
  not_started: number;
  generating: number;
  in_review: number;
  changes_requested: number;
  approved: number;
  scheduled: number;
  posted: number;
  has_image: number;
}

const emptyStats = (): BrandStats => ({
  total: 0,
  not_started: 0,
  generating: 0,
  in_review: 0,
  changes_requested: 0,
  approved: 0,
  scheduled: 0,
  posted: 0,
  has_image: 0,
});

export default async function DashboardPage() {
  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .order("name");

  const { data: posts } = await supabase
    .from("posts")
    .select("brand_id, status, file_path, date, concept, content_pillar");

  const statsMap: Record<string, BrandStats> = {};
  // Next-post per brand: earliest future-or-today post that isn't already
  // posted/scheduled. Brand card surfaces this so an operator can see at a
  // glance what's coming up next per brand.
  const nextPostMap: Record<
    string,
    { date: string; concept: string | null; status: string } | undefined
  > = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const post of posts || []) {
    if (!statsMap[post.brand_id]) statsMap[post.brand_id] = emptyStats();
    const s = statsMap[post.brand_id];
    s.total++;
    if (post.status in s) {
      (s as unknown as Record<string, number>)[post.status]++;
    }
    if (post.file_path) s.has_image++;

    const isUpcoming =
      post.date &&
      post.date >= today &&
      post.status !== "posted" &&
      post.status !== "scheduled";
    if (isUpcoming) {
      const current = nextPostMap[post.brand_id];
      if (!current || post.date < current.date) {
        nextPostMap[post.brand_id] = {
          date: post.date,
          concept: post.concept ?? post.content_pillar ?? null,
          status: post.status,
        };
      }
    }
  }

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dateRange = `${fmt(startOfWeek)} – ${fmt(endOfWeek)}, ${endOfWeek.getFullYear()}`;

  const totalBrands = (brands || []).length;
  const totalPosts = (posts || []).length;
  const totalInReview = Object.values(statsMap).reduce(
    (sum, s) => sum + s.in_review,
    0
  );
  const totalApproved = Object.values(statsMap).reduce(
    (sum, s) => sum + s.approved + s.scheduled + s.posted,
    0
  );

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ padding: "48px clamp(20px, 4vw, 56px) 64px" }}>
      <div className="mx-auto" style={{ maxWidth: "1280px" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <div className="flex items-center" style={{ gap: "16px" }}>
            <span className="eyebrow" style={{ color: "#c084fc" }}>
              Admin · {dateRange}
            </span>
            <span style={{ color: "#3a3a45" }}>·</span>
            <Link
              href="/dashboard/health"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#9999a6",
                textDecoration: "none",
              }}
            >
              Brand health →
            </Link>
          </div>
          <h1
            className="display-heading"
            style={{ fontSize: "clamp(44px, 6vw, 72px)", marginTop: "10px" }}
          >
            Content <span className="accent">Overview</span>
          </h1>

          <div style={{ marginTop: "32px" }}>
            <QuickActions />
          </div>

          {/* Stats row */}
          <div
            className="grid grid-cols-2 md:grid-cols-4"
            style={{ gap: "16px", marginTop: "32px" }}
          >
            <StatTile label="Brands" value={totalBrands} />
            <StatTile label="Total Posts" value={totalPosts} />
            <StatTile
              label="Needs Review"
              value={totalInReview}
              accent={totalInReview > 0 ? "#c084fc" : undefined}
            />
            <StatTile
              label="Approved"
              value={totalApproved}
              accent={totalApproved > 0 ? "#7de29c" : undefined}
            />
          </div>
        </div>

        <OpenGapsPanel brands={brands || []} />

        {/* Brand grid */}
        <div style={{ marginTop: "40px" }}>
          <h2 className="eyebrow" style={{ marginBottom: "16px", textAlign: "center" }}>Brands</h2>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            style={{ gap: "20px" }}
          >
            {(brands || []).map((b) => {
              const s = statsMap[b.id] || emptyStats();
              return (
                <BrandCard
                  key={b.id}
                  brand={{
                    id: b.id,
                    name: b.name,
                    colorPrimary: b.color_primary,
                    colorSecondary: b.color_secondary,
                    colorAccent: b.color_accent,
                    handle: b.handle,
                    cadence: b.cadence,
                    voiceConfidence: b.voice_confidence,
                    colorConfidence: b.color_confidence,
                    nextPost: nextPostMap[b.id] ?? null,
                    stats: s,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div
      className="lg-surface--card"
      style={{
        padding: "20px 22px",
        borderRadius: "16px",
        ...cardBackdropFilter,
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#8a8a98",
        }}
      >
        {label}
      </p>
      <p
        style={{
          marginTop: "8px",
          fontFamily: "var(--font-anton), 'Anton', sans-serif",
          fontSize: "44px",
          lineHeight: 1,
          color: accent || "white",
        }}
      >
        {value}
      </p>
    </div>
  );
}

interface BrandLite {
  id: string;
  name: string;
  voice_confidence?: string | null;
  color_confidence?: string | null;
  has_brand_doc?: number | boolean | null;
  has_kit_doc?: boolean | null;
}

/**
 * Cross-brand readiness callout. Only renders when there's actually
 * something to nudge about — silent on a fully-ready fleet. Mirrors
 * the "Open gaps" section at the bottom of PROJECT_INDEX.md.
 */
function OpenGapsPanel({ brands }: { brands: BrandLite[] }) {
  const realVoiceGaps = brands.filter(
    (b) => b.voice_confidence != null && b.voice_confidence !== "high",
  );
  const realPaletteGaps = brands.filter(
    (b) => b.color_confidence != null && b.color_confidence !== "high",
  );

  if (realVoiceGaps.length === 0 && realPaletteGaps.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "32px",
        padding: "18px 22px",
        background: "rgba(251, 191, 36, 0.04)",
        border: "1px solid rgba(251, 191, 36, 0.22)",
        borderRadius: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#fcd34d",
        }}
      >
        <span>⚠</span>
        <span>Open gaps · brand readiness</span>
      </div>
      {realVoiceGaps.length > 0 && (
        <p style={{ fontSize: "13px", color: "#e6e6ed", margin: 0 }}>
          <strong style={{ color: "#fcd34d" }}>Voice doc missing:</strong>{" "}
          {realVoiceGaps.map((b, i) => (
            <span key={b.id}>
              <Link
                href={`/dashboard/brand/${b.id}/kit`}
                style={{ color: "#fcd34d", textDecoration: "underline" }}
              >
                {b.name}
              </Link>
              {i < realVoiceGaps.length - 1 ? ", " : ""}
            </span>
          ))}{" "}
          <span style={{ color: "#9999a6" }}>
            — run the brand-scanner skill or write voice.md.
          </span>
        </p>
      )}
      {realPaletteGaps.length > 0 && (
        <p style={{ fontSize: "13px", color: "#e6e6ed", margin: 0 }}>
          <strong style={{ color: "#fcd34d" }}>Palette TBD:</strong>{" "}
          {realPaletteGaps.map((b, i) => (
            <span key={b.id}>
              <Link
                href={`/dashboard/brand/${b.id}/kit`}
                style={{ color: "#fcd34d", textDecoration: "underline" }}
              >
                {b.name}
              </Link>
              {i < realPaletteGaps.length - 1 ? ", " : ""}
            </span>
          ))}{" "}
          <span style={{ color: "#9999a6" }}>
            — lock the palette in brand.json (extract from reference posts via _ops/extract-brand-palette.py).
          </span>
        </p>
      )}
    </div>
  );
}
