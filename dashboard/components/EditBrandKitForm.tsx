"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ARCHETYPES = [
  "Hero",
  "Caregiver",
  "Sage",
  "Outlaw",
  "Creator",
  "Innocent",
  "Explorer",
  "Ruler",
  "Magician",
  "Lover",
  "Jester",
  "Everyman",
];

const ARCHETYPE_BLURBS: Record<string, string> = {
  Hero: "Bold, decisive, mastery-seeking. Saves the day.",
  Caregiver: "Nurturing, protective, compassionate. Cares for others.",
  Sage: "Wise, analytical, truth-seeking. Knowledge-first.",
  Outlaw: "Disruptive, rule-breaking, rebellious.",
  Creator: "Imaginative, expressive, original. Builds the new.",
  Innocent: "Pure, optimistic, simple. Sees the good.",
  Explorer: "Adventurous, independent, restless.",
  Ruler: "Authoritative, refined, in-control.",
  Magician: "Visionary, transformative, idea-driven.",
  Lover: "Sensual, intimate, relationship-focused.",
  Jester: "Playful, irreverent, joyful.",
  Everyman: "Down-to-earth, relatable, no-frills.",
};

const LABEL = "#9999a6";
const VALUE = "#dcdce4";

type ColorRoles = {
  background?: string | null;
  text?: string | null;
  cta?: string | null;
  highlight?: string | null;
  neutral_dark?: string | null;
  neutral_light?: string | null;
};

export default function EditBrandKitForm({
  brandId,
  initialArchetype,
  initialIndustry,
  initialVisualDonts,
  initialColorRoles,
}: {
  brandId: string;
  initialArchetype: string | null;
  initialIndustry: string | null;
  initialVisualDonts: string[] | null;
  initialColorRoles: ColorRoles | null;
}) {
  const router = useRouter();
  const [archetype, setArchetype] = useState(initialArchetype ?? "");
  const [industry, setIndustry] = useState(initialIndustry ?? "");
  const [visualDonts, setVisualDonts] = useState(
    (initialVisualDonts ?? []).join("\n")
  );
  const [roles, setRoles] = useState<ColorRoles>(initialColorRoles ?? {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSave() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const body = {
        archetype: archetype || null,
        industry: industry || null,
        visual_donts: visualDonts
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        color_roles: roles,
      };
      const res = await fetch(`/api/brands/${brandId}/kit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? `HTTP ${res.status}`);
      } else {
        setMsg("Saved");
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function setRole(k: keyof ColorRoles, v: string) {
    setRoles((prev) => ({ ...prev, [k]: v || null }));
  }

  return (
    <details
      style={{
        background: "#1a0f24",
        border: "1px solid #2a1638",
        borderRadius: "12px",
        padding: "16px 18px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#c084fc",
          listStyle: "none",
        }}
      >
        ✎ Edit brand kit · human-only fields
      </summary>

      <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
        <p style={{ fontSize: "11px", color: LABEL, lineHeight: 1.5, margin: 0 }}>
          Derivation handles positioning, tone, pillars, hashtags, photography
          direction, colors, and fonts. These four fields need a human once per
          brand — they shape every prompt afterward.
        </p>

        <Block label="Archetype">
          <select
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            style={selectStyle}
          >
            <option value="">— pick one —</option>
            {ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {archetype && (
            <p style={{ fontSize: "11px", color: LABEL, margin: "4px 0 0", lineHeight: 1.4 }}>
              {ARCHETYPE_BLURBS[archetype]}
            </p>
          )}
        </Block>

        <Block label="Industry">
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder='e.g. "HVAC residential", "Mortgage lending", "Cybersecurity for parents"'
            style={inputStyle}
          />
        </Block>

        <Block label="Visual don'ts (one per line)">
          <textarea
            value={visualDonts}
            onChange={(e) => setVisualDonts(e.target.value)}
            placeholder={"stock-photo plastic smiles\ncorporate gradients\nclip-art icons"}
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Block>

        <Block label="Named color roles (optional)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <RoleInput label="Background" value={roles.background ?? ""} onChange={(v) => setRole("background", v)} />
            <RoleInput label="Text" value={roles.text ?? ""} onChange={(v) => setRole("text", v)} />
            <RoleInput label="CTA" value={roles.cta ?? ""} onChange={(v) => setRole("cta", v)} />
            <RoleInput label="Highlight" value={roles.highlight ?? ""} onChange={(v) => setRole("highlight", v)} />
            <RoleInput label="Neutral dark" value={roles.neutral_dark ?? ""} onChange={(v) => setRole("neutral_dark", v)} />
            <RoleInput label="Neutral light" value={roles.neutral_light ?? ""} onChange={(v) => setRole("neutral_light", v)} />
          </div>
          <p style={{ fontSize: "11px", color: LABEL, margin: "4px 0 0", lineHeight: 1.4 }}>
            Hex values like #104B94. Tells the AI which color does what — derivation
            can&apos;t infer this.
          </p>
        </Block>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              background: "#c084fc",
              color: "#1a0a2e",
              border: "none",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {msg && <span style={{ fontSize: "11px", color: "#9be29b" }}>{msg}</span>}
          {err && <span style={{ fontSize: "11px", color: "#fbb27a" }}>⚠ {err}</span>}
        </div>
      </div>
    </details>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "11px", color: LABEL, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function RoleInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "grid", gap: "4px", fontSize: "11px", color: LABEL }}>
      <span>{label}</span>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <div
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            background: /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          style={{ ...inputStyle, fontSize: "12px", padding: "5px 8px" }}
        />
      </div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#07070e",
  color: VALUE,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  padding: "8px 10px",
  fontFamily: "inherit",
  fontSize: "12px",
  width: "100%",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
