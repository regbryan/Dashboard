/**
 * Brand Kit panel — placeholder. The full editor (archetype, industry,
 * visual donts, color roles, voice, hashtags, bootstrap-from-URL) lives
 * on the `claude/eloquent-euclid-baa74d` branch and will land here once
 * merged.
 */
export const dynamic = "force-dynamic";

export default async function BrandKitPage() {
  return (
    <div
      className="min-h-[calc(100vh-64px)]"
      style={{ padding: "24px clamp(20px, 4vw, 56px) 64px" }}
    >
      <div className="mx-auto" style={{ maxWidth: "1280px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "white",
              letterSpacing: "-0.01em",
            }}
          >
            Brand Kit
          </h2>
          <p style={{ marginTop: "4px", color: "#9999a6", fontSize: "13px" }}>
            Voice, colors, archetype, hashtags, and visual rules that shape
            every generated post.
          </p>
        </div>
        <div
          style={{
            background: "#0f0f1a",
            border: "1px solid rgba(139,92,255,0.35)",
            borderRadius: "16px",
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 12px",
              borderRadius: "999px",
              border: "1px solid rgba(139,92,255,0.35)",
              backgroundColor: "rgba(139,92,255,0.08)",
              color: "#b18bff",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor: "#8b5cff",
              }}
            />
            Coming soon
          </span>
          <p
            style={{
              marginTop: "16px",
              color: "#9999a6",
              fontSize: "14px",
              maxWidth: "440px",
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.6,
            }}
          >
            The brand kit editor is being wired in from a parallel branch.
            Until then, brand voice / palette / archetype live in the
            <code style={{ padding: "0 4px", color: "#c4b5fd" }}>brand_kits</code>
            table and are picked up automatically by the autopilot pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}
