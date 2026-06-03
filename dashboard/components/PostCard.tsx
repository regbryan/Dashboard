"use client";

import Link from "next/link";
import StatusBadge from "./StatusBadge";
import { useState } from "react";
import { isVideoUrl } from "@/lib/media";

interface Post {
  id: string;
  concept: string;
  date: string;
  post_type: string;
  content_pillar: string;
  status: string;
  file_path?: string | null;
}

export default function PostCard({
  post,
  brandSlug,
  platform,
  selectable = false,
  selected = false,
  onToggle,
}: {
  post: Post;
  brandSlug: string;
  platform?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const aspectRatio = platform === "linkedin" ? "1.91 / 1" : "4 / 5";
  const isVideo = isVideoUrl(post.file_path);
  const mediaSrc = `/api/posts/${post.id}/image`;

  return (
    <Link
      href={`/dashboard/brand/${brandSlug}/post/${post.id}`}
      className="surface-card overflow-hidden flex flex-col"
      style={{
        borderRadius: "16px",
        textDecoration: "none",
        color: "inherit",
        outline: selected ? "2px solid #c084fc" : undefined,
        outlineOffset: selected ? "1px" : undefined,
      }}
    >
      <div style={{ aspectRatio, position: "relative", background: "#0a0a14" }}>
        {selectable && (
          <button
            type="button"
            aria-label={selected ? "Deselect post" : "Select post"}
            aria-pressed={selected}
            onClick={(e) => {
              // Don't navigate the Link when toggling selection.
              e.preventDefault();
              e.stopPropagation();
              onToggle?.(post.id);
            }}
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              zIndex: 2,
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: selected
                ? "1px solid #c084fc"
                : "1px solid rgba(255,255,255,0.4)",
              background: selected ? "#c084fc" : "rgba(10,10,20,0.55)",
              color: selected ? "#07070e" : "white",
              fontSize: "15px",
              lineHeight: 1,
              backdropFilter: "blur(4px)",
            }}
          >
            {selected ? "✓" : ""}
          </button>
        )}
        {!mediaFailed ? (
          isVideo ? (
            <video
              src={mediaSrc}
              muted
              playsInline
              preload="metadata"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setMediaFailed(true)}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mediaSrc}
              alt={post.concept}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setMediaFailed(true)}
            />
          )
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
            No image
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px" }}>
        <p
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {post.concept}
        </p>
        <p
          style={{
            marginTop: "4px",
            fontSize: "11px",
            color: "#8a8a98",
            letterSpacing: "0.04em",
          }}
        >
          {post.date} · {post.post_type} · {post.content_pillar}
        </p>
        <div style={{ marginTop: "10px" }}>
          <StatusBadge status={post.status} />
        </div>
      </div>
    </Link>
  );
}
