"use client";

import { useState } from "react";

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
    } catch (e) {
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
    } catch (e) {
      setStatus("Error: Network request failed");
    } finally {
      setLoading(null);
    }
  }

  const buttonClass =
    "rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50";

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Quick Actions
      </h2>
      <div className="flex flex-wrap gap-3">
        <button
          className={buttonClass}
          onClick={handleImport}
          disabled={loading !== null}
        >
          {loading === "import" ? "Running..." : "Import Calendar"}
        </button>
        <button
          className={buttonClass}
          onClick={() => handleScript("extract_captions", "Extract All Captions")}
          disabled={loading !== null}
        >
          {loading === "extract_captions" ? "Running..." : "Extract All Captions"}
        </button>
        <button
          className={buttonClass}
          onClick={() => handleScript("run_all_overlays", "Run All Overlays")}
          disabled={loading !== null}
        >
          {loading === "run_all_overlays" ? "Running..." : "Run All Overlays"}
        </button>
      </div>
      {status && (
        <p className="mt-3 text-sm text-gray-700">{status}</p>
      )}
    </div>
  );
}
