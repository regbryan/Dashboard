"use client";

import { useEffect, useState } from "react";
import { isVideoUrl } from "@/lib/media";

interface PostImageViewerProps {
  imageUrl: string | null;
  alt: string;
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const aspectRatio =
    thumbAspect === "landscape"
      ? "1.91 / 1"
      : thumbAspect === "natural"
      ? undefined
      : "4 / 5";

  const isVideo = isVideoUrl(imageUrl);
  const previewLabel = isVideo ? "Open Video" : "Preview Full Design";

  return (
    <>
      <div
        className="surface-card overflow-hidden relative group"
        style={{ borderRadius: "16px" }}
      >
        {imageUrl ? (
          <>
            {isVideo ? (
              <video
                src={imageUrl}
                controls
                playsInline
                preload="metadata"
                style={{
                  width: "100%",
                  aspectRatio,
                  objectFit: thumbAspect === "natural" ? undefined : "cover",
                  display: "block",
                  background: "#0a0a14",
                }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageUrl}
                alt={alt}
                style={{
                  width: "100%",
                  aspectRatio,
                  objectFit: thumbAspect === "natural" ? undefined : "cover",
                  display: "block",
                }}
              />
            )}
            <button
              onClick={() => setOpen(true)}
              aria-label={previewLabel}
              className="opacity-0 group-hover:opacity-100"
              style={{
                position: "absolute",
                bottom: "12px",
                right: "12px",
                padding: "7px 14px",
                background: "rgba(7,7,14,0.8)",
                color: "white",
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                cursor: "pointer",
                transition: "opacity 0.2s ease",
              }}
            >
              {previewLabel}
            </button>
          </>
        ) : (
          <div
            style={{
              aspectRatio: "4 / 5",
              background: "#0a0a14",
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

      {imageUrl && (
        <button
          onClick={() => setOpen(true)}
          className="sp-shiny"
          style={{
            marginTop: "12px",
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <span className="sp-shiny__label">{isVideo ? "Open Video" : "View Full Design"}</span>
        </button>
      )}

      {open && imageUrl && (
        <div
          onClick={() => setOpen(false)}
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
            onClick={() => setOpen(false)}
            aria-label="Close preview"
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
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                cursor: "default",
              }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                cursor: "default",
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
