import BrandKitPanel from "@/components/BrandKitPanel";
import { loadBrandKit } from "@/lib/brand-kit";

/**
 * Brand Kit tab — the full editor (archetype, industry, visual donts,
 * color roles, voice, hashtags, bootstrap-from-URL) already lives in
 * `<BrandKitPanel>`. We pull it out of the brand detail page and host
 * it here so the tab strip is the single navigation surface.
 */
export const dynamic = "force-dynamic";

export default async function BrandKitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const view = await loadBrandKit(slug).catch(() => null);

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

        {view ? (
          <BrandKitPanel view={view} />
        ) : (
          <div
            style={{
              background: "#0f0f1a",
              border: "1px solid #1a1a2e",
              borderRadius: "16px",
              padding: "60px 24px",
              textAlign: "center",
              color: "#7a7a88",
              fontSize: "14px",
            }}
          >
            Brand kit not initialized. Run derivation from the Designs tab or
            via the cron to bootstrap it.
          </div>
        )}
      </div>
    </div>
  );
}
