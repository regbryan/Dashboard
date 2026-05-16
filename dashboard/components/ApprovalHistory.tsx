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

function accentColor(status: string): string {
  if (status === "approved") return "#7de29c";
  if (status === "changes_requested") return "#fbb27a";
  return "#8a8a98";
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
    <div className="flex flex-col" style={{ gap: "14px" }}>
      {sorted.map((entry) => (
        <div
          key={entry.id}
          style={{
            paddingLeft: "14px",
            borderLeft: `2px solid ${accentColor(entry.status)}`,
          }}
        >
          <div className="flex items-center" style={{ gap: "10px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: accentColor(entry.status),
              }}
            >
              {entry.status.replace(/_/g, " ")}
            </span>
            <span style={{ fontSize: "11px", color: "#8a8a98" }}>
              {formatTimestamp(entry.created_at)}
            </span>
          </div>
          {entry.comment && (
            <p style={{ fontSize: "13px", color: "#bfbfcc", marginTop: "4px", lineHeight: 1.55 }}>
              {entry.comment}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
