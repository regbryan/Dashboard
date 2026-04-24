import Link from "next/link";

type SearchParams = Promise<{ reason?: string; desc?: string }>;

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { reason, desc } = await searchParams;

  return (
    <div
      className="min-h-[calc(100vh-64px)] flex items-center justify-center relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 60% 55% at 50% 50%, #14141e 0%, #0c0a16 55%, #07070e 100%)",
        padding: "40px 24px",
      }}
    >
      <div
        className="relative w-full text-center"
        style={{
          maxWidth: "480px",
          backgroundColor: "#0f0f1a",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "20px",
          padding: "48px 36px",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        }}
      >
        <span className="eyebrow" style={{ color: "#fbb27a" }}>Error</span>
        <h1
          className="display-heading"
          style={{ fontSize: "clamp(32px, 5vw, 44px)", marginTop: "12px" }}
        >
          Sign-in <span className="accent">Failed</span>
        </h1>
        <p
          style={{
            marginTop: "16px",
            fontSize: "14px",
            color: "#9999a6",
            lineHeight: 1.6,
          }}
        >
          Something went wrong during authentication. Please try again.
        </p>

        {(reason || desc) && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px 14px",
              borderRadius: "10px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              textAlign: "left",
            }}
          >
            {reason && (
              <p style={{ fontSize: "11px", fontFamily: "monospace", color: "#fca5a5" }}>
                <span style={{ fontWeight: 600 }}>reason:</span> {reason}
              </p>
            )}
            {desc && (
              <p
                style={{
                  marginTop: "4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "#fda4af",
                  wordBreak: "break-all",
                }}
              >
                <span style={{ fontWeight: 600 }}>detail:</span> {desc}
              </p>
            )}
          </div>
        )}

        <Link
          href="/login"
          className="sp-shiny"
          style={{ marginTop: "28px", textDecoration: "none" }}
        >
          <span className="sp-shiny__label">Back to sign in</span>
        </Link>
      </div>
    </div>
  );
}
