"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS: { value: string; label: string; xPct: number; yPct: number }[] = [
  { value: "top-left", label: "Top-Left", xPct: 0.04, yPct: 0.04 },
  { value: "top-center", label: "Top-Center", xPct: 0.5, yPct: 0.04 },
  { value: "top-right", label: "Top-Right", xPct: 0.96, yPct: 0.04 },
  { value: "center", label: "Center", xPct: 0.5, yPct: 0.5 },
  { value: "bottom-left", label: "Bottom-Left", xPct: 0.04, yPct: 0.96 },
  { value: "bottom-center", label: "Bottom-Center", xPct: 0.5, yPct: 0.96 },
  { value: "bottom-right", label: "Bottom-Right", xPct: 0.96, yPct: 0.96 },
];

interface LogoOverlayPanelProps {
  postId: number;
  brandId: string;
  postImageUrl: string | null;
  thumbAspect?: "portrait" | "landscape";
}

type LogoVariant = {
  id: string;
  label: string;
  isDefault: boolean;
  previewUrl: string | null;
};

// xPct/yPct in this component are "anchor" coords — the *center* of the logo
// as a fraction of post dimensions. That makes drag-from-anywhere behave
// intuitively (the logo lands centered under your cursor). When sending to
// the script we convert to top-left-corner coords by subtracting half the
// logo's normalized width/height.

