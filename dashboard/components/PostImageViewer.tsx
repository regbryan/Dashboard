"use client";

import { useEffect, useState } from "react";

interface PostImageViewerProps {
  imageUrl: string | null;
  alt: string;
  /** "portrait" = 4:5 crop (default), "landscape" = 1.91:1 crop, "natural" = no crop */
  thumbAspect?: "portrait" | "landscape" | "natural";
}

export default function PostImageViewer({
  imageUrl,
  alt,
  thumbAspect = "portrait",
}: PostImageViewerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    // lock background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const aspectClass =
    thumbAspect === "landscape"
      ? "aspect-[1.91/1]"
      : thumbAspect === "natural"
      ? ""
      : "aspect-[4/5]";

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden relative group">
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={alt}
              className={`w-full ${aspectClass} ${
                thumbAspect === "natural" ? "" : "object-cover"
              }`}
            />
            <button
              onClick={() => setOpen(true)}
              className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 text-white text-xs rounded-full hover:bg-black/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Preview full design"
            >
              👁 Preview Full Design
            </button>
          </>
        ) : (
          <div className="aspect-[4/5] bg-gray-100 flex items-center justify-center text-gray-400">
            No image yet
          </div>
        )}
      </div>

      {/* Always-visible full-preview button below thumbnail (accessibility + non-hover devices) */}
      {imageUrl && (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 w-full px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          👁 View Full Design
        </button>
      )}

      {/* Lightbox */}
      {open && imageUrl && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white text-2xl hover:opacity-70"
            aria-label="Close preview"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain cursor-default"
          />
        </div>
      )}
    </>
  );
}
