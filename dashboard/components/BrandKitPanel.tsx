import type { BrandKitView, AutopilotRule } from "@/lib/brand-kit";
import RefreshBrandKitButton from "./RefreshBrandKitButton";
import EditBrandKitForm from "./EditBrandKitForm";

const MUTED = "#7a7a88";
const LABEL = "#9999a6";
const VALUE = "#dcdce4";
const ACCENT = "#c084fc";

export default function BrandKitPanel({ view }: { view: BrandKitView }) {
  const { brand, kit, logoCount, rules } = view;

  const colors = collectColors(brand, kit);
  const primaryHex = colors[0]?.hex ?? null;

  return (
    <div style={{ display: "grid", gap: "32px" }}>
      {/* Hero — what defines this brand at a glance */}
      <Hero
        brand={brand}
        kit={kit}
        primaryHex={primaryHex}
        logoCount={logoCount}
      />

      {/* Positioning narrative — tagline → positioning → mission → description */}
      <Positioning kit={kit} />

      {/* Visual identity */}
      <VisualIdentity kit={kit} colors={colors} logoCount={logoCount} />

      {/* Voice & personality */}
      <Voice kit={kit} />

      {/* Content strategy */}
      <ContentStrategy kit={kit} />

      {/* Compliance & locale — compact row */}
      <ComplianceRow brand={brand} kit={kit} />

      {/* Autopilot rules — supporting reference */}
      <Rules rules={rules} />

      {/* Operator surface — refresh + edit at the bottom */}
      <OperatorPanel
        brandId={brand.id}
        kit={kit}
      />
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────

function Hero({
  brand,
  kit,
  primaryHex,
  logoCount,
}: {
  brand: BrandKitView["brand"];
  kit: BrandKitView["kit"];
  primaryHex: string | null;
  logoCount: number;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(192,132,252,0.06) 0%, rgba(15,15,26,0.6) 100%)",
        border: "1px solid rgba(192,132,252,0.18)",
        borderRadius: "20px",
        padding: "24px 28px",
        display: "grid",
        gap: "20px",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
        {primaryHex && (
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: primaryHex,
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: `0 0 32px ${primaryHex}40`,
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: ACCENT,
              fontWeight: 600,
            }}
          >
            {kit?.archetype ? `${kit.archetype} archetype` : "Brand archetype unset"}
          </div>
          <div style={{ marginTop: "4px", fontSize: "24px", fontWeight: 600, color: "white", letterSpacing: "-0.02em" }}>
            {brand.name}
          </div>
          {kit?.tagline && (
            <div style={{ marginTop: "6px", fontSize: "14px", color: VALUE, fontStyle: "italic" }}>
              &ldquo;{kit.tagline}&rdquo;
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
        }}
      >
        <StatTile label="Industry" value={kit?.industry} />
        <StatTile label="Platform" value={brand.platform} />
        <StatTile label="Cadence" value={brand.cadence} />
        <StatTile label="Logos" value={logoCount > 0 ? String(logoCount) : null} />
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: LABEL,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: "4px",
          fontSize: "14px",
          color: value ? "white" : MUTED,
          fontWeight: 500,
          textTransform: value && value.length < 16 ? "capitalize" : "none",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

// ─── Positioning ────────────────────────────────────────────────────────

function Positioning({ kit }: { kit: BrandKitView["kit"] }) {
  const hasAny = kit?.positioning || kit?.mission || kit?.description;
  if (!hasAny) return <EmptySection title="Positioning" hint="Run derivation or fill in via Edit." />;

  return (
    <SectionFrame title="Positioning">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {kit?.positioning && (
          <Quote label="Positioning" body={kit.positioning} />
        )}
        {kit?.mission && (
          <Quote label="Mission" body={kit.mission} accent />
        )}
        {kit?.description && (
          <Quote label="Description" body={kit.description} />
        )}
      </div>
    </SectionFrame>
  );
}

function Quote({ label, body, accent }: { label: string; body: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? "rgba(192,132,252,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${accent ? "rgba(192,132,252,0.18)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "12px",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: accent ? ACCENT : LABEL,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <p style={{ marginTop: "8px", fontSize: "14px", lineHeight: 1.55, color: VALUE }}>
        {body}
      </p>
    </div>
  );
}

// ─── Visual Identity ────────────────────────────────────────────────────

function VisualIdentity({
  kit,
  colors,
  logoCount,
}: {
  kit: BrandKitView["kit"];
  colors: { label: string; hex: string }[];
  logoCount: number;
}) {
  const photography = kit?.photography_direction;
  const donts = kit?.visual_donts ?? [];
  const fonts = kit?.fonts;

  return (
    <SectionFrame title="Visual identity">
      <div style={{ display: "grid", gap: "20px" }}>
        {colors.length > 0 ? (
          <ColorRibbon colors={colors} />
        ) : (
          <MissingCard label="No palette yet" hint="Derivation samples colors from approved post images." />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
            alignItems: "start",
          }}
        >
          {photography ? (
            <Quote label="Photography direction" body={photography} />
          ) : (
            <MissingCard label="Photography direction" hint="Derived from approved images." />
          )}
          {fonts && Object.keys(fonts).length > 0 ? (
            <KeyValueCard
              label="Typography"
              entries={Object.entries(fonts)
                .filter(([, v]) => v != null && String(v).length > 0)
                .map(([k, v]) => [k, String(v)])}
            />
          ) : (
            <MissingCard label="Typography" hint="Low-confidence hint via Gemini Vision." />
          )}
          <KeyValueCard
            label="Assets"
            entries={[
              ["Logo variants", logoCount > 0 ? `${logoCount} on file` : "none"],
            ]}
          />
        </div>

        {donts.length > 0 && (
          <DontsCallout donts={donts} />
        )}
      </div>
    </SectionFrame>
  );
}

function ColorRibbon({ colors }: { colors: { label: string; hex: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
      {colors.map((c) => (
        <div
          key={c.hex + c.label}
          style={{
            flex: "1 1 140px",
            minWidth: "140px",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ height: "64px", background: c.hex }} />
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ fontSize: "11px", color: LABEL, textTransform: "capitalize" }}>
              {c.label}
            </div>
            <div
              style={{
                marginTop: "2px",
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: "12px",
                color: VALUE,
                letterSpacing: "0.02em",
              }}
            >
              {c.hex.toUpperCase()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DontsCallout({ donts }: { donts: string[] }) {
  return (
    <div
      style={{
        background: "rgba(248,113,113,0.04)",
        border: "1px solid rgba(248,113,113,0.18)",
        borderRadius: "12px",
        padding: "14px 18px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#f87171",
          fontWeight: 600,
          marginBottom: "10px",
        }}
      >
        Visual don&apos;ts
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {donts.map((d) => (
          <span
            key={d}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 11px",
              borderRadius: "8px",
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.22)",
              fontSize: "12px",
              color: "rgba(255,200,200,0.9)",
            }}
          >
            <span style={{ color: "#f87171", fontWeight: 700 }}>✕</span>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Voice ──────────────────────────────────────────────────────────────

function Voice({ kit }: { kit: BrandKitView["kit"] }) {
  const tone = (kit?.tone ?? {}) as Record<string, unknown>;
  const keywords = toStringArray(tone.keywords);
  const dos = toStringArray(tone.dos);
  const donts = toStringArray(tone.donts);
  const vocabUse = toStringArray(tone.vocab_use);
  const vocabAvoid = toStringArray(tone.vocab_avoid);

  const isEmpty =
    keywords.length === 0 &&
    dos.length === 0 &&
    donts.length === 0 &&
    vocabUse.length === 0 &&
    vocabAvoid.length === 0;

  if (isEmpty) {
    return <EmptySection title="Voice & personality" hint="Tone keywords, do/don't, and vocabulary." />;
  }

  return (
    <SectionFrame title="Voice & personality">
      <div style={{ display: "grid", gap: "16px" }}>
        {keywords.length > 0 && (
          <div>
            <SubLabel>Tone keywords</SubLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              {keywords.map((k) => (
                <Chip key={k}>{k}</Chip>
              ))}
            </div>
          </div>
        )}

        {(dos.length > 0 || donts.length > 0) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {dos.length > 0 && <DoDontList items={dos} kind="do" />}
            {donts.length > 0 && <DoDontList items={donts} kind="dont" />}
          </div>
        )}

        {(vocabUse.length > 0 || vocabAvoid.length > 0) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {vocabUse.length > 0 && <VocabList items={vocabUse} kind="use" />}
            {vocabAvoid.length > 0 && <VocabList items={vocabAvoid} kind="avoid" />}
          </div>
        )}
      </div>
    </SectionFrame>
  );
}

function DoDontList({ items, kind }: { items: string[]; kind: "do" | "dont" }) {
  const isDo = kind === "do";
  const color = isDo ? "#7ee787" : "#f87171";
  const bg = isDo ? "rgba(126,231,135,0.04)" : "rgba(248,113,113,0.04)";
  const border = isDo ? "rgba(126,231,135,0.18)" : "rgba(248,113,113,0.18)";
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "12px",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color,
          fontWeight: 600,
          marginBottom: "8px",
        }}
      >
        {isDo ? "Do" : "Don't"}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "6px" }}>
        {items.map((it) => (
          <li key={it} style={{ fontSize: "13px", color: VALUE, display: "flex", gap: "8px", lineHeight: 1.5 }}>
            <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{isDo ? "✓" : "✕"}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VocabList({ items, kind }: { items: string[]; kind: "use" | "avoid" }) {
  const isUse = kind === "use";
  return (
    <div>
      <SubLabel>{isUse ? "Vocabulary to use" : "Vocabulary to avoid"}</SubLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
        {items.map((w) => (
          <span
            key={w}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              background: isUse ? "rgba(126,231,135,0.06)" : "rgba(248,113,113,0.04)",
              border: `1px solid ${isUse ? "rgba(126,231,135,0.2)" : "rgba(248,113,113,0.2)"}`,
              color: isUse ? "rgba(167,243,196,0.95)" : "rgba(255,200,200,0.85)",
              textDecoration: isUse ? "none" : "line-through",
              textDecorationColor: "rgba(248,113,113,0.5)",
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Content Strategy ──────────────────────────────────────────────────

function ContentStrategy({ kit }: { kit: BrandKitView["kit"] }) {
  const pillars = parsePillars(kit?.content_pillars);
  const audiences = parseAudiences(kit?.audiences);
  const hashtagBuckets = parseHashtagBuckets(kit?.hashtags);

  const isEmpty =
    pillars.length === 0 && audiences.length === 0 && hashtagBuckets.every((b) => b.tags.length === 0);

  if (isEmpty) {
    return (
      <EmptySection
        title="Content strategy"
        hint="Pillars (with %), audience tiers, and hashtag buckets."
      />
    );
  }

  return (
    <SectionFrame title="Content strategy">
      <div style={{ display: "grid", gap: "20px" }}>
        {pillars.length > 0 && <PillarBars pillars={pillars} />}
        {audiences.length > 0 && <Audiences audiences={audiences} />}
        {hashtagBuckets.some((b) => b.tags.length > 0) && (
          <HashtagBuckets buckets={hashtagBuckets} />
        )}
      </div>
    </SectionFrame>
  );
}

function PillarBars({ pillars }: { pillars: { name: string; pct: number | null }[] }) {
  const hasPct = pillars.some((p) => typeof p.pct === "number");
  return (
    <div>
      <SubLabel>Content pillars</SubLabel>
      <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
        {pillars.map((p, i) => (
          <div
            key={p.name + i}
            style={{
              display: "grid",
              gridTemplateColumns: hasPct ? "minmax(120px, 220px) 1fr 40px" : "1fr",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "13px", color: VALUE }}>{p.name}</div>
            {hasPct && (
              <>
                <div
                  style={{
                    height: "8px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.04)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, p.pct ?? 0))}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${ACCENT} 0%, rgba(139,92,255,0.6) 100%)`,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                    fontSize: "12px",
                    color: LABEL,
                    textAlign: "right",
                  }}
                >
                  {p.pct != null ? `${p.pct}%` : "—"}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Audiences({
  audiences,
}: {
  audiences: { tier: string | null; description: string | null }[];
}) {
  const tierOrder: Record<string, number> = { primary: 0, secondary: 1, tertiary: 2 };
  const sorted = [...audiences].sort(
    (a, b) =>
      (tierOrder[a.tier?.toLowerCase() ?? ""] ?? 99) -
      (tierOrder[b.tier?.toLowerCase() ?? ""] ?? 99)
  );
  return (
    <div>
      <SubLabel>Audiences</SubLabel>
      <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
        {sorted.map((a, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(100px, 130px) 1fr",
              gap: "16px",
              padding: "12px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: a.tier?.toLowerCase() === "primary" ? ACCENT : LABEL,
                fontWeight: 600,
              }}
            >
              {a.tier ?? "—"}
            </div>
            <div style={{ fontSize: "13px", color: VALUE, lineHeight: 1.5 }}>
              {a.description ?? <span style={{ color: MUTED }}>No description</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HashtagBuckets({
  buckets,
}: {
  buckets: { name: string; tags: string[] }[];
}) {
  return (
    <div>
      <SubLabel>Hashtag library</SubLabel>
      <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
        {buckets
          .filter((b) => b.tags.length > 0)
          .map((b) => (
            <div key={b.name}>
              <div
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: LABEL,
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                {b.name} · {b.tags.length}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {b.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      padding: "3px 9px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      background: "rgba(192,132,252,0.06)",
                      border: "1px solid rgba(192,132,252,0.2)",
                      color: "#d9b4ff",
                      fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                    }}
                  >
                    #{t.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Compliance & locale ────────────────────────────────────────────────

function ComplianceRow({
  brand,
  kit,
}: {
  brand: BrandKitView["brand"];
  kit: BrandKitView["kit"];
}) {
  const footer = kit?.compliance_footer ?? brand.compliance ?? null;
  const hq = kit?.hq_location ?? null;
  const area = kit?.service_area?.length ? kit.service_area.join(", ") : null;
  const status = kit?.onboarding_status ?? null;

  if (!footer && !hq && !area && !status) return null;

  return (
    <SectionFrame title="Compliance & locale">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        {hq && <KeyValueCard label="HQ" entries={[["Location", hq]]} />}
        {area && <KeyValueCard label="Service area" entries={[["Coverage", area]]} />}
        {status && <KeyValueCard label="Onboarding" entries={[["Status", status]]} />}
      </div>
      {footer && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px 16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: LABEL,
              fontWeight: 600,
            }}
          >
            Compliance footer
          </div>
          <p style={{ marginTop: "6px", fontSize: "12px", color: VALUE, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {footer}
          </p>
        </div>
      )}
    </SectionFrame>
  );
}

// ─── Autopilot rules ───────────────────────────────────────────────────

function Rules({ rules }: { rules: AutopilotRule[] }) {
  if (rules.length === 0) return null;
  return (
    <details
      style={{
        background: "rgba(192,132,252,0.04)",
        border: "1px solid rgba(192,132,252,0.18)",
        borderRadius: "12px",
        padding: "14px 18px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: ACCENT,
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>Autopilot rules in force</span>
        <span style={{ color: LABEL, fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>
          {rules.length}
        </span>
      </summary>
      <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: "10px" }}>
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
                background: rule.source === "universal" ? "rgba(192,132,252,0.12)" : "rgba(132,180,252,0.12)",
                color: rule.source === "universal" ? "#d9b4ff" : "#b4d9ff",
                fontSize: "9px",
                fontWeight: 600,
                letterSpacing: "0.08em",
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
    </details>
  );
}

// ─── Operator panel (refresh + edit) ───────────────────────────────────

function OperatorPanel({
  brandId,
  kit,
}: {
  brandId: string;
  kit: BrandKitView["kit"];
}) {
  return (
    <details
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        padding: "14px 18px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: LABEL,
          listStyle: "none",
        }}
      >
        Operator controls — refresh & edit
      </summary>
      <div style={{ marginTop: "14px", display: "grid", gap: "18px" }}>
        <div>
          <RefreshBrandKitButton brandId={brandId} />
          <p style={{ marginTop: "8px", fontSize: "11px", color: MUTED, lineHeight: 1.55 }}>
            Text side (positioning, tone, pillars, hashtags, photography) needs ≥3 approved posts.
            Visual side samples dominant colors from approved post images and adds a Gemini Vision
            typography hint. Nightly cron runs automatically; this button forces it now.
          </p>
        </div>
        <EditBrandKitForm
          brandId={brandId}
          initialArchetype={kit?.archetype ?? null}
          initialIndustry={kit?.industry ?? null}
          initialVisualDonts={kit?.visual_donts ?? null}
          initialColorRoles={
            kit?.colors && typeof kit.colors === "object" && kit.colors !== null && "roles" in kit.colors
              ? ((kit.colors as { roles?: Record<string, string | null> }).roles ?? null)
              : null
          }
          initialWebsiteUrl={kit?.website_url ?? null}
        />
      </div>
    </details>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function SectionFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: LABEL,
          fontWeight: 600,
          marginBottom: "14px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptySection({ title, hint }: { title: string; hint: string }) {
  return (
    <SectionFrame title={title}>
      <div
        style={{
          padding: "20px 18px",
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed rgba(255,255,255,0.08)",
          borderRadius: "12px",
          color: MUTED,
          fontSize: "13px",
          lineHeight: 1.55,
        }}
      >
        Nothing here yet. <span style={{ color: LABEL }}>{hint}</span>
      </div>
    </SectionFrame>
  );
}

function MissingCard({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(255,255,255,0.02)",
        border: "1px dashed rgba(255,255,255,0.08)",
        borderRadius: "10px",
      }}
    >
      <SubLabel>{label}</SubLabel>
      <p style={{ marginTop: "6px", fontSize: "12px", color: MUTED, lineHeight: 1.5 }}>{hint}</p>
    </div>
  );
}

function KeyValueCard({
  label,
  entries,
}: {
  label: string;
  entries: Array<[string, string]>;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "10px",
      }}
    >
      <SubLabel>{label}</SubLabel>
      <div style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ fontSize: "12px", color: VALUE, lineHeight: 1.5 }}>
            <span style={{ color: LABEL }}>{k}: </span>
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "10px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: LABEL,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "4px 11px",
        borderRadius: "999px",
        fontSize: "12px",
        background: "rgba(192,132,252,0.08)",
        border: "1px solid rgba(192,132,252,0.25)",
        color: "#e6cbff",
        textTransform: "capitalize",
      }}
    >
      {children}
    </span>
  );
}

// ─── Data shaping ───────────────────────────────────────────────────────

function collectColors(
  brand: BrandKitView["brand"],
  kit: BrandKitView["kit"]
): { label: string; hex: string }[] {
  const swatches: { label: string; hex: string }[] = [];
  if (brand.color_primary) swatches.push({ label: "Primary", hex: brand.color_primary });
  if (brand.color_secondary) swatches.push({ label: "Secondary", hex: brand.color_secondary });
  if (brand.color_accent) swatches.push({ label: "Accent", hex: brand.color_accent });
  if (kit?.colors && typeof kit.colors === "object") {
    for (const [key, val] of Object.entries(kit.colors)) {
      if (key === "roles") continue;
      if (typeof val === "string" && val.startsWith("#")) {
        if (!swatches.some((s) => s.hex.toLowerCase() === val.toLowerCase())) {
          swatches.push({ label: key, hex: val });
        }
      }
    }
  }
  return swatches;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function parsePillars(
  value: unknown[] | null | undefined
): { name: string; pct: number | null }[] {
  if (!value || value.length === 0) return [];
  const out: { name: string; pct: number | null }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : null;
    const pct = typeof o.pct === "number" ? o.pct : null;
    if (name) out.push({ name, pct });
  }
  return out;
}

function parseAudiences(
  value: unknown[] | null | undefined
): { tier: string | null; description: string | null }[] {
  if (!value || value.length === 0) return [];
  const out: { tier: string | null; description: string | null }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const tier = typeof o.tier === "string" ? o.tier : null;
    const description = typeof o.description === "string" ? o.description : null;
    if (tier || description) out.push({ tier, description });
  }
  return out;
}

function parseHashtagBuckets(
  value: Record<string, unknown> | null | undefined
): { name: string; tags: string[] }[] {
  if (!value || typeof value !== "object") return [];
  const order = ["always_on", "local", "service", "community"];
  const seen = new Set<string>();
  const out: { name: string; tags: string[] }[] = [];
  for (const key of order) {
    if (key in value) {
      seen.add(key);
      const tags = toStringArray(value[key]);
      out.push({ name: prettyKey(key), tags });
    }
  }
  for (const [key, val] of Object.entries(value)) {
    if (seen.has(key)) continue;
    const tags = toStringArray(val);
    if (tags.length > 0) out.push({ name: prettyKey(key), tags });
  }
  return out;
}

function prettyKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
