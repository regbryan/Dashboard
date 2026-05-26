import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Brand health · SocialPulse",
  description: "Per-brand readiness state — mirrors PROJECT_INDEX.md.",
};

/**
 * /dashboard/health — admin-only mirror of PROJECT_INDEX.md.
 *
 * Reads the dashboard.brands rows (which were synced from
 * _brands/<slug>/brand.json by _ops/sync-brand-index.py) and renders
 * the same per-brand status table the operator sees in the markdown
 * index. Designed for "one-glance: is every brand ready to dispatch?"
 *
 * Admin gate is enforced by proxy.ts — /dashboard/* is admin-only.
 */
export default async function HealthPage() {
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, platform, cadence, color_primary, color_secondary, color_accent, voice_confidence, color_confidence, has_brand_doc, has_kit_doc, brand_json_synced_at")
    .order("id");

  const rows = brands ?? [];

  const voiceGaps = rows.filter(
    (b) => b.voice_confidence != null && b.voice_confidence !== "high",
  );
  const paletteGaps = rows.filter(
    (b) => b.color_confidence != null && b.color_confidence !== "high",
  );
  const docGaps = rows.filter((b) => !b.has_kit_doc);

  return (
    <div className="mx-auto" style={{ maxWidth: "1080px", padding: "32px clamp(20px, 4vw, 40px) 64px" }}>
      <header style={{ marginBottom: "24px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#c084fc",
          }}
        >
          Admin · Brand readiness
        </span>
        <h1
          style={{
            marginTop: "8px",
            fontSize: "32px",
            fontWeight: 600,
            color: "white",
            letterSpacing: "-0.02em",
          }}
        >
          Brand health
        </h1>
        <p style={{ marginTop: "6px", color: "#9999a6", fontSize: "13px", lineHeight: 1.5 }}>
          Mirrors{" "}
          <code style={{ color: "#bfbfcc" }}>PROJECT_INDEX.md</code> at the
          file-system level. Refreshed when{" "}
          <code style={{ color: "#bfbfcc" }}>
            python _ops/sync-brand-index.py
          </code>{" "}
          runs.
        </p>
      </header>

      <div
        style={{
          background: "#0f0f1a",
          border: "1px solid #1a1a2e",
          borderRadius: "14px",
          overflow: "hidden",
          marginBottom: "32px",
        }}
      >
        <div
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1.4fr 100px 1.2fr 1fr 70px 70px 130px",
            gap: "12px",
            padding: "12px 18px",
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid #1a1a2e",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#8a8a98",
          }}
        >
          <span>Slug</span>
          <span>Name</span>
          <span>Platform</span>
          <span>Cadence</span>
          <span>Palette</span>
          <span style={{ textAlign: "center" }}>Voice</span>
          <span style={{ textAlign: "center" }}>Kit</span>
          <span>Synced</span>
        </div>
        {rows.map((b) => (
          <BrandRow key={b.id} brand={b} />
        ))}
      </div>

      {(voiceGaps.length > 0 || paletteGaps.length > 0 || docGaps.length > 0) && (
        <section
          style={{
            padding: "18px 22px",
            background: "rgba(251, 191, 36, 0.04)",
            border: "1px solid rgba(251, 191, 36, 0.22)",
            borderRadius: "14px",
          }}
        >
          <h2
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#fcd34d",
              marginBottom: "10px",
            }}
          >
            ⚠ Open gaps
          </h2>
          {voiceGaps.length > 0 && (
            <GapLine
              label="Voice doc missing"
              brands={voiceGaps}
              tail="Run the brand-scanner skill against the brand's website + 5-10 sample captions, then write _brands/<slug>/voice.md."
            />
          )}
          {paletteGaps.length > 0 && (
            <GapLine
              label="Palette TBD"
              brands={paletteGaps}
              tail="Lock primary + secondary in _brands/<slug>/brand.json (use _ops/extract-brand-palette.py on the brand's reference-posts/)."
            />
          )}
          {docGaps.length > 0 && (
            <GapLine
              label="Missing kit.md"
              brands={docGaps}
              tail="Add a kit.md sidecar at _brands/<slug>/kit.md with positioning + pillars (optional but recommended)."
            />
          )}
        </section>
      )}

      <footer style={{ marginTop: "32px", fontSize: "12px", color: "#7a7a88" }}>
        <p style={{ margin: 0 }}>
          This page reads from the production{" "}
          <code style={{ color: "#bfbfcc" }}>brands</code> table. The canonical
          file-system source is{" "}
          <code style={{ color: "#bfbfcc" }}>_brands/&lt;slug&gt;/brand.json</code>.
          Drift between the two should be resolved by running{" "}
          <code style={{ color: "#bfbfcc" }}>_ops/sync-brand-index.py</code>{" "}
          locally, then applying the generated SQL to production.
        </p>
      </footer>
    </div>
  );
}

