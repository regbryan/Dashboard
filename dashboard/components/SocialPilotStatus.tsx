"use client";

import { useState } from "react";

/**
 * Per-post SocialPilot queue status. Lives on the post-detail view so
 * the operator can see what state SP thinks the post is in, retry if
 * it failed, and see the SP post ID for cross-reference.
 *
 * Renders nothing for posts where the queue isn't applicable (Starter
 * brand, no SP binding, or status NULL) — caller decides whether to
 * show this component.
 */

export type QueueStatus = "queued" | "failed" | "published" | "disabled" | null;

type Props = {
  postId: string | number;
  status: QueueStatus;
  socialpilotPostId: string | null;
  error: string | null;
  queuedAt: string | null;
  retryCount?: number;
  /** Whether to show the admin "Retry" button. */
  isAdmin: boolean;
};

const MAX_RETRIES = 5;

export default function SocialPilotStatus({
  postId,
  status,
  socialpilotPostId,
  error,
  queuedAt,
  retryCount = 0,
  isAdmin,
}: Props) {
  const [retrying, setRetrying] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  if (!status) return null;

  const onRetry = async () => {
    setRetrying(true);
    setOutcome(null);
    try {
      const res = await fetch(`/api/posts/${postId}/socialpilot-retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "retry_failed");
      setOutcome(
        data.status === "queued"
          ? "Re-queued."
          : data.status === "skipped"
          ? `Skipped: ${data.reason}`
          : `Failed: ${data.error}`
      );
      // Reload after a moment so the badge re-reads the row.
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setOutcome(e instanceof Error ? e.message : "retry_failed");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="lg-chip"
      style={{
        borderRadius: 10,
        padding: "12px 14px",
        display: "grid",
        gap: 8,
        backdropFilter: "blur(12px) saturate(150%)",
        WebkitBackdropFilter: "blur(12px) saturate(150%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Badge status={status} />
        {socialpilotPostId && (
          <code
            style={{
              fontSize: 11,
              color: "#9999a6",
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            }}
          >
            SP: {socialpilotPostId}
          </code>
        )}
        {queuedAt && (
          <span style={{ fontSize: 11, color: "#7a7a88" }}>
            {new Date(queuedAt).toLocaleString()}
          </span>
        )}
        {status === "failed" && retryCount > 0 && (
          <span
            style={{
              fontSize: 11,
              color: retryCount >= MAX_RETRIES ? "#fca5a5" : "#7a7a88",
            }}
          >
            attempt {retryCount}/{MAX_RETRIES}
            {retryCount >= MAX_RETRIES && ", auto-retry stopped"}
          </span>
        )}
      </div>
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 12,
            color: "#fca5a5",
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      )}
      {isAdmin && (status === "failed" || status === "queued") && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          style={{
            justifySelf: "start",
            background: "rgba(192,132,252,0.12)",
            border: "1px solid rgba(192,132,252,0.35)",
            color: "#c084fc",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            cursor: retrying ? "wait" : "pointer",
          }}
        >
          {retrying ? "Retrying…" : status === "failed" ? "Retry queue →" : "Re-queue →"}
        </button>
      )}
      {outcome && (
        <p style={{ margin: 0, fontSize: 11, color: "#9999a6" }}>{outcome}</p>
      )}
    </div>
  );
}

function Badge({ status }: { status: NonNullable<QueueStatus> }) {
  const map: Record<
    NonNullable<QueueStatus>,
    { label: string; bg: string; fg: string }
  > = {
    queued: { label: "Queued in SocialPilot", bg: "rgba(96,165,250,0.12)", fg: "#93c5fd" },
    published: { label: "Published", bg: "rgba(34,197,94,0.12)", fg: "#86efac" },
    failed: { label: "SP queue failed", bg: "rgba(248,113,113,0.12)", fg: "#fca5a5" },
    disabled: { label: "SP queue disabled", bg: "rgba(156,163,175,0.12)", fg: "#9ca3af" },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: s.bg,
        color: s.fg,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {s.label}
    </span>
  );
}
