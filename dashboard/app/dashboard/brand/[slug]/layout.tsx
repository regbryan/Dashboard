import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BrandTabs, { TAB_CARD_BG } from "@/components/BrandTabs";

/**
 * Per-brand layout. Tabs sit above a rounded content card that the
 * active tab visually flows into. The whole scene sits under a soft
 * violet aurora — a radial glow descending from above plus two faint
 * vertical light streaks — to give the page a premium, atmospheric
 * feel without distracting from content.
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
    <div style={{ position: "relative", isolation: "isolate" }}>
      {/* Atmospheric glow stack — fixed so it stays present on scroll */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: -1,
          overflow: "hidden",
        }}
      >
        {/* Primary downward aurora — broad violet wash from the top */}
        <div
          style={{
            position: "absolute",
            top: "-30%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "120%",
            height: "85%",
            background:
              "radial-gradient(ellipse 50% 60% at 50% 0%, rgba(139,92,255,0.22) 0%, rgba(139,92,255,0.10) 35%, rgba(139,92,255,0.02) 60%, transparent 80%)",
            filter: "blur(6px)",
          }}
        />
        {/* Soft secondary halo for color depth */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "70%",
            height: "55%",
            background:
              "radial-gradient(ellipse 60% 55% at 50% 0%, rgba(177,139,255,0.18) 0%, rgba(120,80,220,0.05) 50%, transparent 75%)",
            filter: "blur(8px)",
          }}
        />
        {/* Vertical light streak — left, tilted slightly inward */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "22%",
            width: "180px",
            height: "70%",
            background:
              "linear-gradient(180deg, rgba(177,139,255,0.12) 0%, rgba(139,92,255,0.06) 30%, transparent 70%)",
            filter: "blur(36px)",
            transform: "rotate(-8deg)",
            transformOrigin: "top center",
          }}
        />
        {/* Vertical light streak — right, mirrored */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: "22%",
            width: "180px",
            height: "70%",
            background:
              "linear-gradient(180deg, rgba(177,139,255,0.12) 0%, rgba(139,92,255,0.06) 30%, transparent 70%)",
            filter: "blur(36px)",
            transform: "rotate(8deg)",
            transformOrigin: "top center",
          }}
        />
        {/* Bottom vignette — pulls the eye toward content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(0,0,0,0.45) 0%, transparent 60%)",
          }}
        />
      </div>

      <div
        className="mx-auto"
        style={{
          maxWidth: "1280px",
          padding: "16px clamp(16px, 3vw, 40px) 64px",
          position: "relative",
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

        {/* Sticky liquid-glass tab bar. The negative inset on each side
            cancels the page-container padding so the glass extends to
            the viewport edges, and the rounded pill inside it floats
            centered. Tab bar follows you down Kit/Calendar/Designs/
            Assets — fits with the SP queue status the operator wants
            visible at all times. */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            marginLeft: "calc(-1 * clamp(16px, 3vw, 40px))",
            marginRight: "calc(-1 * clamp(16px, 3vw, 40px))",
            marginBottom: "28px",
            padding: "14px clamp(16px, 3vw, 40px)",
            backdropFilter: "blur(24px) saturate(150%)",
            WebkitBackdropFilter: "blur(24px) saturate(150%)",
          }}
          className="lg-surface"
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <BrandTabs slug={slug} />
          </div>
        </div>

        <div style={{ minHeight: "calc(100vh - 260px)" }}>{children}</div>
      </div>
    </div>
  );
}