export default function LogoOverlayPanel({
  postId,
  brandId,
  postImageUrl,
  thumbAspect = "portrait",
}: LogoOverlayPanelProps) {
  const router = useRouter();
  const [maxLogoWidth, setMaxLogoWidth] = useState(30); // pct
  const [bgEnabled, setBgEnabled] = useState(false);
  const [bgColor, setBgColor] = useState("#000000");
  const [busy, setBusy] = useState<"apply" | "undo" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );
  const [hasSnapshot, setHasSnapshot] = useState(false);
  // Anchor (center of logo) as fractions. Default = top-left preset.
  const [anchor, setAnchor] = useState({ x: 0.04, y: 0.04 });
  const [logoNaturalAspect, setLogoNaturalAspect] = useState(1); // logo w/h
  const [variants, setVariants] = useState<LogoVariant[]>([]);
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; pointerId?: number }>({
    active: false,
  });

  const selectedLogo =
    variants.find((v) => v.id === selectedLogoId) ?? variants[0] ?? null;
  const logoUrl = selectedLogo?.previewUrl ?? null;

  const aspectRatio = thumbAspect === "landscape" ? "1.91 / 1" : "4 / 5";
  const logoWidthPct = maxLogoWidth / 100; // fraction of stage WIDTH
  // Logo height as a fraction of stage HEIGHT. A width-fraction must be scaled by
  // the post's width/height ratio to become a height-fraction — otherwise the
  // center→top-left conversion in anchorToTopLeft() over-subtracts and the applied
  // logo lands a little HIGHER than where it was placed (the reported bug). The
  // stage aspect equals the post aspect, so reuse it here.
  const stageWHRatio = thumbAspect === "landscape" ? 1.91 : 4 / 5;
  const logoHeightPct = (logoWidthPct / logoNaturalAspect) * stageWHRatio; // fraction of stage height

  // Memoize per postId so the effect deps array stays stable and
  // useExhaustiveDependencies is satisfied without a lint-disable.
  const refreshSnapshotState = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/logo-state`);
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

  useEffect(() => {
    let cancelled = false;
    async function loadVariants() {
      try {
        const res = await fetch(`/api/brands/${brandId}/logos`);
        if (!res.ok) return;
        const body = (await res.json()) as { logos: LogoVariant[] };
        if (cancelled) return;
        setVariants(body.logos ?? []);
        // Default-select whichever variant is flagged is_default; fall back
        // to the first one returned.
        const fallback = body.logos.find((l) => l.isDefault) ?? body.logos[0];
        if (fallback) setSelectedLogoId(fallback.id);
      } catch {
        // ignore — preview will show "no logo" empty state
      }
    }
    void loadVariants();
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  // Measure the logo's TRUE aspect ratio whenever the selected logo changes.
  // The preview <img>'s onLoad can silently miss CACHED images (the load event
  // fires before React attaches the handler), which left logoNaturalAspect at
  // its default of 1 — and a wrong aspect makes the center→top-left conversion
  // off, so the applied logo lands ~2% too high. Loading it programmatically
  // (and handling the already-complete case) measures it reliably.
  useEffect(() => {
    if (!logoUrl || typeof window === "undefined") return;
    let cancelled = false;
    const img = new window.Image();
    const apply = () => {
      if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setLogoNaturalAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.onload = apply;
    img.src = logoUrl;
    if (img.complete) apply();
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

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

  // Convert anchor (center) → top-left corner that the Python script expects.
  function anchorToTopLeft(): { xPct: number; yPct: number } {
    return {
      xPct: clamp01(anchor.x - logoWidthPct / 2),
      yPct: clamp01(anchor.y - logoHeightPct / 2),
    };
  }

  async function pollRun(runId: number, action: "apply" | "undo") {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch(`/api/run-script/${runId}`);
      if (!res.ok) {
        // 404/501 won't resolve by waiting — surface instead of spinning to the
        // 90s timeout. Transient codes keep polling.
        if (res.status === 404 || res.status === 501) {
          setMessage({
            tone: "err",
            text: `Couldn't read job status (${res.status}). The logo may have applied — refresh to check.`,
          });
          return;
        }
        continue;
      }
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
      const { xPct, yPct } = anchorToTopLeft();
      const res = await fetch("/api/run-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "overlay_logo",
          post_id: postId,
          vars: {
            position: "custom",
            maxLogoWidth: maxLogoWidth / 100,
            padding: 0,
            xPct,
            yPct,
            backgroundBlock: bgEnabled ? bgColor : null,
            logoId: selectedLogo?.id,
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

  // Logo overlay box: positioned by its center (`anchor`), so its visual
  // footprint extends ±halfWidth/halfHeight around that point. We render it
  // with translate(-50%,-50%) to match.
  const logoStyle: React.CSSProperties = {
    position: "absolute",
    left: `${anchor.x * 100}%`,
    top: `${anchor.y * 100}%`,
    transform: "translate(-50%, -50%)",
    width: `${logoWidthPct * 100}%`,
    pointerEvents: "none", // drag handled by stage, not the logo
    background: bgEnabled ? bgColor : "transparent",
    padding: bgEnabled ? "4%" : 0,
    borderRadius: bgEnabled ? "6%" : 0,
    boxShadow: bgEnabled ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
    transition: "background 0.15s ease",
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

      {postImageUrl && logoUrl ? (
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
          <div style={logoStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Logo preview"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalHeight > 0) {
                  setLogoNaturalAspect(img.naturalWidth / img.naturalHeight);
                }
              }}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                pointerEvents: "none",
              }}
            />
          </div>
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
            Drag the logo · {Math.round(anchor.x * 100)}% / {Math.round(anchor.y * 100)}%
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
          {!postImageUrl ? "No post image yet" : "No brand logo configured"}
        </div>
      )}

      <div style={{ display: "grid", gap: "12px" }}>
        {variants.length > 1 && (
          <div>
            <div style={labelStyle}>Logo variant</div>
            <div className="flex flex-wrap" style={{ gap: "6px", marginTop: "6px" }}>
              {variants.map((v) => {
                const on = selectedLogoId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedLogoId(v.id)}
                    disabled={!!busy}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 500,
                      border: on
                        ? "1px solid #c084fc"
                        : "1px solid rgba(255,255,255,0.12)",
                      background: on ? "rgba(192,132,252,0.18)" : "transparent",
                      color: on ? "#e9d5ff" : "#bfbfcc",
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    {v.label}
                    {v.isDefault && (
                      <span
                        style={{
                          marginLeft: "6px",
                          fontSize: "9px",
                          opacity: 0.6,
                          letterSpacing: "0.04em",
                        }}
                      >
                        ★
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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

        <div>
          <div className="flex items-center justify-between">
            <span style={labelStyle}>Size</span>
            <span
              style={
                {
                  fontSize: "11px",
                  color: "#bfbfcc",
                  tabularNums: "tabular-nums",
                } as React.CSSProperties
              }
            >
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

        <label
          className="flex items-center"
          style={{
            gap: "8px",
            fontSize: "12px",
            color: "#bfbfcc",
            cursor: "pointer",
          }}
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
      </div>

      <div className="flex" style={{ gap: "8px" }}>
        <button
          type="button"
          onClick={handleApply}
          disabled={!!busy || !logoUrl || !postImageUrl}
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
            opacity: busy || !logoUrl || !postImageUrl ? 0.6 : 1,
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
