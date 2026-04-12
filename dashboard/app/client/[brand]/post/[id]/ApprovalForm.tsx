"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ApprovalFormProps {
  postId: number;
  status: string;
}

export default function ApprovalForm({ postId, status }: ApprovalFormProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (status === "approved") {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 p-4 text-green-800 text-sm font-medium">
        This post has been approved
      </div>
    );
  }

  if (status !== "in_review") {
    return (
      <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-gray-500 text-sm">
        This post is not ready for review yet
      </div>
    );
  }

  async function handleSubmit(newStatus: "approved" | "changes_requested") {
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          status: newStatus,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setMessage(
        newStatus === "approved"
          ? "Post approved successfully!"
          : "Changes requested successfully."
      );
      setComment("");
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          onClick={() => handleSubmit("approved")}
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => handleSubmit("changes_requested")}
          disabled={submitting}
          className="px-4 py-2 rounded-md border-2 border-red-500 text-red-600 font-medium text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          Request Changes
        </button>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a note (optional)"
        rows={3}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {message && (
        <p className="text-sm text-gray-700 font-medium">{message}</p>
      )}
    </div>
  );
}
