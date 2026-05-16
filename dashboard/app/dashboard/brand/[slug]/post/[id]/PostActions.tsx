"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShinyButton } from "@/components/ShinyButton";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "not_started", label: "Approval Not Started" },
  { value: "generating", label: "Generating" },
  { value: "in_review", label: "In Review" },
  { value: "changes_requested", label: "Request Changes (with feedback)" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "posted", label: "Posted" },
];

interface PostActionsProps {
  postId: number;
  currentStatus: string;
  hasLogo: boolean;
  archetype?: string | null;
}

const HYPERFRAMES_ARCHETYPES = new Set(["RB"]);

export default function PostActions({
  postId,
  currentStatus,
  hasLogo,
  archetype,
}: PostActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [renderRunId, setRenderRunId] = useState<number | null>(null);
  const [renderStatus, setRenderStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [renderMessage, setRenderMessage] = useState<string>("");

  const canHyperFrames = archetype
    ? HYPERFRAMES_ARCHETYPES.has(archetype.toUpperCase())
    : false;

  async function handleStatusChange(newStatus: string) {
    if (newStatus === "changes_requested") {
      setPendingStatus("changes_requested");
      return;
    }
    setLoading(true);
    await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, status: newStatus }),
    });
    setLoading(false);
    router.refresh();
  }

  async function handleSubmitChangesRequested() {
    setLoading(true);
    await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: postId,
        status: "changes_requested",
        comment: feedbackNote.trim() || null,
      }),
    });
    setPendingStatus(null);
    setFeedbackNote("");
    setLoading(false);
    router.refresh();
  }


  async function handleRenderHyperFrames() {
    setRenderStatus("running");
    setRenderMessage("Starting render…");
    setRenderRunId(null);

    let runId: number;
    try {
      const res = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "hyperframes_render", post_id: postId }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        setRenderStatus("error");
        setRenderMessage(error || "Failed to start render");
        return;
      }
      const body = (await res.json()) as { runId: number };
      runId = body.runId;
      setRenderRunId(runId);
      setRenderMessage("Rendering…");
    } catch (err) {
      setRenderStatus("error");
      setRenderMessage(err instanceof Error ? err.message : String(err));
      return;
    }

    // Poll up to ~5 minutes
    for (let i = 0; i < 150; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/run-script/${runId}`);
      if (!res.ok) continue;
      const body = (await res.json()) as {
        status: string;
        renderedPath: string | null;
        output: string | null;
      };
      if (body.status === "success") {
        setRenderStatus("success");
        setRenderMessage(body.renderedPath || "Rendered");
        return;
      }
      if (body.status === "error") {
        setRenderStatus("error");
        setRenderMessage(
          (body.output || "Render failed").split("\n").slice(-6).join("\n")
        );
        return;
      }
    }
    setRenderStatus("error");
    setRenderMessage("Render timed out after 5 minutes");
  }

  async function handleSendToReview() {
    await handleStatusChange("in_review");
  }

  return (
    <div className="flex flex-col" style={{ gap: "14px" }}>
      {/* Status dropdown */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8a8a98",
            marginBottom: "8px",
          }}
        >
          Status
        </label>
        <select
          value={pendingStatus ?? currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={loading}
          className="sp-input"
          style={{ cursor: loading ? "not-allowed" : "pointer" }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: "#0f0f1a", color: "white" }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Feedback note — when requesting changes */}
      {pendingStatus === "changes_requested" && (
        <div
          className="flex flex-col"
          style={{
            gap: "10px",
            padding: "14px",
            borderRadius: "12px",
            background: "rgba(251,146,60,0.08)",
            border: "1px solid rgba(251,146,60,0.3)",
          }}
        >
          <label
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#fbb27a",
            }}
          >
            What needs to change? (required)
          </label>
          <textarea
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.target.value)}
            placeholder="e.g. Wrong URL on image, use OMGLENDING.COM"
            rows={3}
            className="sp-input"
            style={{ resize: "vertical", minHeight: "80px" }}
          />
          <div className="flex" style={{ gap: "8px" }}>
            <ShinyButton
              onClick={handleSubmitChangesRequested}
              disabled={loading || !feedbackNote.trim()}
            >
              Submit Feedback
            </ShinyButton>
            <ShinyButton
              variant="secondary"
              onClick={() => { setPendingStatus(null); setFeedbackNote(""); }}
              disabled={loading}
            >
              Cancel
            </ShinyButton>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap" style={{ gap: "10px" }}>
        {canHyperFrames && (
          <ShinyButton
            variant="secondary"
            onClick={handleRenderHyperFrames}
            disabled={renderStatus === "running"}
          >
            {renderStatus === "running" ? "Rendering…" : "Render Reel (HyperFrames)"}
          </ShinyButton>
        )}
        <ShinyButton
          onClick={handleSendToReview}
          disabled={loading || currentStatus === "in_review"}
        >
          Send to Client Review
        </ShinyButton>
      </div>

      {/* HyperFrames render status */}
      {renderStatus !== "idle" && (
        <div
          style={{
            padding: "14px",
            borderRadius: "12px",
            background:
              renderStatus === "success"
                ? "rgba(104, 204, 209, 0.08)"
                : renderStatus === "error"
                  ? "rgba(219, 34, 39, 0.08)"
                  : "rgba(148, 163, 184, 0.08)",
            border:
              renderStatus === "success"
                ? "1px solid rgba(104, 204, 209, 0.35)"
                : renderStatus === "error"
                  ? "1px solid rgba(219, 34, 39, 0.35)"
                  : "1px solid rgba(148, 163, 184, 0.25)",
            fontSize: "13px",
            color: "#d4d4dc",
            whiteSpace: "pre-wrap",
            fontFamily:
              renderStatus === "error" ? "ui-monospace, monospace" : "inherit",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color:
                renderStatus === "success"
                  ? "#68CCD1"
                  : renderStatus === "error"
                    ? "#f87171"
                    : "#94a3b8",
              marginBottom: "8px",
            }}
          >
            HyperFrames {renderStatus}
          </div>
          <div>{renderMessage}</div>
          {renderStatus === "success" && renderRunId != null && (
            <video
              controls
              src={`/api/run-script/${renderRunId}/video`}
              style={{
                marginTop: "12px",
                maxWidth: "280px",
                borderRadius: "8px",
                background: "#000",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
