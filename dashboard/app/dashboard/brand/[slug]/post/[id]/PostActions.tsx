"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS = [
  "not_started",
  "generating",
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
  "posted",
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

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, status: newStatus }),
    });
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
          value={currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={loading}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

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
