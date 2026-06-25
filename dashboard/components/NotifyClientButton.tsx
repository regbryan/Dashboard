"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// On-demand "Notify client" button: emails the brand's client one consolidated
// "designs ready for review" digest (every in_review post not yet notified) via
// the app's own mailer — no Gmail/compose dance. Shows the result inline.
export default function NotifyClientButton({
  brandId,
  recipientLabel,
}: {
  brandId: string;
  recipientLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "info" | "err">("info");

  async function notify() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/notify-client`, { method: "POST" });
      const d = (await res.json().catch(() => null)) as
        | { sent?: boolean; recipients?: number; posts?: number; skipped?: string; error?: string }
        | null;
      if (!res.ok) {
        setTone("err");
        setMsg(`Couldn't send: ${d?.error ?? "request failed"}`);
        return;
      }
      if (d?.skipped === "no_posts") {
        setTone("info");
        setMsg("Nothing new — every ready design has already been sent for review.");
      } else if (d?.skipped === "no_recipients") {
        setTone("err");
        setMsg("No client email on file for this brand.");
      } else if (d?.sent) {
        setTone("ok");
        setMsg(
          `Sent to ${d.recipients} recipient${d.recipients === 1 ? "" : "s"} · ${d.posts} design${d.posts === 1 ? "" : "s"}`
        );
        router.refresh();
      } else {
        setTone("info");
        setMsg("Nothing sent.");
      }
    } catch {
      setTone("err");
      setMsg("Couldn't send: network request failed.");
    } finally {
      setBusy(false);
    }
  }

  const color = tone === "ok" ? "#86efac" : tone === "err" ? "#ff8a8a" : "#9999a6";

  return (
    <div className="flex flex-col" style={{ gap: "6px" }}>
      <button
        type="button"
        onClick={notify}
        disabled={busy}
        title={recipientLabel ? `Email ${recipientLabel}` : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 16px",
          borderRadius: "999px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
          background: "rgba(125,226,156,0.14)",
          color: "#a7f3c4",
          border: "1px solid rgba(125,226,156,0.4)",
        }}
      >
        {busy ? "Sending…" : "✉ Notify client designs are ready"}
      </button>
      {msg && (
        <span style={{ fontSize: "11px", color }}>{msg}</span>
      )}
    </div>
  );
}
