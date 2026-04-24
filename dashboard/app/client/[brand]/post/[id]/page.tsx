import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import ApprovalHistory from "@/components/ApprovalHistory";
import PostImageViewer from "@/components/PostImageViewer";
import ApprovalForm from "./ApprovalForm";

export const dynamic = "force-dynamic";

export default async function ClientPostReviewPage({
  params,
}: {
  params: Promise<{ brand: string; id: string }>;
}) {
  const { brand, id } = await params;

  const { data: post } = await supabase
    .from("posts")
    .select("id, brand_id, post_number, date, day, post_type, content_pillar, concept, caption, hashtags, cta, status, file_path, brands(platform)")
    .eq("id", id)
    .eq("brand_id", brand)
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
        </div>
      </div>
    );
  }

  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, status, comment, created_at")
    .eq("post_id", post.id)
    .order("created_at");

  const imageUrl = getImageUrl(post.brand_id, post.file_path);
  const brandsRel = post.brands as unknown as
    | { platform: string | null }
    | { platform: string | null }[]
    | null;
  const brandPlatform = Array.isArray(brandsRel)
    ? brandsRel[0]?.platform
    : brandsRel?.platform;
  const thumbAspect: "portrait" | "landscape" =
    brandPlatform === "linkedin" ? "landscape" : "portrait";

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ padding: "32px clamp(20px, 4vw, 56px) 64px" }}>
      <div className="mx-auto" style={{ maxWidth: "1200px" }}>
        {/* Back link */}
        <Link
          href={`/client/${brand}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "#9999a6",
            textDecoration: "none",
            marginBottom: "24px",
            transition: "color 0.2s ease",
          }}
        >
          <span>←</span> Back to calendar
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "40px" }}>
          <div>
            <PostImageViewer
              imageUrl={imageUrl}
              alt={post.concept || "Post image"}
              thumbAspect={thumbAspect}
            />
          </div>

          <div className="flex flex-col" style={{ gap: "24px" }}>
            <div>
              <span className="eyebrow" style={{ color: "#c084fc" }}>
                #{post.post_number} · {post.date || "TBD"}
              </span>
              <h1
                className="display-heading"
                style={{ fontSize: "clamp(32px, 4vw, 48px)", marginTop: "10px" }}
              >
                {post.concept || "Untitled Post"}
              </h1>
            </div>

            {post.caption && (
              <div className="surface-card" style={{ padding: "20px" }}>
                <h2 className="eyebrow" style={{ marginBottom: "10px" }}>Copy</h2>
                <div
                  style={{
                    maxHeight: "260px",
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

            <div className="surface-card" style={{ padding: "24px" }}>
              <ApprovalForm postId={post.id} status={post.status} />
            </div>

            {(approvals || []).length > 0 && (
              <div className="surface-card" style={{ padding: "24px" }}>
                <h2 className="eyebrow" style={{ marginBottom: "14px" }}>Approval History</h2>
                <ApprovalHistory approvals={approvals || []} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
