const colorMap: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  generating: "bg-yellow-100 text-yellow-700",
  in_review: "bg-blue-100 text-blue-700",
  changes_requested: "bg-red-100 text-red-700",
  approved: "bg-green-100 text-green-700",
  scheduled: "bg-purple-100 text-purple-700",
  posted: "bg-cyan-100 text-cyan-700",
};

export default function StatusBadge({ status }: { status: string }) {
  const colors = colorMap[status] ?? "bg-gray-100 text-gray-600";
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium inline-block ${colors}`}
    >
      {label}
    </span>
  );
}
