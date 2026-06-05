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
      <h2 className="eyebrow" style={{ margin: 0 }}>
        Image Tools
      </h2>

      {tabs.length > 1 && (
        <div
          className="flex items-center"
          style={{ gap: "2px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          {tabs.map((t) => {
            const on = t.key === activeKey;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "9px 14px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: on ? "#ffffff" : "#8a8a98",
                  borderBottom: on ? "2px solid #c084fc" : "2px solid transparent",
                  marginBottom: "-1px",
                  transition: "color 0.15s ease",
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
