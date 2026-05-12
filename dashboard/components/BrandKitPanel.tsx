import type { BrandKitView, AutopilotRule } from "@/lib/brand-kit";

const PANEL_BG = "#0f0f1a";
const PANEL_BORDER = "1px solid #1a1a2e";
const MUTED = "#7a7a88";
const LABEL = "#9999a6";
const VALUE = "#dcdce4";

export default function BrandKitPanel({ view }: { view: BrandKitView }) {
  const { brand, kit, logoCount, rules } = view;

  return (
    <details
      open
      style={{
        background: PANEL_BG,
        border: PANEL_BORDER,
        borderRadius: "16px",
        padding: "20px 24px",
        marginBottom: "28px",
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
        Brand Kit · what the autopilot uses
      </summary>

      <div style={{ display: "grid", gap: "24px", marginTop: "20px" }}>
        <Rules rules={rules} />

        <Section title="Identity">
          <Field label="Name" value={brand.name} />
          <Field label="Handle" value={brand.handle} />
          <Field label="Platform" value={brand.platform} />
          <Field label="Cadence" value={brand.cadence} />
          <Field label="Tagline" value={kit?.tagline ?? null} />
        </Section>

        <Section title="Positioning">
          <Field label="Positioning" value={kit?.positioning ?? null} multiline />
          <Field label="Mission" value={kit?.mission ?? null} multiline />
          <Field label="Description" value={kit?.description ?? null} multiline />
        </Section>

        <Section title="Visuals">
          <Colors brand={brand} kit={kit} />
          <Field
            label="Logo variants"
            value={logoCount > 0 ? `${logoCount} on file` : null}
          />
          <Field
            label="Photography direction"
            value={kit?.photography_direction ?? null}
            multiline
          />
          <Field label="Fonts" value={formatJson(kit?.fonts)} multiline />
        </Section>

        <Section title="Voice & content">
          <Field label="Tone" value={formatJson(kit?.tone)} multiline />
          <Field
            label="Content pillars"
            value={formatPillars(kit?.content_pillars)}
            multiline
          />
          <Field label="Audiences" value={formatAudiences(kit?.audiences)} multiline />
          <Field label="Hashtags" value={formatJson(kit?.hashtags)} multiline />
        </Section>

        <Section title="Compliance & locale">
          <Field
            label="Compliance text (legacy brands.compliance)"
            value={brand.compliance}
            multiline
          />
          <Field
            label="Compliance footer (brand_kits.compliance_footer)"
            value={kit?.compliance_footer ?? null}
            multiline
          />
          <Field label="HQ location" value={kit?.hq_location ?? null} />
          <Field
            label="Service area"
            value={kit?.service_area && kit.service_area.length > 0 ? kit.service_area.join(", ") : null}
          />
          <Field label="Onboarding status" value={kit?.onboarding_status ?? null} />
        </Section>
      </div>
    </details>
  );
}

function Rules({ rules }: { rules: AutopilotRule[] }) {
  if (rules.length === 0) return null;
  return (
    <div
      style={{
        background: "#1a0f24",
        border: "1px solid #2a1638",
        borderRadius: "12px",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#c084fc",
          fontWeight: 600,
          marginBottom: "10px",
        }}
      >
        Autopilot rules in force
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px" }}>
        {rules.map((rule, i) => (
          <li
            key={i}
            style={{ fontSize: "12px", color: VALUE, lineHeight: 1.5, display: "flex", gap: "10px" }}
          >
            <span
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: "999px",
                background: rule.source === "universal" ? "#3b1f57" : "#1f3b57",
                color: rule.source === "universal" ? "#d9b4ff" : "#b4d9ff",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                height: "fit-content",
              }}
            >
              {rule.source}
            </span>
            <span>
              <strong style={{ color: "white" }}>{rule.label}.</strong>{" "}
              <span style={{ color: MUTED }}>{rule.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: LABEL,
          fontWeight: 600,
          marginBottom: "10px",
        }}
      >
        {title}
      </div>
      <div style={{ display: "grid", gap: "10px" }}>{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  const isMissing = !value || value.trim().length === 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 240px) 1fr",
        gap: "16px",
        fontSize: "13px",
        alignItems: "baseline",
      }}
    >
      <div style={{ color: LABEL }}>{label}</div>
      {isMissing ? (
        <MissingBadge />
      ) : (
        <div
          style={{
            color: VALUE,
            whiteSpace: multiline ? "pre-wrap" : "normal",
            wordBreak: "break-word",
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function MissingBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: "999px",
        background: "rgba(251, 178, 122, 0.12)",
        border: "1px solid rgba(251, 178, 122, 0.35)",
        color: "#fbb27a",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        width: "fit-content",
      }}
    >
      Missing
    </span>
  );
}

function Colors({
  brand,
  kit,
}: {
  brand: { color_primary: string | null; color_secondary: string | null; color_accent: string | null };
  kit: { colors: Record<string, unknown> | null } | null;
}) {
  const swatches: { label: string; hex: string }[] = [];
  if (brand.color_primary) swatches.push({ label: "Primary", hex: brand.color_primary });
  if (brand.color_secondary) swatches.push({ label: "Secondary", hex: brand.color_secondary });
  if (brand.color_accent) swatches.push({ label: "Accent", hex: brand.color_accent });
  if (kit?.colors && typeof kit.colors === "object") {
    for (const [key, val] of Object.entries(kit.colors)) {
      if (typeof val === "string" && val.startsWith("#")) {
        const label = `kit.${key}`;
        if (!swatches.some((s) => s.hex.toLowerCase() === val.toLowerCase())) {
          swatches.push({ label, hex: val });
        }
      }
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 240px) 1fr",
        gap: "16px",
        fontSize: "13px",
        alignItems: "center",
      }}
    >
      <div style={{ color: LABEL }}>Colors</div>
      {swatches.length === 0 ? (
        <MissingBadge />
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {swatches.map((s) => (
            <div key={s.hex + s.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "4px",
                  background: s.hex,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              />
              <span style={{ color: VALUE, fontSize: "12px" }}>
                {s.label} <span style={{ color: MUTED }}>{s.hex.toUpperCase()}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatJson(value: Record<string, unknown> | null | undefined): string | null {
  if (!value || Object.keys(value).length === 0) return null;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      parts.push(`${k}: ${v.join(", ")}`);
    } else if (typeof v === "object") {
      parts.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      parts.push(`${k}: ${String(v)}`);
    }
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

function formatPillars(value: unknown[] | null | undefined): string | null {
  if (!value || value.length === 0) return null;
  const lines: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : null;
    const pct = typeof o.pct === "number" ? `${o.pct}%` : null;
    if (name) lines.push([name, pct].filter(Boolean).join(" — "));
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function formatAudiences(value: unknown[] | null | undefined): string | null {
  if (!value || value.length === 0) return null;
  const lines: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const tier = typeof o.tier === "string" ? o.tier : null;
    const desc = typeof o.description === "string" ? o.description : null;
    if (tier || desc) lines.push([tier, desc].filter(Boolean).join(": "));
  }
  return lines.length > 0 ? lines.join("\n") : null;
}
