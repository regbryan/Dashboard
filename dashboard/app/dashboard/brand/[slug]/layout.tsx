import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BrandTabs from "@/components/BrandTabs";

/**
 * Per-brand layout. Renders a sticky header (back link + brand name +
 * tab strip) above whichever brand sub-route the user is on. Auth is
 * handled upstream by the dashboard layout; we just fetch the minimum
 * needed for the chrome (name + color).
 */
export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, color_primary, handle")
    .eq("id", slug)
    .single();

  const accentColor = brand?.color_primary || "#8b5cff";

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(7,7,14,0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div
          className="mx-auto"
          style={{
            maxWidth: "1280px",
            padding: "12px clamp(20px, 4vw, 56px) 0",
          }}
        >
          <div
            className="flex flex-wrap items-baseline"
            style={{ gap: "12px", rowGap: "4px", marginBottom: "8px" }}
          >
            <Link
              href="/dashboard"
              style={{
                color: "#9999a6",
                fontSize: "12px",
                textDecoration: "none",
              }}
              title="All brands"
            >
              ←
            </Link>
            <span
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "white",
                letterSpacing: "-0.01em",
              }}
            >
              {brand?.name ?? slug}
            </span>
            {brand?.handle && (
              <span style={{ fontSize: "12px", color: "#7a7a88" }}>
                {brand.handle.startsWith("@") ? brand.handle : `@${brand.handle}`}
              </span>
            )}
          </div>
          <BrandTabs slug={slug} accentColor={accentColor} />
        </div>
      </div>
      {children}
    </>
  );
}
