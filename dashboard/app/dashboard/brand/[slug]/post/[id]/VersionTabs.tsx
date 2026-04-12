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
      <div className="aspect-[4/5] relative">
        <img
          src={imageSrc}
          alt="Post preview"
          className="w-full h-full object-cover"
        />
      </div>

      {versions.length > 1 && (
        <div className="p-3 border-t flex flex-wrap gap-2">
          {versions.map((version) => {
            const label = version.split("/").pop() || version;
            const isActive = version === activeVersion;
            return (
              <button
                key={version}
                onClick={() => setActiveVersion(version)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
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
