import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import OnboardingForm from "./OnboardingForm";

/**
 * Self-serve brand onboarding.
 *
 * Lands a signed-in user here when they don't yet have a brand. The
 * form below collects everything we need to provision a brand + kit +
 * user_brand_access row in one go.
 *
 * If the user already owns a brand we redirect them straight to it —
 * onboarding is a one-shot, not a re-runnable wizard.
 */
export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; pending?: string }>;
}) {
  const { paid, pending } = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  // If they already have brand access, send them home. The form is
  // designed for the first-brand case; coming back here later would
  // create a duplicate.
  const { data: existingAccess } = await supabaseAdmin()
    .from("user_brand_access")
    .select("brand_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingAccess?.brand_id) {
    redirect(`/dashboard/brand/${existingAccess.brand_id}`);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        background: "#07070e",
        padding: "40px clamp(16px, 4vw, 56px) 80px",
        overflow: "hidden",
      }}
    >
      {/* Soft violet halo so the page feels premium, not bureaucratic */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(139,92,255,0.14) 0%, rgba(139,92,255,0.04) 30%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="mx-auto"
        style={{ position: "relative", maxWidth: "760px" }}
      >
        <header style={{ marginBottom: "28px" }}>
          {paid && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 14px",
                marginBottom: "16px",
                borderRadius: "999px",
                background: "rgba(126,231,135,0.08)",
                border: "1px solid rgba(126,231,135,0.3)",
                color: "#a7f3c4",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <span style={{ color: "#7ee787", fontWeight: 700 }}>✓</span>
              Payment received — you&apos;re on the{" "}
              <strong style={{ textTransform: "capitalize", color: "white" }}>
                {paid}
              </strong>{" "}
              plan. Let&apos;s set up your brand.
            </div>
          )}
          {pending === "1" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 14px",
                marginBottom: "16px",
                borderRadius: "999px",
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.3)",
                color: "#fbd38d",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <span>⏳</span>
              Stripe&apos;s confirmation is still processing. You can fill out
              the form — we&apos;ll link your payment automatically.
            </div>
          )}
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#c084fc",
              fontWeight: 600,
            }}
          >
            Brand setup · {user.email}
          </div>
          <h1
            style={{
              marginTop: "8px",
              fontSize: "clamp(28px, 4vw, 36px)",
              fontWeight: 600,
              color: "white",
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
            }}
          >
            Tell us about your brand.
          </h1>
          <p
            style={{
              marginTop: "10px",
              fontSize: "15px",
              color: "#9999a6",
              lineHeight: 1.55,
              maxWidth: "560px",
            }}
          >
            We&apos;ll use this to shape every post the autopilot generates
            for you. Fill in what you know now — anything blank can be filled
            in later from the Brand Kit tab.
          </p>
        </header>

        <OnboardingForm />
      </div>
    </div>
  );
}
