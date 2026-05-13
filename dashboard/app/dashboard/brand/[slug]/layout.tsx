import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BrandTabs, { TAB_CARD_BG } from "@/components/BrandTabs";

/**
 * Per-brand layout. Tabs sit above a rounded content card that the
 * active tab visually flows into — premium folder feel. Auth is
 * handled upstream; we only fetch what the header needs.
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
    .select("id, name, handle")
    .eq("id", slug)
    .single();

  return (
    <div
      className="mx-auto"
      style={{
        maxWidth: "1280px",
        padding: "16px clamp(16px, 3vw, 40px) 64px",
      }}
    >
      <div
        className="flex flex-wrap items-baseline"
        style={{
          gap: "12px",
          rowGap: "4px",
          marginBottom: "20px",
          padding: "0 8px",
        }}
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
          ← All brands
        </Link>
        <span style={{ color: "#3a3a45" }}>·</span>
        <span
          style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "white",
            letterSpacing: "-0.015em",
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

      <BrandTabs slug={slug} />

      <div
        style={{
          background: TAB_CARD_BG,
          borderRadius: "20px",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.6)",
          overflow: "hidden",
          minHeight: "calc(100vh - 220px)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
