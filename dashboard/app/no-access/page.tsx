import { createSupabaseServer } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";

export default async function NoAccessPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div
      className="min-h-[calc(100vh-64px)] flex items-center justify-center relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 60% 55% at 50% 50%, #14141e 0%, #0c0a16 55%, #07070e 100%)",
        padding: "40px 24px",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "20%",
          left: "15%",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          background: "#8b5cff",
          opacity: 0.12,
          filter: "blur(100px)",
          pointerEvents: "none",
        }}
      />

      <div
        className="relative w-full text-center"
        style={{
          maxWidth: "520px",
          backgroundColor: "#0f0f1a",
          border: "1px solid rgba(139,92,255,0.2)",
          borderRadius: "20px",
          padding: "48px 40px",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        }}
      >
        <span className="eyebrow" style={{ color: "#c084fc" }}>Access Pending</span>
        <h1
          className="display-heading"
          style={{ fontSize: "clamp(36px, 5vw, 52px)", marginTop: "12px" }}
        >
          No Access <span className="accent">Yet</span>
        </h1>
        <p
          style={{
            marginTop: "18px",
            fontSize: "14px",
            lineHeight: 1.65,
            color: "#bfbfcc",
          }}
        >
          You&apos;re signed in as{" "}
          <span style={{ color: "white", fontWeight: 600 }}>{user?.email}</span>,
          but you don&apos;t have a brand assigned yet.
        </p>
        <p
          style={{
            marginTop: "8px",
            fontSize: "14px",
            lineHeight: 1.65,
            color: "#9999a6",
          }}
        >
          Contact your account manager to get access to your content.
        </p>
        <div style={{ marginTop: "28px" }}>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
