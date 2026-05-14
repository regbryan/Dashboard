"use client";

import { useState } from "react";

/**
 * Button that opens the Stripe Customer Portal. Stripe hosts the
 * portal — manage payment method, view invoices, cancel subscription,
 * change tier — all without us building UI.
 *
 * POSTs to /api/stripe/portal which returns { url } pointing at the
 * portal session for this user's brand. Browser redirects there.
 *
 * Hidden entirely if the brand has no stripe_customer_id (e.g. manually
 * provisioned brands pre-Stripe). Caller decides whether to render
 * this component.
 */
export default function ManageBillingButton({
  brandId,
  variant = "secondary",
}: {
  brandId?: string;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = brandId
        ? `/api/stripe/portal?brand=${encodeURIComponent(brandId)}`
        : "/api/stripe/portal";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data?.error || `Billing portal unavailable (${res.status}).`);
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed.");
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "6px" }}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={
          variant === "primary"
            ? "sp-shiny"
            : "sp-shiny sp-shiny--secondary"
        }
        style={{ cursor: busy ? "wait" : "pointer" }}
      >
        {busy ? "Opening portal…" : "Manage billing →"}
      </button>
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: "11px",
            color: "rgb(252, 165, 165)",
            lineHeight: 1.4,
            maxWidth: "320px",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
