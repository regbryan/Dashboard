"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegeneratePostButton({ postId }: { postId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function go() {
    setConfirming(false);
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/posts/${postId}/regenerate`, {
        method: "POST",
      });
      const body = (await res.json()) as
        | { ok: true; storagePath: string; model: string; brandSlug: string }
        | { ok: false; error: string };
      if (!res.ok || !body.ok) {
        setErr("error" in body ? body.error : `HTTP ${res.status}`);
      } else {
        setMsg(`New image generated (${body.model}). Status set to in_review.`);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 500,
            background: busy ? "rgba(192,132,252,0.15)" : "rgba(192,132,252,0.18)",
            color: "#d9b4ff",
            border: "1px solid rgba(192,132,252,0.4)",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Regenerating…" : "↻ Regenerate image with autopilot"}
        </button>
      ) : (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={go}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#c084fc",
              color: "#1a0a2e",
              border: "none",
              cursor: "pointer",
            }}
          >
            Confirm — spend a Gemini call
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "13px",
              background: "transparent",
              color: "#9999a6",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {msg && <span style={{ fontSize: "12px", color: "#9be29b" }}>{msg}</span>}
      {err && <span style={{ fontSize: "12px", color: "#fbb27a" }}>⚠ {err}</span>}
      <span style={{ fontSize: "11px", color: "#7a7a88", lineHeight: 1.5 }}>
        Reads brand kit (positioning, palette, tone, photography direction) and
        post brief (concept, visual direction). Overwrites the current image and
        sets status back to in_review.
      </span>
    </div>
  );
}
