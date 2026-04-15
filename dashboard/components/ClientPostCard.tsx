"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  approved: { text: "Approved ✓", className: "bg-green-100 text-green-800" },
  in_review: { text: "Needs review", className: "bg-blue-100 text-blue-800" },
  changes_requested: {
    text: "Changes requested",
    className: "bg-amber-100 text-amber-800",
  },
  scheduled: { text: "Scheduled", className: "bg-purple-100 text-purple-800" },
  posted: { text: "Posted", className: "bg-gray-800 text-white" },
  generating: { text: "In progress", className: "bg-gray-100 text-gray-600" },
  not_started: { text: "In progress", className: "bg-gray-100 text-gray-600" },
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
  const aspectClass =
    platform === "linkedin" ? "aspect-[1.91/1]" : "aspect-[4/5]";
  const statusInfo = STATUS_LABEL[status] || {
    text: status,
    className: "bg-gray-100 text-gray-700",
  };
  const isReviewable = status === "in_review" || status === "changes_requested";

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
      <div className="rounded-lg border border-gray-200 overflow-hidden bg-white hover:shadow-md transition-shadow">
        <div className={`${aspectClass} relative bg-gray-100`}>
          {imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={concept}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setPreview(true)}
                className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/70 text-white text-xs rounded-full hover:bg-black/90 backdrop-blur-sm"
                aria-label="Preview full design"
              >
                👁 Preview
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              No image yet
            </div>
          )}
        </div>

        <div className="p-3 space-y-2">
          <p className="text-xs text-gray-500">
            #{postNumber}
            {date ? ` · ${date}` : ""}
          </p>
          <p className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">
            {concept || "Untitled"}
          </p>
          <div className="flex items-center justify-between pt-1">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
            >
              {statusInfo.text}
            </span>
            {isReviewable && (
              <Link
                href={`/client/${brand}/post/${postId}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Review →
              </Link>
            )}
            {!isReviewable && imageUrl && (
              <Link
                href={`/client/${brand}/post/${postId}`}
                className="text-sm text-gray-500 hover:underline"
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
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            onClick={() => setPreview(false)}
            className="absolute top-4 right-4 text-white text-2xl hover:opacity-70"
            aria-label="Close"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={concept}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain cursor-default"
          />
        </div>
      )}
    </>
  );
}
