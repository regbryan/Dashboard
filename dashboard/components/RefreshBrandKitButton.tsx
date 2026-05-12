"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshBrandKitButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/refresh-kit`, {
        method: "POST",
      });
      const body = (await res.json()) as
        | { ok: true; postsAnalyzed: number; model: string }
        | { ok: false; error: string };
      if (!res.ok || !body.ok) {
        setErr("error" in body ? body.error : `HTTP ${res.status}`);
      } else {
        setMsg(`Refreshed from ${body.postsAnalyzed} approved posts (${body.model})`);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 14px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 500,
          background: busy ? "rgba(192,132,252,0.15)" : "rgba(192,132,252,0.18)",
          color: "#d9b4ff",
          border: "1px solid rgba(192,132,252,0.4)",
          cursor: busy ? "wait" : "pointer",
          transition: "background 0.15s ease",
        }}
      >
        {busy ? "Deriving from approved posts…" : "↻ Refresh from approved posts"}
      </button>
      {msg && (
        <span style={{ fontSize: "12px", color: "#9be29b" }}>{msg}</span>
      )}
      {err && (
        <span style={{ fontSize: "12px", color: "#fbb27a" }}>⚠ {err}</span>
      )}
    </div>
  );
}
