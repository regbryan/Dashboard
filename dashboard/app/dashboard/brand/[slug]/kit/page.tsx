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
    <div style={{ padding: "28px 0 48px" }}>
      <div>
        {view ? (
          <BrandKitPanel view={view} />
        ) : (
          <div
            className="lg-surface--card"
            style={{
              borderRadius: "16px",
              padding: "60px 24px",
              textAlign: "center",
              color: "#7a7a88",
              fontSize: "14px",
              backdropFilter: "blur(10px) saturate(145%)",
              WebkitBackdropFilter: "blur(10px) saturate(145%)",
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
