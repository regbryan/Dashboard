"use client";

import { useState } from "react";
import ImageBriefPanel from "@/components/ImageBriefPanel";
import LogoOverlayPanel from "./LogoOverlayPanel";
import FooterOverlayPanel from "./FooterOverlayPanel";

// Groups the three image-bound editors (Image Brief, Logo Overlay, Footer
// Overlay) into a single tabbed panel that lives UNDER the design preview.
// Each editor renders its own image preview, so a tab strip shows exactly one
// at a time instead of stacking three tall previews down the page. Tabs are
// conditionally present: Logo only when the brand has a logo, Footer only when
// the brand has compliance text.

type TabKey = "brief" | "logo" | "footer";

interface StudioTabsProps {
  postId: number;
  brandId: string;
  postImageUrl: string | null;
  thumbAspect: "portrait" | "landscape";
  hasLogo: boolean;
  complianceText: string | null;
  brandColor: string | null;
}

export default function StudioTabs({
  postId,
  brandId,
  postImageUrl,
  thumbAspect,
  hasLogo,
  complianceText,
  brandColor,
}: StudioTabsProps) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: "brief", label: "Image Brief" },
    ...(hasLogo ? [{ key: "logo" as TabKey, label: "Logo" }] : []),
    ...(complianceText?.trim() ? [{ key: "footer" as TabKey, label: "Footer" }] : []),
  ];

  const [active, setActive] = useState<TabKey>("brief");
  const activeKey = tabs.some((t) => t.key === active) ? active : tabs[0].key;

  return (
    <div className="flex flex-col" style={{ gap: "16px" }}>
      <div className="flex items-center" style={{ gap: "8px" }}>
        <h2 className="eyebrow" style={{ margin: 0 }}>Image Tools</h2>
        <span style={{ fontSize: "11px", color: "#9a9aa8" }}>
          edit the design before it ships
        </span>
      </div>

      {tabs.length > 1 && (
        // Segmented control — makes Logo/Footer obviously selectable, and the
        // active tab is shown by fill + border (not color alone).
        <div
          className="flex items-center"
          style={{
            gap: "4px",
            padding: "4px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
          }}
        >
          {tabs.map((t) => {
            const on = t.key === activeKey;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                aria-pressed={on}
                className="studio-tab"
                style={{
                  flex: 1,
                  appearance: "none",
                  cursor: "pointer",
                  padding: "8px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  borderRadius: "7px",
                  color: on ? "var(--accent-ink, #fff)" : "#9a9aa8",
                  background: on ? "var(--accent-tint, rgba(255,255,255,0.08))" : "transparent",
                  border: on
                    ? "1px solid var(--accent-line, rgba(255,255,255,0.3))"
                    : "1px solid transparent",
                  transition: "color 0.15s ease, background 0.15s ease",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div>
        {activeKey === "brief" && <ImageBriefPanel postId={postId} />}
        {activeKey === "logo" && hasLogo && (
          <LogoOverlayPanel
            postId={postId}
            brandId={brandId}
            postImageUrl={postImageUrl}
            thumbAspect={thumbAspect}
          />
        )}
        {activeKey === "footer" && complianceText?.trim() && (
          <FooterOverlayPanel
            postId={postId}
            postImageUrl={postImageUrl}
            thumbAspect={thumbAspect}
            complianceText={complianceText}
            brandColor={brandColor}
          />
        )}
      </div>
    </div>
  );
}
