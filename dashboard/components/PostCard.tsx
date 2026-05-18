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
}: {
  post: Post;
  brandSlug: string;
  platform?: string | null;
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
      }}
    >
      <div style={{ aspectRatio, position: "relative", background: "#0a0a14" }}>
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
