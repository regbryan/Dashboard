"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isVideoUrl } from "@/lib/media";

interface ClientPostCardProps {
  brand: string;
  postId: number;
  concept: string;
  date: string | null;
  postNumber: number;
  status: string;
  imageUrl: string | null;
  platform?: string | null;
}

type StatusKey = "approved" | "in_review" | "changes_requested" | "scheduled" | "posted" | "generating" | "not_started";

const STATUS_META: Record<string, { text: string; color: string; bg: string; border: string }> = {
  approved: {
    text: "APPROVED",
    color: "#a7f3c4",
    bg: "rgba(125,226,156,0.12)",
    border: "rgba(125,226,156,0.3)",
  },
  in_review: {
    text: "NEEDS REVIEW",
    color: "#e9d5ff",
    bg: "rgba(192,132,252,0.14)",
    border: "rgba(192,132,252,0.35)",
  },
  changes_requested: {
    text: "CHANGES REQUESTED",
    color: "#fde68a",
    bg: "rgba(253,224,138,0.12)",
    border: "rgba(253,224,138,0.32)",
  },
  scheduled: {
    text: "SCHEDULED",
    color: "#c4b5fd",
    bg: "rgba(139,92,255,0.14)",
    border: "rgba(139,92,255,0.35)",
  },
  posted: {
    text: "POSTED",
    color: "#9999a6",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.1)",
  },
  generating: {
    text: "IN PROGRESS",
    color: "#9999a6",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
  },
  not_started: {
    text: "IN PROGRESS",
    color: "#9999a6",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
  },
};

export default function ClientPostCard({
  brand,
  postId,
  concept,
  date,
  postNumber,
  status,
  imageUrl,
  platform,
}: ClientPostCardProps) {
  const [preview, setPreview] = useState(false);
  const aspectRatio = platform === "linkedin" ? "1.91 / 1" : "4 / 5";
  const meta = STATUS_META[status] || {
    text: status.toUpperCase(),
    color: "#9999a6",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
  };
  const isReviewable = status === "in_review" || status === "changes_requested";
  const isVideo = isVideoUrl(imageUrl);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [preview]);

  return (
    <>
      <div
        className="surface-card overflow-hidden flex flex-col"
        style={{ borderRadius: "16px" }}
      >
        <div style={{ aspectRatio, position: "relative", background: "#0a0a14" }}>
          {imageUrl ? (
            <>
              {isVideo ? (
                <video
                  src={imageUrl}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ width: "100%", height: "100%", objectFit: "cover", background: "#0a0a14" }}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrl}
                  alt={concept}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
              <button
                onClick={() => setPreview(true)}
                aria-label="Preview full design"
                style={{
                  position: "absolute",
                  bottom: "10px",
                  right: "10px",
                  padding: "6px 12px",
                  background: "rgba(7,7,14,0.75)",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  cursor: "pointer",
                }}
              >
                Preview
              </button>
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8a8a98",
                fontSize: "12px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              No image yet
            </div>
          )}
        </div>

        <div
          className="flex flex-col"
          style={{ padding: "16px 18px", gap: "10px" }}
        >
          <p
            style={{
              fontSize: "11px",
              color: "#8a8a98",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            #{postNumber}
            {date ? ` · ${date}` : ""}
          </p>
          <p
            style={{
              color: "white",
              fontSize: "14px",
              lineHeight: 1.45,
              fontWeight: 500,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {concept || "Untitled"}
          </p>
          <div className="flex items-center justify-between" style={{ paddingTop: "4px" }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: "999px",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                background: meta.bg,
                color: meta.color,
                border: `1px solid ${meta.border}`,
              }}
            >
              {meta.text}
            </span>
            {isReviewable && (
              <Link
                href={`/client/${brand}/post/${postId}`}
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#c084fc",
                  textDecoration: "none",
                }}
              >
                Review →
              </Link>
            )}
            {!isReviewable && imageUrl && (
              <Link
                href={`/client/${brand}/post/${postId}`}
                style={{ fontSize: "13px", color: "#7a7a88", textDecoration: "none" }}
              >
                View →
              </Link>
            )}
          </div>
        </div>
      </div>

      {preview && imageUrl && (
        <div
          onClick={() => setPreview(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(5,5,12,0.92)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            cursor: "zoom-out",
          }}
        >
          <button
            onClick={() => setPreview(false)}
            aria-label="Close"
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              color: "white",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
          {isVideo ? (
            <video
              src={imageUrl}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "default" }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={concept}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "default" }}
            />
          )}
        </div>
      )}
    </>
  );
}
