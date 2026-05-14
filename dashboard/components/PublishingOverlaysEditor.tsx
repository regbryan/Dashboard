"use client";

import { useState } from "react";

/**
 * Operator-only JSON editor for brands.publishing_overlays — the array
 * of overlay rules that auto-apply between client approval and the
 * SocialPilot queue handoff (lib/publishing-pipeline.ts).
 *
 * Deliberately raw-JSON. We expect 2–3 operators to ever touch this,
 * not customers, and the shape is documented inline. A schema-aware UI
 * would 10× the code for 0 user benefit.
 *
 * Lives inside BrandKitPanel's OperatorPanel <details>, so it only
 * renders when an admin expands the operator section.
 */

type Props = {
  brandId: string;
  initial: unknown;
};

const EXAMPLE_FOOTER = `[
  {
    "type": "footer",
    "position": "bottom-center",
    "widthPct": 0.92,
    "fontSizePct": 0.014,
    "color": "#ffffff",
    "background": "#0a2540",
    "backgroundOpacity": 1.0
  }
]`;

const EXAMPLE_LOGO = `[
  {
    "type": "logo",
    "position": "bottom-right",
    "widthPct": 0.18,
    "edgePadding": 24,
    "cleanBand": true
  }
]`;

export default function PublishingOverlaysEditor({ brandId, initial }: Props) {
  const [draft, setDraft] = useState(
    initial ? JSON.stringify(initial, null, 2) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      let parsed: unknown = null;
      const trimmed = draft.trim();
      if (trimmed) {
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          throw new Error(
            "Invalid JSON: " + (e instanceof Error ? e.message : "parse failed")
          );
        }
        if (!Array.isArray(parsed)) {
          throw new Error("Must be a JSON array of overlay rules (or empty).");
        }
      }
      const res = await fetch(`/api/brands/${brandId}/publishing-overlays`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overlays: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "save_failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
    } finally {
      setSaving(false);
    }
  };

  const insertExample = (which: "footer" | "logo") => {
    setDraft(which === "footer" ? EXAMPLE_FOOTER : EXAMPLE_LOGO);
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "12px 14px",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#9999a6",
          fontWeight: 600,
        }}
      >
        Publishing overlays — auto-apply before SocialPilot
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#7a7a88", lineHeight: 1.5 }}>
        Array of overlay rules applied to every approved post just before it
        queues to SocialPilot. <code>logo</code> composites a brand logo;{" "}
        <code>footer</code> paints compliance text. Snapshots make re-runs
        idempotent. Empty / null = no auto-overlay (operator handles manually).
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={10}
        spellCheck={false}
        style={{
          background: "rgba(0,0,0,0.35)",
          color: "#dcdce4",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "10px 12px",
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 12,
          lineHeight: 1.5,
          resize: "vertical",
        }}
        placeholder="[]  // or paste an overlay rule array"
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={btn}
        >
          {saving ? "Saving…" : "Save rules"}
        </button>
        <button
          type="button"
          onClick={() => insertExample("footer")}
          style={btnGhost}
        >
          + Footer example
        </button>
        <button
          type="button"
          onClick={() => insertExample("logo")}
          style={btnGhost}
        >
          + Logo example
        </button>
        {saved && (
          <span style={{ fontSize: 11, color: "#86efac", alignSelf: "center" }}>
            Saved.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "rgba(192,132,252,0.12)",
  border: "1px solid rgba(192,132,252,0.35)",
  color: "#c084fc",
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#9999a6",
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 11,
  cursor: "pointer",
};
