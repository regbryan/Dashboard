import { getDb } from "@/lib/db";
import BrandCard from "@/components/BrandCard";
import QuickActions from "@/components/QuickActions";

export default function DashboardPage() {
  const db = getDb();

  const brands = db
    .prepare(
      `SELECT
        b.*,
        COUNT(p.id) as total,
        SUM(CASE WHEN p.status = 'not_started' THEN 1 ELSE 0 END) as not_started,
        SUM(CASE WHEN p.status = 'generating' THEN 1 ELSE 0 END) as generating,
        SUM(CASE WHEN p.status = 'in_review' THEN 1 ELSE 0 END) as in_review,
        SUM(CASE WHEN p.status = 'changes_requested' THEN 1 ELSE 0 END) as changes_requested,
        SUM(CASE WHEN p.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN p.status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN p.status = 'posted' THEN 1 ELSE 0 END) as posted,
        SUM(CASE WHEN p.file_path IS NOT NULL AND p.file_path != '' THEN 1 ELSE 0 END) as has_image
      FROM brands b
      LEFT JOIN posts p ON p.brand_id = b.id
      GROUP BY b.id
      ORDER BY b.name`
    )
    .all() as Array<{
    id: string;
    name: string;
    color_primary: string;
    handle: string;
    cadence: string;
    total: number;
    not_started: number;
    generating: number;
    in_review: number;
    changes_requested: number;
    approved: number;
    scheduled: number;
    posted: number;
    has_image: number;
  }>;

  // Build date range for subtitle
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dateRange = `${fmt(startOfWeek)} – ${fmt(endOfWeek)}, ${endOfWeek.getFullYear()}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Content Dashboard</h1>
      <p className="text-gray-500 mt-1 mb-6">{dateRange}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {brands.map((b) => (
          <BrandCard
            key={b.id}
            brand={{
              id: b.id,
              name: b.name,
              colorPrimary: b.color_primary,
              handle: b.handle,
              cadence: b.cadence,
              stats: {
                total: b.total,
                not_started: b.not_started,
                generating: b.generating,
                in_review: b.in_review,
                changes_requested: b.changes_requested,
                approved: b.approved,
                scheduled: b.scheduled,
                posted: b.posted,
                has_image: b.has_image,
              },
            }}
          />
        ))}
      </div>

      <QuickActions />
    </div>
  );
}
