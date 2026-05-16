"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

/**
 * Single-page brand onboarding form. Submits to /api/onboarding/create
 * which creates the brands row, brand_kits row, and user_brand_access
 * in one shot. On success we redirect to the new brand's dashboard.
 *
 * Multi-step wizard polish lands in a follow-up — this version
 * prioritizes "complete in one screen" over "guided step-by-step".
 */

const ARCHETYPES = [
  "Innocent",
  "Sage",
  "Explorer",
  "Outlaw",
  "Magician",
  "Hero",
  "Lover",
  "Jester",
  "Everyman",
  "Caregiver",
  "Ruler",
  "Creator",
];

const PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok"];

function slugifyFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export default function OnboardingForm() {
  const router = useRouter();

  // ─── identity ───
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [cadence, setCadence] = useState("3 per week");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [hqLocation, setHqLocation] = useState("");

  // ─── positioning ───
  const [archetype, setArchetype] = useState("");
  const [industry, setIndustry] = useState("");
  const [tagline, setTagline] = useState("");
  const [positioning, setPositioning] = useState("");
  const [mission, setMission] = useState("");

  // ─── visuals ───
  const [colorPrimary, setColorPrimary] = useState("#8b5cff");
  const [colorSecondary, setColorSecondary] = useState("");
  const [colorAccent, setColorAccent] = useState("");

  // ─── voice ───
  const [toneKeywordsRaw, setToneKeywordsRaw] = useState("");
  const [dosRaw, setDosRaw] = useState("");
  const [dontsRaw, setDontsRaw] = useState("");

  // ─── hashtags ───
  const [tagsAlwaysOnRaw, setTagsAlwaysOnRaw] = useState("");
  const [tagsLocalRaw, setTagsLocalRaw] = useState("");

  // ─── ui state ───
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-derive slug from name until the user manually edits it
  const computedSlug = useMemo(() => {
    if (slugTouched) return slug;
    return slugifyFromName(name);
  }, [name, slug, slugTouched]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        slug: computedSlug,
        name,
        handle: handle || null,
        platform,
        cadence: cadence || null,
        websiteUrl: websiteUrl || null,
        hqLocation: hqLocation || null,
        archetype: archetype || null,
        industry: industry || null,
        tagline: tagline || null,
        positioning: positioning || null,
        mission: mission || null,
        colorPrimary: colorPrimary || null,
        colorSecondary: colorSecondary || null,
        colorAccent: colorAccent || null,
        toneKeywords: parseList(toneKeywordsRaw),
        dos: parseLines(dosRaw),
        donts: parseLines(dontsRaw),
        hashtagsAlwaysOn: parseTags(tagsAlwaysOnRaw),
        hashtagsLocal: parseTags(tagsLocalRaw),
      };

      const res = await fetch("/api/onboarding/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Submission failed.");
      }
      router.push(data.redirect ?? `/dashboard/brand/${computedSlug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "24px" }}>
      <Section title="Identity" hint="The basics that show up everywhere.">
        <Field
          label="Brand name"
          required
          value={name}
          onChange={setName}
          placeholder="Inland Empire Comfort"
        />
        <Field
          label="URL slug"
          required
          value={computedSlug}
          onChange={(v) => {
            setSlug(v);
            setSlugTouched(true);
          }}
          mono
          hint="lowercase letters, numbers, hyphens. shown in URLs only."
          placeholder="inland-empire-comfort"
        />
        <Field
          label="Instagram handle"
          value={handle}
          onChange={setHandle}
          placeholder="@inlandempirecomfort"
        />
        <Row>
          <Select
            label="Primary platform"
            value={platform}
            onChange={setPlatform}
            options={PLATFORMS}
          />
          <Field
            label="Posting cadence"
            value={cadence}
            onChange={setCadence}
            placeholder="3 per week"
          />
        </Row>
        <Row>
          <Field
            label="Website"
            value={websiteUrl}
            onChange={setWebsiteUrl}
            placeholder="https://example.com"
          />
          <Field
            label="HQ location"
            value={hqLocation}
            onChange={setHqLocation}
            placeholder="Riverside, CA"
          />
        </Row>
      </Section>

      <Section
        title="Positioning"
        hint="One-liners that anchor the brand's voice."
      >
        <Row>
          <Select
            label="Archetype"
            value={archetype}
            onChange={setArchetype}
            options={["", ...ARCHETYPES]}
            placeholder="Pick one (optional)"
          />
          <Field
            label="Industry"
            value={industry}
            onChange={setIndustry}
            placeholder="HVAC · DTC apparel · Real estate"
          />
        </Row>
        <Field
          label="Tagline"
          value={tagline}
          onChange={setTagline}
          placeholder="Comfort, restored."
        />
        <Textarea
          label="Positioning"
          value={positioning}
          onChange={setPositioning}
          placeholder="What we do, who we do it for, what makes us different."
          rows={3}
        />
        <Textarea
          label="Mission"
          value={mission}
          onChange={setMission}
          placeholder="Why we exist."
          rows={2}
        />
      </Section>

      <Section title="Visuals" hint="Brand palette. You can leave secondary/accent blank.">
        <Row>
          <ColorField label="Primary color" value={colorPrimary} onChange={setColorPrimary} />
          <ColorField label="Secondary color" value={colorSecondary} onChange={setColorSecondary} />
          <ColorField label="Accent color" value={colorAccent} onChange={setColorAccent} />
        </Row>
      </Section>

      <Section
        title="Voice"
        hint="Tone keywords and do/don't rules used by the caption generator."
      >
        <Field
          label="Tone keywords"
          value={toneKeywordsRaw}
          onChange={setToneKeywordsRaw}
          placeholder="warm, direct, no-jargon"
          hint="comma-separated"
        />
        <Row>
          <Textarea
            label="Do"
            value={dosRaw}
            onChange={setDosRaw}
            placeholder="Lead with a concrete win&#10;Mention the licensed-and-bonded line in every post"
            rows={3}
            hint="one per line"
          />
          <Textarea
            label="Don't"
            value={dontsRaw}
            onChange={setDontsRaw}
            placeholder="Avoid em-dashes&#10;Never say &ldquo;we provide quality service&rdquo;"
            rows={3}
            hint="one per line"
          />
        </Row>
      </Section>

      <Section
        title="Hashtags"
        hint="Curated buckets the autopilot pulls from. Add what you have; you can edit anytime."
      >
        <Field
          label="Always-on (every post)"
          value={tagsAlwaysOnRaw}
          onChange={setTagsAlwaysOnRaw}
          placeholder="#InlandEmpireComfort #IECHVAC"
          hint="space or comma separated"
        />
        <Field
          label="Local / geo tags"
          value={tagsLocalRaw}
          onChange={setTagsLocalRaw}
          placeholder="#Riverside #InlandEmpire #SoCalHVAC"
          hint="space or comma separated"
        />
      </Section>

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 14px",
            borderRadius: "10px",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "#fca5a5",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "16px",
          paddingTop: "8px",
        }}
      >
        <button
          type="submit"
          disabled={busy || !name || !computedSlug}
          className="sp-shiny"
        >
          {busy ? "Creating…" : "Create brand →"}
        </button>
        <span style={{ fontSize: "12px", color: "#7a7a88", lineHeight: 1.5 }}>
          Anything blank can be filled in later from the Brand Kit tab.
        </span>
      </div>
    </form>
  );
}

// ─── building blocks ─────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#0f0f1a",
        border: "1px solid #1a1a2e",
        borderRadius: "16px",
        padding: "20px 22px",
        display: "grid",
        gap: "16px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#9999a6",
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        <p
          style={{
            marginTop: "4px",
            fontSize: "12px",
            color: "#7a7a88",
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      </div>
      <div style={{ display: "grid", gap: "12px" }}>{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: "5px" }}>
      <span style={inputLabelStyle}>
        {label}
        {required && <span style={{ color: "#f87171" }}> *</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          ...inputStyle,
          fontFamily: mono
            ? "ui-monospace, SF Mono, Menlo, monospace"
            : undefined,
        }}
      />
      {hint && <span style={hintStyle}>{hint}</span>}
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "5px" }}>
      <span style={inputLabelStyle}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 3}
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
      />
      {hint && <span style={hintStyle}>{hint}</span>}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "5px" }}>
      <span style={inputLabelStyle}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...inputStyle,
          appearance: "none",
          textTransform: "capitalize",
        }}
      >
        {options.map((o) =>
          o === "" ? (
            <option key="__empty" value="">
              {placeholder ?? "Pick one"}
            </option>
          ) : (
            <option key={o} value={o}>
              {o}
            </option>
          )
        )}
      </select>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: "5px" }}>
      <span style={inputLabelStyle}>{label}</span>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <input
          type="color"
          value={value || "#8b5cff"}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "44px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          style={{
            ...inputStyle,
            border: "none",
            borderRadius: 0,
            background: "transparent",
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: "13px",
            textTransform: "uppercase",
          }}
        />
      </div>
    </label>
  );
}

const inputLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.04em",
  color: "#bfbfcc",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  padding: "9px 12px",
  fontSize: "14px",
  color: "white",
  outline: "none",
  width: "100%",
};

const hintStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#7a7a88",
  lineHeight: 1.4,
};

// ─── parsing helpers ─────────────────────────────────────────────────

function parseList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseLines(raw: string): string[] {
  return raw
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().replace(/^#/, ""))
    .filter(Boolean);
}
