"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShinyButton } from "@/components/ShinyButton";

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
      <div
        style={{
          padding: "16px 18px",
          borderRadius: "12px",
          background: "rgba(125,226,156,0.1)",
          border: "1px solid rgba(125,226,156,0.3)",
          color: "#a7f3c4",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        ✓ This post has been approved
      </div>
    );
  }

  if (status !== "in_review") {
    return (
      <div
        style={{
          padding: "16px 18px",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#9999a6",
          fontSize: "14px",
        }}
      >
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

      if (!res.ok) throw new Error("Failed to submit");

      setMessage(
        newStatus === "approved"
          ? "Post approved successfully."
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
    <div className="flex flex-col" style={{ gap: "16px" }}>
      <h2 className="eyebrow">Your decision</h2>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a note for our team (optional)"
        rows={3}
        className="sp-input"
        style={{ resize: "vertical", minHeight: "90px" }}
      />

      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <ShinyButton
          onClick={() => handleSubmit("approved")}
          disabled={submitting}
        >
          ✓ Approve
        </ShinyButton>
        <ShinyButton
          variant="secondary"
          onClick={() => handleSubmit("changes_requested")}
          disabled={submitting}
        >
          Request Changes
        </ShinyButton>
      </div>

      {message && (
        <p style={{ fontSize: "13px", color: "#c084fc", fontWeight: 500 }}>{message}</p>
      )}
    </div>
  );
}
