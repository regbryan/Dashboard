"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DesignMode = "ai" | "card" | "photo";
type DesignRow = { label?: string | null; text: string };
type DesignShape = {
  mode?: DesignMode;
  eyebrow?: string | null;
  headline?: string | null;
  rows?: DesignRow[];
};
type BriefShape = {
  subject?: string;
  composition?: string | null;
  lighting?: string | null;
  mood?: string | null;
  style?: string | null;
  palette?: string[] | null;
  text_overlay?: string | null;
  aspect_ratio?: "1:1" | "4:5" | "9:16" | "16:9";
  notes?: string | null;
  design?: DesignShape;
};

function rowsToText(rows: DesignRow[] | undefined): string {
  return (rows ?? []).map((r) => (r.label ? `${r.label}: ${r.text}` : r.text)).join("\n");
}
function textToRows(text: string): DesignRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      if (i > 0 && i < 24) return { label: line.slice(0, i).trim(), text: line.slice(i + 1).trim() };
      return { text: line };
    });
}

const PANEL_BG = "#0f0f1a";
const PANEL_BORDER = "1px solid #1a1a2e";
const LABEL = "#9999a6";
const MUTED = "#7a7a88";
const VALUE = "#dcdce4";

export default function ImageBriefPanel({ postId }: { postId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [brief, setBrief] = useState<BriefShape>({});
  const [busy, setBusy] = useState<null | "save" | "generate">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Load (or auto-synthesize) the brief on mount.
  useEffect(() => {
    let cancelled = false;
    async function go() {
      try {
        const res = await fetch(`/api/posts/${postId}/image-brief`);
        const body = (await res.json()) as
          | { ok: true; brief: BriefShape; saved: boolean }
          | { ok: false; error: string };
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setErr("error" in body ? body.error : `HTTP ${res.status}`);
        } else {
          setBrief(body.brief ?? {});
          setSaved(body.saved);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    go();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function onSave() {
    setBusy("save");
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/posts/${postId}/image-brief`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? `HTTP ${res.status}`);
      } else {
        setMsg("Brief saved");
        setSaved(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate() {
    setBusy("generate");
    setMsg(null);
    setErr(null);
    try {
      // Save first so the regenerate uses exactly what's in the form.
      const save = await fetch(`/api/posts/${postId}/image-brief`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const saveBody = (await save.json()) as { ok: boolean; error?: string };
      if (!save.ok || !saveBody.ok) {
        setErr(saveBody.error ?? "save failed before generate");
        return;
      }
      const res = await fetch(`/api/posts/${postId}/regenerate`, {
        method: "POST",
      });
      const body = (await res.json()) as
        | { ok: true; storagePath: string; model: string }
        | { ok: false; error: string };
      if (!res.ok || !body.ok) {
        setErr("error" in body ? body.error : `HTTP ${res.status}`);
      } else {
        setMsg(`Generated with ${body.model}. Status set to in_review.`);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const paletteText = useMemo(
    () => (brief.palette ?? []).join(", "),
    [brief.palette]
  );

  return (
    <details
      open
      style={{
        background: PANEL_BG,
        border: PANEL_BORDER,
        borderRadius: "16px",
        padding: "20px 24px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#c084fc",
          listStyle: "none",
        }}
      >
        Autopilot brief · what gets sent to Gemini
      </summary>

      {loading ? (
        <p style={{ marginTop: "16px", fontSize: "13px", color: MUTED }}>Loading brief…</p>
      ) : (
        <div style={{ display: "grid", gap: "14px", marginTop: "20px" }}>
          <p style={{ fontSize: "11px", color: MUTED, lineHeight: 1.5 }}>
            {saved ? (
              <>
                Using your <strong style={{ color: VALUE }}>saved brief</strong>. Edit and
                generate again any time.
              </>
            ) : (
              <>
                <strong style={{ color: VALUE }}>Auto-synthesized</strong> from the
                calendar entry + brand kit. Edit and click <em>Save Brief</em> to lock it
                in, or just hit <em>Generate</em> to use it as-is (it&apos;ll be saved
                automatically).
              </>
            )}
          </p>

          <Field
            label="Subject"
            value={brief.subject ?? ""}
            onChange={(v) => setBrief({ ...brief, subject: v })}
            multiline
            required
          />
          <Field
            label="Composition"
            value={brief.composition ?? ""}
            onChange={(v) => setBrief({ ...brief, composition: v || null })}
          />
          <Field
            label="Lighting"
            value={brief.lighting ?? ""}
            onChange={(v) => setBrief({ ...brief, lighting: v || null })}
          />
          <Field
            label="Mood"
            value={brief.mood ?? ""}
            onChange={(v) => setBrief({ ...brief, mood: v || null })}
          />
          <Field
            label="Style"
            value={brief.style ?? ""}
            onChange={(v) => setBrief({ ...brief, style: v || null })}
            multiline
          />
          <Field
            label="Palette (comma-separated hex)"
            value={paletteText}
            onChange={(v) =>
              setBrief({
                ...brief,
                palette: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <Field
            label="Text overlay"
            value={brief.text_overlay ?? ""}
            onChange={(v) => setBrief({ ...brief, text_overlay: v || null })}
            placeholder="Leave blank for none"
          />
          <Field
            label="Notes"
            value={brief.notes ?? ""}
            onChange={(v) => setBrief({ ...brief, notes: v || null })}
            multiline
          />
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
            <label style={{ fontSize: "12px", color: LABEL, display: "flex", alignItems: "center", gap: "8px" }}>
              Aspect ratio
              <select
                value={brief.aspect_ratio ?? "1:1"}
                onChange={(e) =>
                  setBrief({
                    ...brief,
                    aspect_ratio: e.target.value as BriefShape["aspect_ratio"],
                  })
                }
                style={{
                  background: "#1a1a2e",
                  color: VALUE,
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  fontSize: "12px",
                }}
              >
                <option value="1:1">1:1 (square)</option>
                <option value="4:5">4:5 (portrait)</option>
                <option value="9:16">9:16 (story/reel)</option>
                <option value="16:9">16:9 (landscape)</option>
              </select>
            </label>
          </div>

          {/* Design mode — AI photo, full Satori card, or photo + text overlay */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "4px",
              paddingTop: "14px",
              borderTop: "1px solid #1a1a2e",
            }}
          >
            <label style={{ fontSize: "12px", color: LABEL, display: "flex", alignItems: "center", gap: "8px" }}>
              Design mode
              <select
                value={brief.design?.mode ?? "ai"}
                onChange={(e) =>
                  setBrief({ ...brief, design: { ...brief.design, mode: e.target.value as DesignMode } })
                }
                style={{
                  background: "#1a1a2e",
                  color: VALUE,
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  fontSize: "12px",
                }}
              >
                <option value="ai">AI photo (no overlay)</option>
                <option value="card">Designed card (no photo)</option>
                <option value="photo">Photo + text overlay</option>
              </select>
            </label>
            {(brief.design?.mode ?? "ai") !== "ai" && (
              <>
                <Field
                  label="Eyebrow"
                  value={brief.design?.eyebrow ?? ""}
                  onChange={(v) => setBrief({ ...brief, design: { ...brief.design, eyebrow: v || null } })}
                  placeholder="e.g. Pro Tip"
                />
                <Field
                  label="Headline"
                  value={brief.design?.headline ?? ""}
                  onChange={(v) => setBrief({ ...brief, design: { ...brief.design, headline: v || null } })}
                />
                {brief.design?.mode === "card" && (
                  <Field
                    label={'Rows (one per line, "Label: text")'}
                    value={rowsToText(brief.design?.rows)}
                    onChange={(v) => setBrief({ ...brief, design: { ...brief.design, rows: textToRows(v) } })}
                    multiline
                  />
                )}
                <p style={{ fontSize: "11px", color: MUTED }}>
                  Brand colors and the CTA (name, phone, website) are added automatically from the brand kit.
                </p>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onSave}
              disabled={busy !== null}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                background: "transparent",
                color: "#d9b4ff",
                border: "1px solid rgba(192,132,252,0.4)",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy === "save" ? "Saving…" : "Save brief"}
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy !== null}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                background: "#c084fc",
                color: "#1a0a2e",
                border: "none",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy === "generate" ? "Generating…" : "↻ Generate image"}
            </button>
          </div>

          {msg && <span style={{ fontSize: "12px", color: "#9be29b" }}>{msg}</span>}
          {err && <span style={{ fontSize: "12px", color: "#fbb27a" }}>⚠ {err}</span>}
        </div>
      )}
    </details>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "6px", fontSize: "12px" }}>
      <span style={{ color: LABEL }}>
        {label}
        {required && <span style={{ color: "#fbb27a" }}> *</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{
            background: "#07070e",
            color: VALUE,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "8px 10px",
            fontFamily: "inherit",
            fontSize: "13px",
            resize: "vertical",
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            background: "#07070e",
            color: VALUE,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "8px 10px",
            fontFamily: "inherit",
            fontSize: "13px",
          }}
        />
      )}
    </label>
  );
}
