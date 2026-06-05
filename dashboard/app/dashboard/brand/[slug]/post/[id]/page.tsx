import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import StatusBadge from "@/components/StatusBadge";
import ApprovalHistory from "@/components/ApprovalHistory";
import SocialPilotStatus from "@/components/SocialPilotStatus";
import ClientReviewLink from "@/components/ClientReviewLink";
import PostImageViewer from "@/components/PostImageViewer";
import Link from "next/link";
import PostActions from "./PostActions";
import StudioTabs from "./StudioTabs";
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
    .select("*, brands(name, folder_path, logo_path, platform, compliance, color_primary)")
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
    color_primary: string | null;
  } | null;
  const imageUrl = getImageUrl(post.brand_id, post.file_path, post.updated_at);
  const clientEmails = await getBrandClientEmails(post.brand_id).catch(() => []);
  const thumbAspect: "portrait" | "landscape" =
    brandData?.platform === "linkedin" ? "landscape" : "portrait";

  const approvalList = approvals || [];
  const changeRequested =
    approvalList.filter((a) => a.status === "changes_requested").length > 0;
  const lastChangeRequest = approvalList
    .filter((a) => a.status === "changes_requested")
    .slice(-1)[0];

  const crumbStyle: React.CSSProperties = {
    color: "#9999a6",
    textDecoration: "none",
    transition: "color 0.2s ease",
  };
  const subLabel: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#8a8a98",
    margin: 0,
  };
  const dividerTop: React.CSSProperties = {
    borderTop: "1px solid rgba(255,255,255,0.06)",
    paddingTop: "16px",
  };

  const hasMeta =
    !!post.hashtags || !!post.cta || !!post.post_type || !!post.content_pillar || !!post.archetype;

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ padding: "16px 0 48px" }}>
      <div style={{ maxWidth: "100%" }}>
        {/* Breadcrumbs */}
        <nav
          className="flex items-center flex-wrap"
          style={{ gap: "8px", fontSize: "13px", marginBottom: "20px" }}
        >
          <Link href="/dashboard" style={crumbStyle}>Dashboard</Link>
          <span style={{ color: "#4a4a55" }}>/</span>
          <Link href={`/dashboard/brand/${slug}`} style={crumbStyle}>
            {brandData?.name || slug}
          </Link>
          <span style={{ color: "#4a4a55" }}>/</span>
          <span style={{ color: "white" }}>Post #{post.post_number}</span>
        </nav>

        {/* Header band — what this post is (full width) */}
        <div
          className="flex flex-wrap items-start justify-between"
          style={{
            gap: "16px",
            paddingBottom: "24px",
            marginBottom: "32px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow" style={{ color: "#c084fc" }}>
              #{post.post_number}
              {post.date ? ` · ${post.date}` : ""}
              {post.day ? ` · ${post.day}` : ""}
            </span>
            <h1
              className="display-heading"
              style={{ fontSize: "clamp(30px, 3.4vw, 46px)", marginTop: "8px" }}
            >
              {post.concept || "Untitled Post"}
            </h1>
          </div>
          <div style={{ flexShrink: 0, marginTop: "6px" }}>
            <StatusBadge status={post.status} />
          </div>
        </div>

        {/* Three regions: Asset · Content · Workflow */}
        <div className="post-detail-grid">
          {/* ASSET — the design + the tools that operate on it (pinned) */}
          <div className="flex flex-col post-detail-aside" style={{ gap: "24px" }}>
            <PostImageViewer
              imageUrl={imageUrl}
              alt={post.concept || "Post image"}
              thumbAspect={thumbAspect}
            />
            <StudioTabs
              postId={post.id}
              brandId={post.brand_id}
              postImageUrl={imageUrl}
              thumbAspect={thumbAspect}
              hasLogo={!!brandData?.logo_path}
              complianceText={brandData?.compliance ?? null}
              brandColor={brandData?.color_primary ?? null}
            />
          </div>

          {/* CONTENT — read the post */}
          <div className="flex flex-col" style={{ gap: "20px" }}>
            {post.caption && (
              <div className="surface-card" style={{ padding: "20px" }}>
                <h2 className="eyebrow" style={{ marginBottom: "10px" }}>Copy</h2>
                <div
                  style={{
                    maxHeight: "360px",
                    overflowY: "auto",
                    fontSize: "15px",
                    color: "#bfbfcc",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.65,
                  }}
                >
                  {post.caption}
                </div>
              </div>
            )}

            {hasMeta && (
              <div className="surface-card flex flex-col" style={{ padding: "20px", gap: "16px" }}>
                {post.hashtags && (
                  <div>
                    <h3 style={subLabel}>Hashtags</h3>
                    <p style={{ fontSize: "13px", color: "#bfbfcc", lineHeight: 1.6, margin: "8px 0 0" }}>
                      {post.hashtags}
                    </p>
                  </div>
                )}
                {post.cta && (
                  <div style={post.hashtags ? dividerTop : undefined}>
                    <h3 style={subLabel}>CTA</h3>
                    <p style={{ fontSize: "14px", color: "#bfbfcc", lineHeight: 1.6, margin: "8px 0 0" }}>
                      {post.cta}
                    </p>
                  </div>
                )}
                {(post.post_type || post.content_pillar || post.archetype) && (
                  <div style={post.hashtags || post.cta ? dividerTop : undefined}>
                    <h3 style={subLabel}>Details</h3>
                    <div className="flex flex-wrap" style={{ gap: "6px", marginTop: "10px" }}>
                      {post.post_type && <MetaChip>{post.post_type}</MetaChip>}
                      {post.content_pillar && <MetaChip>{post.content_pillar}</MetaChip>}
                      {post.archetype && <MetaChip>{post.archetype}</MetaChip>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* WORKFLOW — act on the post (pinned) */}
          <div className="flex flex-col post-detail-aside" style={{ gap: "20px" }}>
            {/* Primary action zone — accented so it's clearly the page's job */}
            <div
              className="surface-card"
              style={{
                padding: "24px",
                borderColor: "rgba(192,132,252,0.35)",
                background: "rgba(192,132,252,0.05)",
              }}
            >
              <h2 className="eyebrow" style={{ marginBottom: "14px", color: "#c9a8ff" }}>Actions</h2>
              <PostActions
                postId={post.id}
                currentStatus={post.status}
                hasLogo={!!brandData?.logo_path}
                archetype={post.archetype}
              />
            </div>

            <div
              className="surface-card"
              style={{
                padding: "24px",
                ...(changeRequested
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
                <h2 className="eyebrow" style={{ margin: 0 }}>Feedback</h2>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#9999a6",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {approvalList.length === 0
                    ? "no entries"
                    : `${approvalList.length} entr${approvalList.length === 1 ? "y" : "ies"}`}
                </span>
              </div>
              {approvalList.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#8a8a98", margin: 0 }}>
                  No feedback yet. Use the actions above to leave a note, or share
                  the post with the client for them to review.
                </p>
              ) : (
                <ApprovalHistory approvals={approvalList} />
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
              {lastChangeRequest && (
                <a
                  href={buildClaudeRevisionLink({
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
                  })}
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
              )}
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
