import { supabase } from "@/lib/supabase";
import BrandCard from "@/components/BrandCard";
import QuickActions from "@/components/QuickActions";

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
    .select("brand_id, status, file_path");

  const statsMap: Record<string, BrandStats> = {};
  for (const post of posts || []) {
    if (!statsMap[post.brand_id]) statsMap[post.brand_id] = emptyStats();
    const s = statsMap[post.brand_id];
    s.total++;
    if (post.status in s) {
      (s as unknown as Record<string, number>)[post.status]++;
    }
    if (post.file_path) s.has_image++;
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
  // "Changes" count covers posts the client asked us to fix. The approve
  // handler flips posts to status="generating" on a client changes_requested,
  // so both states represent outstanding work.
  const totalChanges = Object.values(statsMap).reduce(
    (sum, s) => sum + s.changes_requested + s.generating,
    0
  );

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ padding: "48px clamp(20px, 4vw, 56px) 64px" }}>
      <div className="mx-auto" style={{ maxWidth: "1280px" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <span className="eyebrow" style={{ color: "#c084fc" }}>
            Admin · {dateRange}
          </span>
          <h1
            className="display-heading"
            style={{ fontSize: "clamp(44px, 6vw, 72px)", marginTop: "10px" }}
          >
            Content <span className="accent">Overview</span>
          </h1>

          {/* Stats row */}
          <div
            className="grid grid-cols-2 md:grid-cols-5"
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
              label="Change Requests"
              value={totalChanges}
              accent={totalChanges > 0 ? "#fbbf24" : undefined}
            />
            <StatTile
              label="Approved"
              value={totalApproved}
              accent={totalApproved > 0 ? "#7de29c" : undefined}
            />
          </div>
        </div>

        <QuickActions />

        {/* Brand grid */}
        <div style={{ marginTop: "40px" }}>
          <h2 className="eyebrow" style={{ marginBottom: "16px" }}>Brands</h2>
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
                    handle: b.handle,
                    cadence: b.cadence,
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
      className="surface-card"
      style={{ padding: "20px 22px", borderRadius: "16px" }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#6f6f7e",
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
