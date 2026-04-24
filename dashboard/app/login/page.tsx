"use client";

import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const next = searchParams.get("next") || "/dashboard";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 60% 55% at 50% 50%, #23233a 0%, #121220 55%, #07070e 100%)",
        padding: "40px 24px",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "18%",
          left: "12%",
          width: "320px",
          height: "320px",
          borderRadius: "50%",
          background: "#8b5cff",
          opacity: 0.18,
          filter: "blur(110px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "12%",
          right: "12%",
          width: "320px",
          height: "320px",
          borderRadius: "50%",
          background: "#3b81ff",
          opacity: 0.18,
          filter: "blur(110px)",
          pointerEvents: "none",
        }}
      />

      <div
        className="relative w-full"
        style={{
          maxWidth: "440px",
          backgroundColor: "#0f0f1a",
          border: "1px solid rgba(139,92,255,0.25)",
          borderRadius: "20px",
          padding: "44px 36px",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55), 0 0 40px rgba(139,92,255,0.08)",
        }}
      >
        <div className="text-center" style={{ marginBottom: "32px" }}>
          <span className="eyebrow" style={{ color: "#c084fc" }}>
            Client Portal
          </span>
          <h1
            className="display-heading"
            style={{ fontSize: "clamp(36px, 5vw, 48px)", marginTop: "12px" }}
          >
            Welcome <span className="accent">Back</span>
          </h1>
          <p
            style={{
              marginTop: "12px",
              fontSize: "14px",
              color: "#9999a6",
              lineHeight: 1.55,
            }}
          >
            Sign in with Google to review and approve your content.
          </p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center transition"
          style={{
            gap: "12px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "12px",
            padding: "14px 20px",
            fontSize: "14px",
            fontWeight: 500,
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(139,92,255,0.5)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>

        {error && (
          <p style={{ marginTop: "16px", fontSize: "13px", color: "#ff8a8a", textAlign: "center" }}>
            {error}
          </p>
        )}

        <p
          style={{
            marginTop: "28px",
            fontSize: "12px",
            color: "#6f6f7e",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          First time? We&apos;ll create your account automatically.
          Contact your account manager if you don&apos;t have access yet.
        </p>
      </div>
    </div>
  );
}
