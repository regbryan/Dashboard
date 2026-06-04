"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PostCard from "./PostCard";
import EmptyState from "./EmptyState";

interface Post {
  id: string;
  concept: string;
  date: string;
  post_type: string;
  content_pillar: string;
  status: string;
  file_path?: string | null;
}

// How many image generations to run at once. Each is one request to the
// per-post regenerate route (~10-30s); a small pool keeps us well within
// browser/server limits while still finishing a month in a few minutes.
const CONCURRENCY = 3;

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

export default function SelectableDesignsGrid({
  posts,
  brandSlug,
  platform,
  isAdmin,
}: {
  posts: Post[];
  brandSlug: string;
  platform?: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failures, setFailures] = useState<{ id: string; error: string }[]>([]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Reels/videos/stories don't get a static design — exclude them from the
  // bulk-select actions (the server also skips them defensively).
  const isReel = (p: Post) =>
    /reel|video|story/.test((p.post_type || "").toLowerCase());
  const designable = posts.filter((p) => !isReel(p));

  const selectAll = () => setSelected(new Set(designable.map((p) => p.id)));
  const selectNeedsGen = () =>
    setSelected(new Set(designable.filter((p) => !p.file_path).map((p) => p.id)));
  const clear = () => setSelected(new Set());

  const generate = async () => {
    const ids = [...selected];
    if (ids.length === 0 || generating) return;
    if (
      !window.confirm(
        `Generate ${ids.length} design${ids.length === 1 ? "" : "s"}? This calls the image generator (uses credits) for each selected post.`
      )
    ) {
      return;
    }

    setGenerating(true);
    setFailures([]);
    setDone(0);
    setTotal(ids.length);

    const fails: { id: string; error: string }[] = [];
    await runPool(ids, CONCURRENCY, async (id) => {
      try {
        const res = await fetch(`/api/posts/${id}/regenerate`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          fails.push({ id, error: (body as { error?: string }).error || `HTTP ${res.status}` });
        }
      } catch (err) {
        fails.push({ id, error: err instanceof Error ? err.message : String(err) });
      } finally {
        setDone((d) => d + 1);
      }
    });

    setFailures(fails);
    setGenerating(false);
    setSelected(new Set());
    // Reflect new images / status badges from the server.
    router.refresh();
  };

  const selectedCount = selected.size;
  const needsGenCount = designable.filter((p) => !p.file_path).length;

  return (
    <div>
      {isAdmin && posts.length > 0 && (
        <div
          className="surface-card flex flex-wrap items-center"
          style={{
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "16px",
          }}
        >
          <ToolbarButton onClick={selectAll} label={`Select all (${designable.length})`} />
          {needsGenCount > 0 && (
            <ToolbarButton
              onClick={selectNeedsGen}
              label={`Select needing generation (${needsGenCount})`}
            />
          )}
          {selectedCount > 0 && <ToolbarButton onClick={clear} label="Clear" />}

          <div style={{ flex: 1 }} />

          {generating ? (
            <span style={{ fontSize: "13px", color: "#c084fc" }}>
              Generating… {done} of {total}
            </span>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={selectedCount === 0}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                background: selectedCount === 0 ? "rgba(255,255,255,0.08)" : "#c084fc",
                color: selectedCount === 0 ? "#6a6a78" : "#07070e",
                transition: "all 0.2s ease",
              }}
            >
              Generate designs{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          )}
        </div>
      )}

      {failures.length > 0 && (
        <div
          className="surface-card"
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "16px",
            border: "1px solid rgba(251,146,122,0.4)",
          }}
        >
          <p style={{ fontSize: "13px", color: "#fbb27a", fontWeight: 600, marginBottom: "6px" }}>
            {failures.length} generation{failures.length === 1 ? "" : "s"} failed
          </p>
          <ul style={{ fontSize: "12px", color: "#bfbfcc", listStyle: "none", margin: 0, padding: 0 }}>
            {failures.slice(0, 8).map((f) => (
              <li key={f.id}>
                Post {f.id}: {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState>No posts match this filter.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: "20px" }}>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              brandSlug={brandSlug}
              platform={platform}
              selectable={isAdmin}
              selected={selected.has(post.id)}
              onToggle={toggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
        background: "rgba(255,255,255,0.03)",
        color: "#bfbfcc",
        border: "1px solid rgba(255,255,255,0.1)",
        transition: "all 0.2s ease",
      }}
    >
      {label}
    </button>
  );
}
