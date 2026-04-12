import Link from "next/link";
import StatusBadge from "./StatusBadge";

interface BrandStats {
  not_started: number;
  generating: number;
  in_review: number;
  changes_requested: number;
  approved: number;
  scheduled: number;
  posted: number;
  total: number;
}

interface Brand {
  id: string;
  name: string;
  colorPrimary: string;
  handle: string;
  cadence: string;
  stats: BrandStats;
}

export default function BrandCard({ brand }: { brand: Brand }) {
  const { stats } = brand;
  const complete = stats.approved + stats.scheduled + stats.posted;
  const pct = stats.total > 0 ? Math.round((complete / stats.total) * 100) : 0;

  const statuses: { key: keyof BrandStats; value: number }[] = [
    { key: "not_started", value: stats.not_started },
    { key: "generating", value: stats.generating },
    { key: "in_review", value: stats.in_review },
    { key: "changes_requested", value: stats.changes_requested },
    { key: "approved", value: stats.approved },
    { key: "scheduled", value: stats.scheduled },
    { key: "posted", value: stats.posted },
  ];

  return (
    <Link
      href={`/dashboard/brand/${brand.id}`}
      className="block rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: brand.colorPrimary }}
        />
        <span className="font-semibold">{brand.name}</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {statuses
          .filter((s) => s.value > 0)
          .map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <StatusBadge status={s.key} />
              <span className="text-xs text-gray-500">{s.value}</span>
            </span>
          ))}
      </div>

      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-gray-500">
        {complete} of {stats.total} posts complete
      </p>
    </Link>
  );
}
