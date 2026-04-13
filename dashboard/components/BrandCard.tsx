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
  has_image: number;
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
  const approved = stats.approved + stats.scheduled + stats.posted;
  const generated = stats.has_image;
  const genPct = stats.total > 0 ? Math.round((generated / stats.total) * 100) : 0;
  const approvedPct = stats.total > 0 ? Math.round((approved / stats.total) * 100) : 0;

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

      <div className="space-y-2 mb-2">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-0.5">
            <span>Generated</span>
            <span>{generated} / {stats.total}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${genPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-0.5">
            <span>Approved</span>
            <span>{approved} / {stats.total}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${approvedPct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
