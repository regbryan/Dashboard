"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POSITIONS: { value: string; label: string }[] = [
  { value: "top-left", label: "Top-Left" },
  { value: "top-center", label: "Top-Center" },
  { value: "top-right", label: "Top-Right" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom-Left" },
  { value: "bottom-center", label: "Bottom-Center" },
  { value: "bottom-right", label: "Bottom-Right" },
];

interface LogoOverlayPanelProps {
  postId: number;
}

export default function LogoOverlayPanel({ postId }: LogoOverlayPanelProps) {
  const router = useRouter();
  const [position, setPosition] = useState("top-left");
  const [maxLogoWidth, setMaxLogoWidth] = useState(30); // pct
  const [padding, setPadding] = useState(40);
  const [bgEnabled, setBgEnabled] = useState(false);
  const [bgColor, setBgColor] = useState("#000000");
  const [busy, setBusy] = useState<"apply" | "undo" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );
  const [hasSnapshot, setHasSnapshot] = useState(false);

  async function refreshSnapshotState() {
    try {
      const res = await fetch(`/api/posts/${postId}/logo-state`);
      if (!res.ok) return;
      const body = (await res.json()) as { hasSnapshot: boolean };
      setHasSnapshot(body.hasSnapshot);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshSnapshotState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function pollRun(runId: number, action: "apply" | "undo") {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch(`/api/run-script/${runId}`);
      if (!res.ok) continue;
      const body = (await res.json()) as {
        status: "running" | "success" | "error";
        output: string | null;
      };
      if (body.status === "success") {
        setMessage({
          tone: "ok",
          text: action === "apply" ? "Logo applied" : "Reverted to original",
        });
        await refreshSnapshotState();
        router.refresh();
        return;
      }
      if (body.status === "error") {
        setMessage({ tone: "err", text: body.output || "Failed" });
        await refreshSnapshotState();
        return;
      }
    }
    setMessage({ tone: "err", text: "Timed out waiting for script" });
  }

  async function handleApply() {
    setBusy("apply");
    setMessage(null);
    try {
      const res = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "overlay_logo",
          post_id: postId,
          vars: {
            position,
            maxLogoWidth: maxLogoWidth / 100,
            padding,
            backgroundBlock: bgEnabled ? bgColor : null,
          },
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        setMessage({ tone: "err", text: error || "Failed to start" });
        return;
      }
      const { runId } = (await res.json()) as { runId: number };
      await pollRun(runId, "apply");
    } finally {
      setBusy(null);
    }
  }

  async function handleUndo() {
    setBusy("undo");
    setMessage(null);
    try {
      const res = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "undo_logo", post_id: postId }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        setMessage({ tone: "err", text: error || "Failed to start" });
        return;
      }
      const { runId } = (await res.json()) as { runId: number };
      await pollRun(runId, "undo");
    } finally {
      setBusy(null);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: "#9999a6",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };

  return (
    <div className="surface-card flex flex-col" style={{ padding: "20px", gap: "16px" }}>
      <div className="flex items-center justify-between" style={{ gap: "12px" }}>
        <h2 className="eyebrow">Logo Overlay</h2>
        {hasSnapshot && (
          <span
            style={{
              fontSize: "11px",
              padding: "3px 8px",
              borderRadius: "999px",
              background: "rgba(251,178,122,0.15)",
              color: "#fbb27a",
              fontWeight: 600,
            }}
          >
            Logo applied
          </span>
        )}
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        <div>
          <div style={labelStyle}>Position</div>
          <div className="flex flex-wrap" style={{ gap: "6px", marginTop: "6px" }}>
            {POSITIONS.map((p) => {
              const on = position === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPosition(p.value)}
                  disabled={!!busy}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 500,
                    border: on
                      ? "1px solid white"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: on ? "white" : "transparent",
                    color: on ? "#07070e" : "#bfbfcc",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span style={labelStyle}>Size</span>
            <span style={{ fontSize: "11px", color: "#bfbfcc", tabularNums: "tabular-nums" } as React.CSSProperties}>
              {maxLogoWidth}%
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={maxLogoWidth}
            onChange={(e) => setMaxLogoWidth(Number(e.target.value))}
            disabled={!!busy}
            style={{ width: "100%", marginTop: "4px" }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span style={labelStyle}>Padding</span>
            <span style={{ fontSize: "11px", color: "#bfbfcc" }}>{padding}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={120}
            step={2}
            value={padding}
            onChange={(e) => setPadding(Number(e.target.value))}
            disabled={!!busy}
            style={{ width: "100%", marginTop: "4px" }}
          />
        </div>

        <label
          className="flex items-center"
          style={{ gap: "8px", fontSize: "12px", color: "#bfbfcc", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={bgEnabled}
            onChange={(e) => setBgEnabled(e.target.checked)}
            disabled={!!busy}
          />
          Background block
          {bgEnabled && (
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              disabled={!!busy}
              style={{ marginLeft: "auto", width: "32px", height: "24px", border: "none", background: "transparent", cursor: "pointer" }}
            />
          )}
        </label>
      </div>

      <div className="flex" style={{ gap: "8px" }}>
        <button
          type="button"
          onClick={handleApply}
          disabled={!!busy}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid white",
            background: "white",
            color: "#07070e",
            fontSize: "13px",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy === "apply" ? "Applying…" : hasSnapshot ? "Re-apply" : "Apply Logo"}
        </button>
        {hasSnapshot && (
          <button
            type="button"
            onClick={handleUndo}
            disabled={!!busy}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "#bfbfcc",
              fontSize: "13px",
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy === "undo" ? "Reverting…" : "Undo"}
          </button>
        )}
      </div>

      {message && (
        <p
          style={{
            fontSize: "12px",
            color: message.tone === "ok" ? "#86efac" : "#fda4af",
            margin: 0,
          }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
