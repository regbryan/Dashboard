import { supabaseAdmin } from "@/lib/supabase-admin";
import EmptyState from "@/components/EmptyState";

/**
 * Brand Assets — surfaces uploaded logos from `brand_logos`. Acts as a
 * lightweight gallery for now; upload + delete UI lands in a follow-up
 * once we agree on the auth posture for asset mutations.
 *
 * Uses the service-role client (matching lib/brand-kit.ts) so the page
 * is unaffected by RLS on brand_logos. The page is admin-gated
 * upstream by the dashboard layout.
 */
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function logoUrl(path: string | null): string | null {
  if (!path) return null;
  // brand_logos.storage_path already includes the full path inside the
  // post-images bucket (e.g. "logos/blitz/4C.png"). Encode each segment
  // so filenames with spaces or `&` don't break the URL — matches the
  // pattern in /api/brands/[brandId]/logos.
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/post-images/${encoded}`;
}

export default async function BrandAssetsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: logoRows } = await supabaseAdmin()
    .from("brand_logos")
    .select("id, storage_path, label, is_default")
    .eq("brand_id", slug)
    .order("is_default", { ascending: false })
    .order("id", { ascending: true });

  const logos = (logoRows ?? []) as Array<{
    id: number;
    storage_path: string | null;
    label: string | null;
    is_default: boolean;
  }>;

  return (
    <div style={{ padding: "28px 0 48px" }}>
      <div>
        {logos.length === 0 ? (
          <EmptyState>
            No logos uploaded yet. Logos live in the
            <code style={{ padding: "0 4px", color: "#c4b5fd" }}>brand_logos</code>
            table and feed the LogoOverlayPanel on individual posts.
          </EmptyState>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            {logos.map((logo) => {
              const url = logoUrl(logo.storage_path);
              return (
                <div
                  key={logo.id}
                  style={{
                    background: "#0f0f1a",
                    border: `1px solid ${logo.is_default ? "rgba(139,92,255,0.55)" : "#1a1a2e"}`,
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: logo.is_default
                      ? "0 0 0 1px rgba(139,92,255,0.25)"
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      background:
                        "repeating-conic-gradient(#0a0a14 0deg 90deg, #0f0f1a 90deg 180deg) 0 0 / 16px 16px",
                    }}
                  >
                    {url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={url}
                        alt={logo.label ?? "logo"}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          padding: "12px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                          fontSize: "10px",
                          color: "#7a7a88",
                        }}
                      >
                        no file
                      </div>
                    )}
                    {logo.is_default && (
                      <span
                        style={{
                          position: "absolute",
                          left: "8px",
                          top: "8px",
                          padding: "2px 8px",
                          borderRadius: "3px",
                          fontSize: "9px",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "white",
                          background: "rgba(139,92,255,0.92)",
                        }}
                      >
                        ★ Default
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: "11px",
                      color: "#bfbfcc",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {logo.label ?? "Logo"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
