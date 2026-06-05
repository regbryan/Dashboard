import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import ApprovalHistory from "@/components/ApprovalHistory";
import SocialPilotStatus from "@/components/SocialPilotStatus";
import ClientReviewLink from "@/components/ClientReviewLink";
import PostImageViewer from "@/components/PostImageViewer";
import Link from "next/link";
import PostActions from "./PostActions";
import StudioTabs from "./StudioTabs";
import GenerateDesignButton from "./GenerateDesignButton";
import { getBrandClientEmails } from "@/lib/brand-clients";
import { buildClaudeRevisionLink } from "@/lib/claude-link";

export const dynamic = "force-dynamic";

/* ── Brand accent ────────────────────────────────────────────────────
   The page themes itself from the brand's color_primary. Brand colors
   range from dark navy/teal to light tan, so we lift each into a band
   that reads on the near-black canvas: a saturated fill (CTA, status
   dot, the rule under the kicker) and a lighter ink (accent text). */
function hexToHsl(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").match(/^([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}

type AccentVars = {
  "--accent": string;
  "--accent-ink": string;
  "--accent-tint": string;
  "--accent-line": string;
};

function brandAccentVars(hex: string | null | undefined): AccentVars {
  const hsl = hex ? hexToHsl(hex) : null;
  if (!hsl) {
    return {
      "--accent": "#cdd1da",
      "--accent-ink": "#e8eaf0",
      "--accent-tint": "rgba(255,255,255,0.07)",
      "--accent-line": "rgba(255,255,255,0.26)",
    };
  }
  const [h, s] = hsl;
  const sat = Math.min(Math.max(s, 0.45), 0.85);
  const satPct = Math.round(sat * 100);
  const inkSatPct = Math.round(Math.min(sat, 0.7) * 100);
  return {
    "--accent": `hsl(${h.toFixed(0)} ${satPct}% 62%)`,
    "--accent-ink": `hsl(${h.toFixed(0)} ${inkSatPct}% 80%)`,
    "--accent-tint": `hsl(${h.toFixed(0)} ${satPct}% 62% / 0.14)`,
    "--accent-line": `hsl(${h.toFixed(0)} ${satPct}% 62% / 0.42)`,
  };
}

/* Status keeps semantic meaning (purple removed). "In review" is the
   one state that keys to the brand accent — it's this brand's post
   awaiting this brand's client. */
type StatusTone = Partial<Record<"--st" | "--st-ink" | "--st-tint" | "--st-line", string>>;
function statusTone(status: string): { label: string; vars: StatusTone } {
  const tone = (h: number, sat = 70): StatusTone => ({
    "--st": `hsl(${h} ${sat}% 60%)`,
    "--st-ink": `hsl(${h} ${Math.min(sat, 55)}% 78%)`,
    "--st-tint": `hsl(${h} ${sat}% 60% / 0.14)`,
    "--st-line": `hsl(${h} ${sat}% 60% / 0.4)`,
  });
  const map: Record<string, { label: string; vars: StatusTone }> = {
    not_started: {
      label: "Approval not started",
      vars: {
        "--st": "hsl(240 6% 62%)",
        "--st-ink": "#c2c4cf",
        "--st-tint": "rgba(255,255,255,0.06)",
        "--st-line": "rgba(255,255,255,0.2)",
      },
    },
    generating: { label: "Generating", vars: tone(43, 90) },
    in_review: { label: "In review", vars: {} /* → brand accent */ },
    changes_requested: { label: "Changes requested", vars: tone(28, 90) },
    approved: { label: "Approved", vars: tone(150, 60) },
    scheduled: { label: "Scheduled", vars: tone(190, 70) },
    posted: { label: "Posted", vars: tone(205, 80) },
  };
  return map[status] ?? { label: status.replace(/_/g, " "), vars: map.not_started.vars };
}

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
      <div className="post-studio" style={brandAccentVars(null) as React.CSSProperties}>
        <div
          className="min-h-[calc(100vh-64px)] flex items-center justify-center"
          style={{ padding: "40px 24px" }}
        >
          <div className="text-center">
            <h1 className="ps-title" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
              Post not found
            </h1>
            <p style={{ marginTop: "12px", color: "var(--ps-ink-3)", fontSize: "14px" }}>
              No post exists with ID &ldquo;{id}&rdquo; for this brand.
            </p>
            <Link
              href={`/dashboard/brand/${slug}`}
              className="ps-btn"
              style={{ marginTop: "20px" }}
            >
              ← Back to brand
            </Link>
          </div>
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

  const accentVars = brandAccentVars(brandData?.color_primary);
  const { label: statusLabel, vars: statusVars } = statusTone(post.status);

  const tags = [post.post_type, post.content_pillar, post.archetype].filter(Boolean) as string[];
  const hasMeta = !!post.hashtags || !!post.cta || tags.length > 0;

  return (
    <div className="post-studio" style={accentVars as React.CSSProperties}>
      <div style={{ padding: "16px 0 56px" }}>
        {/* Breadcrumbs */}
        <nav className="ps-crumbs" aria-label="Breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="ps-crumbs-sep">/</span>
          <Link href={`/dashboard/brand/${slug}`}>{brandData?.name || slug}</Link>
          <span className="ps-crumbs-sep">/</span>
          <span className="ps-crumbs-current">Post #{post.post_number}</span>
        </nav>

        {/* Header — what this post is */}
        <header className="ps-header">
          <div
            className="flex flex-wrap items-end justify-between"
            style={{ gap: "16px" }}
          >
            <div style={{ minWidth: 0 }}>
              <span className="ps-kicker">
                #{post.post_number}
                {post.date ? ` · ${post.date}` : ""}
                {post.day ? ` · ${post.day}` : ""}
              </span>
              <h1 className="ps-title">{post.concept || "Untitled Post"}</h1>
            </div>
            <div className="flex flex-col items-end" style={{ gap: "12px", flexShrink: 0 }}>
              <span
                className="ps-status"
                style={statusVars as React.CSSProperties}
                title={`Status: ${statusLabel}`}
              >
                {statusLabel}
              </span>
              <GenerateDesignButton postId={post.id} hasDesign={!!post.file_path} />
            </div>
          </div>
        </header>

        {/* Three regions: Asset · Content · Workflow */}
        <div className="ps-grid">
          {/* ASSET — the design + the tools that operate on it (pinned) */}
          <div className="ps-rail ps-rise ps-rise-1 flex flex-col" style={{ gap: "20px" }}>
            <div className="ps-asset-mat">
              <PostImageViewer
                imageUrl={imageUrl}
                alt={post.concept || "Post image"}
                thumbAspect={thumbAspect}
              />
            </div>
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
          <div className="ps-rise ps-rise-2 ps-read flex flex-col" style={{ gap: "4px" }}>
            {post.caption && (
              <section>
                <h2 className="ps-label ps-label--strong" style={{ marginBottom: "12px" }}>
                  Caption
                </h2>
                <div className="ps-copy-scroll">
                  <p className="ps-copy">{post.caption}</p>
                </div>
              </section>
            )}

            {post.caption && hasMeta && <hr className="ps-hr" />}

            {hasMeta && (
              <section>
                <dl className="ps-dl">
                  {post.hashtags && (
                    <>
                      <dt>Hashtags</dt>
                      <dd>{post.hashtags}</dd>
                    </>
                  )}
                  {post.cta && (
                    <>
                      <dt>Call to action</dt>
                      <dd>{post.cta}</dd>
                    </>
                  )}
                  {tags.length > 0 && (
                    <>
                      <dt>Details</dt>
                      <dd>
                        <div className="ps-tags">
                          {tags.map((t) => (
                            <span key={t} className="ps-tag">
                              {t}
                            </span>
                          ))}
                        </div>
                      </dd>
                    </>
                  )}
                </dl>
              </section>
            )}
          </div>

          {/* WORKFLOW — act on the post (pinned) */}
          <div className="ps-rail ps-rise ps-rise-3 flex flex-col" style={{ gap: "16px" }}>
            {/* Primary action zone — accent-weighted as the page's job */}
            <div className="ps-panel ps-panel--action">
              <div className="ps-panel-head">
                <h2 className="ps-label ps-label--strong">Actions</h2>
              </div>
              <PostActions
                postId={post.id}
                currentStatus={post.status}
                hasLogo={!!brandData?.logo_path}
                archetype={post.archetype}
              />
            </div>

            {/* Feedback */}
            <div
              className="ps-panel"
              style={
                changeRequested
                  ? {
                      borderColor: "hsl(28 90% 60% / 0.45)",
                      background: "hsl(28 90% 60% / 0.05)",
                    }
                  : undefined
              }
            >
              <div className="ps-panel-head">
                <h2 className="ps-label ps-label--strong">Feedback</h2>
                <span
                  style={{
                    fontSize: "var(--ps-fs-label)",
                    color: "var(--ps-ink-3)",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {approvalList.length === 0
                    ? "no entries"
                    : `${approvalList.length} entr${approvalList.length === 1 ? "y" : "ies"}`}
                </span>
              </div>
              {approvalList.length === 0 ? (
                <p style={{ fontSize: "var(--ps-fs-meta)", color: "var(--ps-ink-3)", margin: 0, lineHeight: 1.55 }}>
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
                  className="ps-btn"
                  style={{ marginTop: "14px", width: "100%" }}
                >
                  Draft revision in Claude →
                </a>
              )}
            </div>

            {/* Share */}
            <ClientReviewLink
              path={`/client/${slug}/post/${post.id}`}
              label="Share with client"
              tone="studio"
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
