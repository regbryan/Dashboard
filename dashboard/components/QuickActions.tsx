"use client";

import { useState } from "react";
import { ShinyButton } from "./ShinyButton";

export default function QuickActions() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleImport() {
    setLoading("import");
    setStatus(null);
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Imported ${data.brands ?? 0} brands, ${data.posts ?? 0} posts`);
      } else {
        setStatus(`Error: ${data.error ?? "Import failed"}`);
      }
    } catch {
      setStatus("Error: Network request failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleScript(script: string, label: string) {
    setLoading(script);
    setStatus(null);
    try {
      const res = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      if (res.ok) {
        setStatus(`${label}: Started`);
      } else {
        const data = await res.json();
        setStatus(`Error: ${data.error ?? "Script failed"}`);
      }
    } catch {
      setStatus("Error: Network request failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleSendDigest() {
    setLoading("send_digest");
    setStatus(null);
    try {
      const res = await fetch("/api/admin/send-digest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Error: ${data.error ?? "Digest failed"}`);
        return;
      }
      const sent = data.brandsNotified ?? 0;
      const rows = data.rowsFlushed ?? 0;
      if (sent === 0 && rows === 0) {
        setStatus("Digest: nothing pending to send");
      } else {
        setStatus(
          `Digest sent: ${sent} brand${sent === 1 ? "" : "s"}, ${rows} item${
            rows === 1 ? "" : "s"
          }`
        );
      }
    } catch {
      setStatus("Error: Network request failed");
    } finally {
      setLoading(null);
    }
  }

  const isBusy = loading !== null;
  const isError = status?.startsWith("Error");

  return (
    <div style={{ marginTop: "40px" }}>
      <h2 className="eyebrow" style={{ marginBottom: "16px" }}>Quick Actions</h2>

      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <ShinyButton onClick={handleImport} disabled={isBusy}>
          {loading === "import" ? "Running…" : "Import Calendar"}
        </ShinyButton>
        <ShinyButton
          variant="secondary"
          onClick={() => handleScript("extract_captions", "Extract All Captions")}
          disabled={isBusy}
        >
          {loading === "extract_captions" ? "Running…" : "Extract All Captions"}
        </ShinyButton>
        <ShinyButton
          variant="secondary"
          onClick={() => handleScript("run_all_overlays", "Run All Overlays")}
          disabled={isBusy}
        >
          {loading === "run_all_overlays" ? "Running…" : "Run All Overlays"}
        </ShinyButton>
        <ShinyButton
          variant="secondary"
          onClick={handleSendDigest}
          disabled={isBusy}
        >
          {loading === "send_digest" ? "Sending…" : "Send Feedback Digest"}
        </ShinyButton>
      </div>

      {status && (
        <p
          style={{
            marginTop: "14px",
            fontSize: "13px",
            color: isError ? "#ff8a8a" : "#a7f3c4",
            fontWeight: 500,
          }}
        >
          {status}
        </p>
      )}
    </div>
  );
}
