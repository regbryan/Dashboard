"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Top-of-page entry point to (re)generate the post's design. Calls the same
// /regenerate endpoint the Image Brief tab uses, but surfaced in the header
// so the operator doesn't have to dig into Image Tools to produce an asset.
// When a design already exists, confirm first so an approved post isn't
// overwritten by accident.
export default function GenerateDesignButton({
  postId,
  hasDesign,
}: {
  postId: number;
  hasDesign: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onGenerate() {
    if (
      hasDesign &&
      !window.confirm(
        "Replace the current design? This generates a new one from the saved brief and sets the post back to In Review."
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/posts/${postId}/regenerate`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; model: string }
        | { ok: false; error: string }
        | null;
      if (!res.ok || !body || !body.ok) {
        setErr(body && "error" in body ? body.error : `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end" style={{ gap: "6px" }}>
      <button
        type="button"
        className="ps-cta ps-cta--compact"
        onClick={onGenerate}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? (
          <>
            <span className="ps-spinner" aria-hidden />
            Generating…
          </>
        ) : (
          <>
            <span aria-hidden>{hasDesign ? "↻" : "✦"}</span>
            {hasDesign ? "Regenerate design" : "Generate design"}
          </>
        )}
      </button>
      {err && (
        <span style={{ fontSize: "var(--ps-fs-label)", color: "hsl(28 90% 70%)", maxWidth: "240px", textAlign: "right" }}>
          ⚠ {err}
        </span>
      )}
    </div>
  );
}
