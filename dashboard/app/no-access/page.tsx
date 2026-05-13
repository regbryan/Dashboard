import { createSupabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default async function NoAccessPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // If the user actually has access by now (race after sign-in), forward
  // them. If they don't, surface the self-serve onboarding path so they
  // can create their own brand instead of dead-ending here.
  if (user) {
    const { data: access } = await supabaseAdmin()
      .from("user_brand_access")
      .select("brand_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (access?.brand_id) {
      redirect(`/dashboard/brand/${access.brand_id}`);
    }
  }

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
          Set up your brand now to start using the dashboard, or sign out
          and reach out to your account manager if you were expecting
          existing access.
        </p>
        <div
          style={{
            marginTop: "28px",
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link href="/onboarding" className="sp-shiny">
            Set up your brand →
          </Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
