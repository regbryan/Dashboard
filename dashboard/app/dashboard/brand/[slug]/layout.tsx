import Link from "next/link";
import BrandTabs from "@/components/BrandTabs";
import BrandSectionTitle from "@/components/BrandSectionTitle";
import { getBrand, getBrandPosts, getBrandLogoCount } from "@/lib/brand-data";

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

  // Cached fetchers — getBrand and getBrandPosts dedupe with the
  // Designs and Calendar pages (which also call them) within the same
  // request. Brand Kit and Assets pages don't call getBrandPosts, so
  // those tabs do incur the (small) cost of fetching posts just for
  // the subtitle — accepted because the layout can't know the active
  // tab server-side without pathname access.
  const [brand, posts, logosCount] = await Promise.all([
    getBrand(slug),
    getBrandPosts(slug),
    getBrandLogoCount(slug),
  ]);

  // Distinct Monday-aligned week count for the calendar subtitle.
  const weekStarts = new Set<string>();
  for (const p of posts) {
    if (!p.date) continue;
    const d = new Date(p.date + "T00:00:00Z");
    const dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow);
    weekStarts.add(d.toISOString().slice(0, 10));
  }
  const postsWithDate = posts.filter((p) => p.date).length;

  const subtitles = {
    designs: `${posts.length} post${posts.length === 1 ? "" : "s"} total`,
    calendar:
      postsWithDate === 0
        ? "No scheduled posts yet."
        : `${postsWithDate} post${postsWithDate === 1 ? "" : "s"} across ${weekStarts.size} week${weekStarts.size === 1 ? "" : "s"}`,
    kit: "Voice, colors, archetype, hashtags, and visual rules.",
    assets:
      logosCount === 0
        ? "No logos on file."
        : `${logosCount} logo${logosCount === 1 ? "" : "s"} on file.`,
  };

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
          maxWidth: "1600px",
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
            // Solid bar — no backdrop blur, no glass chrome. Tab pill
            // sits inside this; the bar itself just needs to opaque
            // the content scrolling beneath it.
            background: "#07070e",
          }}
        >
          {/* Header row. Desktop: title pinned left, tabs centered.
              Mobile (<md): stack vertically so the tab pill (~380px) and
              the title don't collide on narrow viewports. */}
          <div className="flex flex-col items-center gap-3 md:relative md:flex-row md:items-center md:justify-center md:gap-0">
            <div className="w-full text-center md:absolute md:left-0 md:top-1/2 md:w-auto md:-translate-y-1/2 md:text-left">
              <BrandSectionTitle slug={slug} subtitles={subtitles} />
            </div>
            <BrandTabs slug={slug} />
          </div>
        </div>

        <div style={{ minHeight: "calc(100vh - 260px)" }}>{children}</div>
      </div>
    </div>
  );
}
