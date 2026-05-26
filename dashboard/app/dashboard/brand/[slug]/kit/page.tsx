import BrandKitPanel from "@/components/BrandKitPanel";
import { loadBrandKit } from "@/lib/brand-kit";
import EmptyState from "@/components/EmptyState";

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
          <EmptyState>
            Brand kit not initialized. Run derivation from the Designs tab or
            via the cron to bootstrap it.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
