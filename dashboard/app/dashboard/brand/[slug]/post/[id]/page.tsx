import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import StatusBadge from "@/components/StatusBadge";
import ApprovalHistory from "@/components/ApprovalHistory";
import SocialPilotStatus from "@/components/SocialPilotStatus";
import ClientReviewLink from "@/components/ClientReviewLink";
import PostImageViewer from "@/components/PostImageViewer";
import Link from "next/link";
import PostActions from "./PostActions";
import LogoOverlayPanel from "./LogoOverlayPanel";
import FooterOverlayPanel from "./FooterOverlayPanel";
import ImageBriefPanel from "@/components/ImageBriefPanel";
import { getBrandClientEmails } from "@/lib/brand-clients";
import { buildClaudeRevisionLink } from "@/lib/claude-link";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const { data: post } = await supabase
    .from("posts")
    .select("*, brands(name, folder_path, logo_path, platform, compliance)")
    .eq("id", id)
    .eq("brand_id", slug)
    .single();

  if (!post) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center" style={{ padding: "40px 24px" }}>
        <div className="text-center">
          <h1 className="display-heading" style={{ fontSize: "clamp(36px, 5vw, 48px)" }}>
            Post <span className="accent">not found</span>
          </h1>
          <p style={{ marginTop: "12px", color: "#9999a6", fontSize: "14px" }}>
            No post exists with ID &ldquo;{id}&rdquo; for this brand.
          </p>
          <Link
            href={`/dashboard/brand/${slug}`}
            style={{ marginTop: "20px", display: "inline-block", color: "#c084fc", fontSize: "13px", textDecoration: "none" }}
          >
            ← Back to brand
          </Link>
        </div>
      </div>
    );
  }

  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, status, comment, created_at")
    .eq("post_id", post.id)
    .order("created_at");

  const brandData = post.brands as {
    name: string;
    folder_path: string;
    logo_path: string | null;
    platform: string | null;
    compliance: string | null;
  } | null;
  const imageUrl = getImageUrl(post.brand_id, post.file_path, post.updated_at);
  const clientEmails = await getBrandClientEmails(post.brand_id).catch(() => []);
  const thumbAspect: "portrait" | "landscape" =
    brandData?.platform === "linkedin" ? "landscape" : "portrait";

  const crumbStyle: React.CSSProperties = {
    color: "#9999a6",
    textDecoration: "none",
    transition: "color 0.2s ease",
  };

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ padding: "32px clamp(20px, 4vw, 56px) 64px" }}>
      <div className="mx-auto" style={{ maxWidth: "1600px" }}>
        {/* Breadcrumbs */}
        <nav
          className="flex items-center flex-wrap"
          style={{ gap: "8px", fontSize: "13px", marginBottom: "24px" }}
        >
          <Link href="/dashboard" style={crumbStyle}>Dashboard</Link>
          <span style={{ color: "#4a4a55" }}>/</span>
          <Link href={`/dashboard/brand/${slug}`} style={crumbStyle}>
            {brandData?.name || slug}
          </Link>
          <span style={{ color: "#4a4a55" }}>/</span>
          <span style={{ color: "white" }}>Post #{post.post_number}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-start" style={{ gap: "40px" }}>
          {/* LEFT: the post itself — image, identity, copy, details */}
          <div className="flex flex-col" style={{ gap: "20px" }}>
            <PostImageViewer
              imageUrl={imageUrl}
              alt={post.concept || "Post image"}
              thumbAspect={thumbAspect}
            />
            <div>
              <span className="eyebrow" style={{ color: "#c084fc" }}>
                #{post.post_number}
                {post.date ? ` · ${post.date}` : ""}
                {post.day ? ` · ${post.day}` : ""}
              </span>
              <h1
                className="display-heading"
                style={{ fontSize: "clamp(32px, 4vw, 48px)", marginTop: "8px" }}
              >
                {post.concept || "Untitled Post"}
              </h1>
              <div style={{ marginTop: "14px" }}>
                <StatusBadge status={post.status} />
              </div>
            </div>

            {post.caption && (
              <div className="surface-card" style={{ padding: "20px" }}>
                <h2 className="eyebrow" style={{ marginBottom: "10px" }}>Copy</h2>
                <div
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    fontSize: "14px",
                    color: "#bfbfcc",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                  }}
                >
                  {post.caption}
                </div>
              </div>
            )}

            {post.hashtags && (
              <div className="surface-card" style={{ padding: "20px" }}>
                <h2 className="eyebrow" style={{ marginBottom: "10px" }}>Hashtags</h2>
                <p style={{ fontSize: "13px", color: "#bfbfcc", lineHeight: 1.6 }}>{post.hashtags}</p>
              </div>
            )}

            {post.cta && (
              <div className="surface-card" style={{ padding: "20px" }}>
                <h2 className="eyebrow" style={{ marginBottom: "10px" }}>CTA</h2>
                <p style={{ fontSize: "14px", color: "#bfbfcc", lineHeight: 1.6 }}>{post.cta}</p>
              </div>
            )}

            <div className="surface-card" style={{ padding: "20px" }}>
              <h2 className="eyebrow" style={{ marginBottom: "12px" }}>Details</h2>
              <div className="flex flex-wrap" style={{ gap: "6px" }}>
                {post.post_type && <MetaChip>{post.post_type}</MetaChip>}
                {post.content_pillar && <MetaChip>{post.content_pillar}</MetaChip>}
                {post.archetype && <MetaChip>{post.archetype}</MetaChip>}
              </div>
            </div>
          </div>

          {/* RIGHT: workflow — review, actions, generation tools, sharing */}
          <div className="flex flex-col" style={{ gap: "20px" }}>
            <div
              className="surface-card"
              style={{
                padding: "24px",
                ...(((approvals || []).filter(
                  (a) => a.status === "changes_requested"
                ).length > 0)
                  ? {
                      borderColor: "rgba(251,178,122,0.45)",
                      background: "rgba(251,178,122,0.04)",
                    }
                  : {}),
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: "14px", gap: "12px" }}
              >
                <h2 className="eyebrow" style={{ margin: 0 }}>
                  Feedback
                </h2>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#9999a6",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {(approvals || []).length === 0
                    ? "no entries"
                    : `${(approvals || []).length} entr${
                        (approvals || []).length === 1 ? "y" : "ies"
                      }`}
                </span>
              </div>
              {(approvals || []).length === 0 ? (
                <p style={{ fontSize: "13px", color: "#8a8a98", margin: 0 }}>
                  No feedback yet. Use the action panel below to leave a note,
                  or share the post with the client for them to review.
                </p>
              ) : (
                <ApprovalHistory approvals={approvals || []} />
              )}
              {post.socialpilot_queue_status && (
                <div style={{ marginTop: 16 }}>
                  <SocialPilotStatus
                    postId={post.id}
                    status={post.socialpilot_queue_status}
                    socialpilotPostId={post.socialpilot_post_id ?? null}
                    error={post.socialpilot_error ?? null}
                    queuedAt={post.socialpilot_queued_at ?? null}
                    retryCount={post.socialpilot_retry_count ?? 0}
                    isAdmin={true}
                  />
                </div>
              )}
              {(() => {
                const lastChangeRequest = (approvals || [])
                  .filter((a) => a.status === "changes_requested")
                  .slice(-1)[0];
                if (!lastChangeRequest) return null;
                const claudeUrl = buildClaudeRevisionLink({
                  brandName: brandData?.name ?? post.brand_id,
                  postNumber: post.post_number,
                  concept: post.concept,
                  postType: post.post_type,
                  date: post.date,
                  caption: post.caption,
                  hashtags: post.hashtags,
                  cta: post.cta,
                  visualDirection: post.visual_direction,
                  assetUrl: imageUrl,
                  clientComment: lastChangeRequest.comment,
                });
                return (
                  <a
                    href={claudeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: "16px",
                      padding: "10px 16px",
                      background: "rgba(192,132,252,0.12)",
                      border: "1px solid rgba(192,132,252,0.4)",
                      borderRadius: "8px",
                      color: "#e9d5ff",
                      fontSize: "13px",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    Draft revision in Claude →
                  </a>
                );
              })()}
            </div>

            <div className="surface-card" style={{ padding: "24px" }}>
              <h2 className="eyebrow" style={{ marginBottom: "14px" }}>Actions</h2>
              <PostActions
                postId={post.id}
                currentStatus={post.status}
                hasLogo={!!brandData?.logo_path}
                archetype={post.archetype}
              />
            </div>

            <ClientReviewLink
              path={`/client/${slug}/post/${post.id}`}
              label="Share this post with client"
              emailSubject={`${brandData?.name || "Your brand"}: Post #${post.post_number} ready for review`}
              emailBody={`Hi,\n\nPost #${post.post_number} (${post.concept || "Untitled"}) is ready for your review. Tap the link below to approve or request changes:\n\n`}
              to={clientEmails}
              postId={post.id}
            />
          </div>
        </div>

        {/* Generation & overlay tools — full width, two-up so they don't
            stack into one endless column under the post. */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 lg:items-start"
          style={{ gap: "20px", marginTop: "40px" }}
        >
          <ImageBriefPanel postId={post.id} />

          {brandData?.logo_path && (
            <LogoOverlayPanel
              postId={post.id}
              brandId={post.brand_id}
              postImageUrl={imageUrl}
              thumbAspect={thumbAspect}
            />
          )}

          {brandData?.compliance && (
            <FooterOverlayPanel
              postId={post.id}
              postImageUrl={imageUrl}
              thumbAspect={thumbAspect}
              complianceText={brandData.compliance}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.04em",
        background: "rgba(255,255,255,0.04)",
        color: "#bfbfcc",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {children}
    </span>
  );
}
