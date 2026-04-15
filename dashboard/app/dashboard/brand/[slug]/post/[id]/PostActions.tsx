"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "not_started", label: "Approval Not Started" },
  { value: "generating", label: "Generating" },
  { value: "in_review", label: "In Review" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "posted", label: "Posted" },
];

interface PostActionsProps {
  postId: number;
  currentStatus: string;
  hasLogo: boolean;
}

export default function PostActions({
  postId,
  currentStatus,
  hasLogo,
}: PostActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");

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

  async function handleRunLogo() {
    setLoading(true);
    await fetch("/api/run-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "overlay_logo", post_id: postId }),
    });
    setLoading(false);
    router.refresh();
  }

  async function handleSendToReview() {
    await handleStatusChange("in_review");
  }

  return (
    <div className="space-y-3">
      {/* Status dropdown */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Status</label>
        <select
          value={pendingStatus ?? currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={loading}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Feedback note — shown when Changes Requested is selected */}
      {pendingStatus === "changes_requested" && (
        <div className="border border-amber-300 rounded-lg p-3 bg-amber-50 space-y-2">
          <label className="block text-xs font-medium text-amber-800">
            What needs to change? (required for tracking)
          </label>
          <textarea
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.target.value)}
            placeholder="e.g. Wrong URL on image, use OMGLENDING.COM"
            rows={3}
            className="w-full border border-amber-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmitChangesRequested}
              disabled={loading || !feedbackNote.trim()}
              className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 disabled:opacity-50"
            >
              Submit Feedback
            </button>
            <button
              onClick={() => { setPendingStatus(null); setFeedbackNote(""); }}
              disabled={loading}
              className="px-3 py-1.5 bg-white text-gray-600 text-sm rounded border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {hasLogo && (
          <button
            onClick={handleRunLogo}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Run Logo Overlay
          </button>
        )}

        <button
          onClick={handleSendToReview}
          disabled={loading || currentStatus === "in_review"}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Send to Client Review
        </button>
      </div>
    </div>
  );
}