interface BrandHealthRow {
  id: string;
  name: string;
  platform?: string | null;
  cadence?: string | null;
  color_primary?: string | null;
  color_secondary?: string | null;
  color_accent?: string | null;
  voice_confidence?: string | null;
  color_confidence?: string | null;
  has_brand_doc?: number | boolean | null;
  has_kit_doc?: boolean | null;
  brand_json_synced_at?: string | null;
}

function BrandRow({ brand }: { brand: BrandHealthRow }) {
  const palette = [
    brand.color_primary,
    brand.color_secondary,
    brand.color_accent,
  ].filter((c): c is string => !!c);

  const syncedDate = brand.brand_json_synced_at
    ? new Date(brand.brand_json_synced_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <Link
      href={`/dashboard/brand/${brand.id}`}
      role="row"
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1.4fr 100px 1.2fr 1fr 70px 70px 130px",
        gap: "12px",
        padding: "14px 18px",
        borderBottom: "1px solid #131320",
        fontSize: "13px",
        color: "#dcdce4",
        textDecoration: "none",
        alignItems: "center",
        transition: "background 0.15s ease",
      }}
    >
      <code
        style={{
          fontSize: "12px",
          color: "#c084fc",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
        }}
      >
        {brand.id}
      </code>
      <span style={{ color: "white", fontWeight: 500 }}>{brand.name}</span>
      <span style={{ color: "#9999a6", fontSize: "12px", textTransform: "capitalize" }}>
        {brand.platform || "—"}
      </span>
      <span style={{ color: "#bfbfcc", fontSize: "12px" }}>
        {brand.cadence || "—"}
      </span>
      <div className="flex items-center" style={{ gap: "4px" }}>
        {palette.length > 0 ? (
          palette.map((c, i) => (
            <span
              key={`${c}-${i}`}
              title={c}
              style={{
                display: "inline-block",
                width: "11px",
                height: "11px",
                borderRadius: "50%",
                backgroundColor: c,
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          ))
        ) : (
          <span style={{ color: "#7a7a88", fontSize: "11px" }}>TBD</span>
        )}
      </div>
      <span style={{ textAlign: "center" }}>
        <ConfDot value={brand.voice_confidence} />
      </span>
      <span style={{ textAlign: "center" }}>
        <ConfDot value={brand.has_kit_doc ? "high" : "missing"} />
      </span>
      <span style={{ color: "#7a7a88", fontSize: "12px" }}>{syncedDate}</span>
    </Link>
  );
}

function ConfDot({ value }: { value: string | null | undefined }) {
  const color =
    value === "high"
      ? "#86efac"
      : value === "low"
        ? "#fcd34d"
        : value === "missing"
          ? "#fb923c"
          : "#3a3a45";
  return (
    <span
      title={value || "unknown"}
      style={{
        display: "inline-block",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow:
          value === "high" ? `0 0 8px ${color}80` : undefined,
      }}
    />
  );
}

function GapLine({
  label,
  brands,
  tail,
}: {
  label: string;
  brands: BrandHealthRow[];
  tail: string;
}) {
  return (
    <p style={{ fontSize: "13px", color: "#e6e6ed", margin: "6px 0", lineHeight: 1.5 }}>
      <strong style={{ color: "#fcd34d" }}>{label}:</strong>{" "}
      {brands.map((b, i) => (
        <span key={b.id}>
          <Link
            href={`/dashboard/brand/${b.id}/kit`}
            style={{ color: "#fcd34d", textDecoration: "underline" }}
          >
            {b.name}
          </Link>
          {i < brands.length - 1 ? ", " : ""}
        </span>
      ))}{" "}
      <span style={{ color: "#9999a6" }}>— {tail}</span>
    </p>
  );
}
