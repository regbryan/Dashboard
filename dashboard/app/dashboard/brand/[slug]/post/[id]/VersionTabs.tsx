"use client";

import { useState } from "react";

interface VersionTabsProps {
  postId: number;
  versions: string[];
  currentFilePath: string;
}

export default function VersionTabs({
  postId,
  versions,
  currentFilePath,
}: VersionTabsProps) {
  const [activeVersion, setActiveVersion] = useState(currentFilePath);

  const imageSrc =
    activeVersion === currentFilePath
      ? `/api/posts/${postId}/image`
      : `/api/posts/${postId}/image?file=${encodeURIComponent(activeVersion)}`;

  return (
    <div>
      <div style={{ aspectRatio: "4 / 5", position: "relative", background: "#0a0a14" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt="Post preview"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {versions.length > 1 && (
        <div
          className="flex flex-wrap"
          style={{
            padding: "12px",
            gap: "8px",
            borderTop: "1px solid #1a1a2e",
          }}
        >
          {versions.map((version) => {
            const label = version.split("/").pop() || version;
            const isActive = version === activeVersion;
            return (
              <button
                key={version}
                onClick={() => setActiveVersion(version)}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  borderRadius: "999px",
                  background: isActive ? "white" : "rgba(255,255,255,0.03)",
                  color: isActive ? "#07070e" : "#bfbfcc",
                  border: isActive ? "1px solid white" : "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
