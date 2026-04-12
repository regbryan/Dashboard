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
}: {
  post: Post;
  brandSlug: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link
      href={`/dashboard/brand/${brandSlug}/post/${post.id}`}
      className="block rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-[4/5] relative bg-gray-100">
        {!imgFailed ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/posts/${post.id}/image`}
            alt={post.concept}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
            No image
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="font-medium truncate">{post.concept}</p>
        <p className="text-xs text-gray-500 mt-1">
          {post.date} &middot; {post.post_type} &middot; {post.content_pillar}
        </p>
        <div className="mt-2">
          <StatusBadge status={post.status} />
        </div>
      </div>
    </Link>
  );
}
