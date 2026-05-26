"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FooterOverlayPanelProps {
  postId: number;
  postImageUrl: string | null;
  thumbAspect?: "portrait" | "landscape";
  // brand-level compliance text (source of truth). Empty string = brand has
  // no compliance text and the panel will render an empty-state message.
  complianceText: string;
}

const PRESETS: { value: string; label: string; xPct: number; yPct: number }[] = [
  { value: "bottom-center", label: "Bottom", xPct: 0.5, yPct: 0.96 },
  { value: "bottom-left", label: "Bottom-L", xPct: 0.04, yPct: 0.96 },
  { value: "bottom-right", label: "Bottom-R", xPct: 0.96, yPct: 0.96 },
  { value: "top-center", label: "Top", xPct: 0.5, yPct: 0.04 },
];

// Anchor coords are the *center* of the rendered text block as a fraction of
// post dimensions. Drag-anywhere then converts to top-left for the apply call.
export default function FooterOverlayPanel({
  postId,
  postImageUrl,
  thumbAspect = "portrait",
  complianceText,
}: FooterOverlayPanelProps) {
  const router = useRouter();
  const [text, setText] = useState(complianceText ?? "");
  const [widthPct, setWidthPct] = useState(92); // % of post width
  const [fontSizePct, setFontSizePct] = useState(1.4); // % of post width
  const [color, setColor] = useState("#FFFFFF");
  const [bgEnabled, setBgEnabled] = useState(true);
  const [bgColor, setBgColor] = useState("#000000");
  const [bgOpacity, setBgOpacity] = useState(55); // 0–100
  const [align, setAlign] = useState<"left" | "center" | "right">("center");
  const [busy, setBusy] = useState<"apply" | "undo" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0.5, y: 0.96 }); // bottom-center

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; pointerId?: number }>({
    active: false,
  });

  const aspectRatio = thumbAspect === "landscape" ? "1.91 / 1" : "4 / 5";
  const blockWidthFrac = widthPct / 100;
  // Approximate rendered text-block height as a fraction of post height. Used
  // only for the preview overlay's Y-bound — server side computes exactly.
  const textBlockHeightFrac = Math.min(0.4, (fontSizePct / 100) * estimateLines(text, blockWidthFrac, fontSizePct / 100) * 1.4);

  // Memoize so the function identity is stable per postId and can
  // safely sit in the useEffect deps below — keeps both eslint and
  // biome's useExhaustiveDependencies satisfied without disabling.
  const refreshSnapshotState = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/footer-state`);
      if (!res.ok) return;
      const body = (await res.json()) as { hasSnapshot: boolean };
      setHasSnapshot(body.hasSnapshot);
    } catch {
      // ignore
    }
  }, [postId]);

  useEffect(() => {
    void refreshSnapshotState();
  }, [refreshSnapshotState]);

  function clamp01(n: number): number {
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function updateAnchorFromPointer(clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setAnchor({ x: clamp01(x), y: clamp01(y) });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (busy) return;
    dragRef.current.active = true;
    dragRef.current.pointerId = e.pointerId;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    updateAnchorFromPointer(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;
    updateAnchorFromPointer(e.clientX, e.clientY);
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId === dragRef.current.pointerId) {
      dragRef.current.active = false;
      dragRef.current.pointerId = undefined;
    }
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setAnchor({ x: p.xPct, y: p.yPct });
  }

  function anchorToTopLeft(): { xPct: number; yPct: number } {
    return {
      xPct: clamp01(anchor.x - blockWidthFrac / 2),
      yPct: clamp01(anchor.y - textBlockHeightFrac / 2),
    };
  }

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
          text: action === "apply" ? "Footer applied" : "Reverted to original",
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
    if (!text.trim()) {
      setMessage({ tone: "err", text: "No footer text to apply" });
      return;
    }
    setBusy("apply");
    setMessage(null);
    try {
      const { xPct, yPct } = anchorToTopLeft();
      const res = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "overlay_footer",
          post_id: postId,
          vars: {
            position: "custom",
            widthPct: blockWidthFrac,
            fontSizePct: fontSizePct / 100,
            color,
            background: bgEnabled ? bgColor : null,
            backgroundOpacity: bgEnabled ? bgOpacity / 100 : 0,
            align,
            xPct,
            yPct,
            // Only override the brand-level text if the user edited it
            // beyond the default value loaded from props.
            textOverride: text !== complianceText ? text : undefined,
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
        body: JSON.stringify({ script: "undo_footer", post_id: postId }),
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

  const previewBoxStyle: React.CSSProperties = {
    position: "absolute",
    left: `${anchor.x * 100}%`,
    top: `${anchor.y * 100}%`,
    transform: "translate(-50%, -50%)",
    width: `${blockWidthFrac * 100}%`,
    pointerEvents: "none",
    background: bgEnabled
      ? `${bgColor}${Math.round((bgOpacity / 100) * 255).toString(16).padStart(2, "0")}`
      : "transparent",
    color,
    fontSize: `clamp(7px, ${fontSizePct * 0.6}vw, 14px)`,
    fontFamily: "Helvetica, Arial, sans-serif",
    fontWeight: 500,
    lineHeight: 1.3,
    padding: bgEnabled ? "6px 10px" : 0,
    borderRadius: bgEnabled ? "4px" : 0,
    textAlign: align,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  return (
    <div className="surface-card flex flex-col" style={{ padding: "20px", gap: "16px" }}>
      <div className="flex items-center justify-between" style={{ gap: "12px" }}>
        <h2 className="eyebrow">Footer Overlay</h2>
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
            Footer applied
          </span>
        )}
      </div>

      {postImageUrl ? (
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "relative",
            aspectRatio,
            background: "#0a0a14",
            borderRadius: "10px",
            overflow: "hidden",
            cursor: busy ? "not-allowed" : "crosshair",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={postImageUrl}
            alt="Post preview"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
          {text.trim() ? (
            <div style={previewBoxStyle}>{text}</div>
          ) : null}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "6px 10px",
              fontSize: "10px",
              color: "rgba(255,255,255,0.7)",
              background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Drag to position · {Math.round(anchor.x * 100)}% / {Math.round(anchor.y * 100)}%
          </div>
        </div>
      ) : (
        <div
          style={{
            aspectRatio,
            background: "#0a0a14",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8a8a98",
            fontSize: "12px",
          }}
        >
          No post image yet
        </div>
      )}

      <div style={{ display: "grid", gap: "12px" }}>
        <div>
          <div style={labelStyle}>Footer text</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!busy}
            placeholder="Enter compliance / disclaimer text"
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "8px 10px",
              background: "#0a0a14",
              color: "#bfbfcc",
              fontSize: "12px",
              fontFamily: "monospace",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              resize: "vertical",
            }}
          />
          {complianceText && text !== complianceText && (
            <button
              type="button"
              onClick={() => setText(complianceText)}
              disabled={!!busy}
              style={{
                marginTop: "4px",
                fontSize: "11px",
                color: "#9999a6",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Reset to brand default
            </button>
          )}
        </div>

        <div>
          <div style={labelStyle}>Quick presets</div>
          <div className="flex flex-wrap" style={{ gap: "6px", marginTop: "6px" }}>
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={!!busy}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 500,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: "#bfbfcc",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2" style={{ gap: "12px" }}>
          <div>
            <div className="flex items-center justify-between">
              <span style={labelStyle}>Width</span>
              <span style={{ fontSize: "11px", color: "#bfbfcc" }}>{widthPct}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={1}
              value={widthPct}
              onChange={(e) => setWidthPct(Number(e.target.value))}
              disabled={!!busy}
              style={{ width: "100%", marginTop: "4px" }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span style={labelStyle}>Font</span>
              <span style={{ fontSize: "11px", color: "#bfbfcc" }}>{fontSizePct.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.1}
              value={fontSizePct}
              onChange={(e) => setFontSizePct(Number(e.target.value))}
              disabled={!!busy}
              style={{ width: "100%", marginTop: "4px" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3" style={{ gap: "8px" }}>
          {(["left", "center", "right"] as const).map((a) => {
            const on = align === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAlign(a)}
                disabled={!!busy}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 500,
                  border: on ? "1px solid white" : "1px solid rgba(255,255,255,0.12)",
                  background: on ? "white" : "transparent",
                  color: on ? "#07070e" : "#bfbfcc",
                  cursor: busy ? "not-allowed" : "pointer",
                  textTransform: "capitalize",
                }}
              >
                {a}
              </button>
            );
          })}
        </div>

        <label
          className="flex items-center"
          style={{ gap: "8px", fontSize: "12px", color: "#bfbfcc", cursor: "pointer" }}
        >
          <span style={labelStyle}>Text color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={!!busy}
            style={{
              width: "32px",
              height: "24px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          />
        </label>

        <div style={{ display: "grid", gap: "8px" }}>
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
            Background bar
            {bgEnabled && (
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                disabled={!!busy}
                style={{
                  marginLeft: "auto",
                  width: "32px",
                  height: "24px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              />
            )}
          </label>
          {bgEnabled && (
            <div>
              <div className="flex items-center justify-between">
                <span style={labelStyle}>Bar opacity</span>
                <span style={{ fontSize: "11px", color: "#bfbfcc" }}>{bgOpacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={bgOpacity}
                onChange={(e) => setBgOpacity(Number(e.target.value))}
                disabled={!!busy}
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex" style={{ gap: "8px" }}>
        <button
          type="button"
          onClick={handleApply}
          disabled={!!busy || !text.trim() || !postImageUrl}
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
            opacity: busy || !text.trim() || !postImageUrl ? 0.6 : 1,
          }}
        >
          {busy === "apply" ? "Applying…" : hasSnapshot ? "Re-apply" : "Apply Footer"}
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

// Rough estimate of how many lines the text will wrap into in the rendered
// output, for the preview overlay's height calculation. Server side does
// proper Pango wrapping; this is just for UI layout.
function estimateLines(
  text: string,
  widthFrac: number,
  fontFrac: number
): number {
  if (!text) return 0;
  // Average char width ~ fontFrac × 0.55 of post width.
  const charsPerLine = Math.max(20, Math.floor(widthFrac / (fontFrac * 0.55)));
  const lines = Math.ceil(text.length / charsPerLine);
  return Math.max(1, Math.min(8, lines));
}
