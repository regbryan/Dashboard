interface Approval {
  id: string;
  status: string;
  comment: string | null;
  created_at: string;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function borderColor(status: string): string {
  if (status === "approved") return "border-green-500";
  if (status === "changes_requested") return "border-red-500";
  return "border-gray-300";
}

export default function ApprovalHistory({
  approvals,
}: {
  approvals: Approval[];
}) {
  if (!approvals || approvals.length === 0) return null;

  const sorted = [...approvals].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="space-y-3">
      {sorted.map((entry) => (
        <div
          key={entry.id}
          className={`border-l-4 ${borderColor(entry.status)} pl-3 py-1`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">
              {entry.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-gray-500">
              {formatTimestamp(entry.created_at)}
            </span>
          </div>
          {entry.comment && (
            <p className="text-sm text-gray-700 mt-1">{entry.comment}</p>
          )}
        </div>
      ))}
    </div>
  );
}
