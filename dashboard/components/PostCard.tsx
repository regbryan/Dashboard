"use client";

import Link from "next/link";
import StatusBadge from "./StatusBadge";
import { useState } from "react";

interface Post {
  id: string;
  concept: string;
  date: string;
  post_type: string;
  content_pillar: string;
  status: string;
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
  const [imgFailed, setImgFailed] = useState(false);
  const aspectRatio = platform === "linkedin" ? "1.91 / 1" : "4 / 5";

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
        {!imgFailed ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/posts/${post.id}/image`}
            alt={post.concept}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4a4a55",
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
            color: "#6f6f7e",
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
