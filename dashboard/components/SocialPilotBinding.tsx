"use client";

import { useEffect, useState } from "react";

/**
 * Brand → SocialPilot account binding. Renders in the operator panel
 * of BrandKitPanel for Growth-tier brands.
 *
 * States:
 *   - SP not configured globally   → "Connect SocialPilot" CTA (admin-only)
 *   - SP configured, brand unbound → dropdown of available SP profiles
 *   - SP configured, brand bound   → "Bound to X (change / unbind)"
 *   - Refresh token dead           → "Reconnect" banner
 *
 * Visible only when the brand is on the Growth tier — caller gates it.
 */

type SpAccount = { id: string; name: string; type: string; picture?: string };

type AccountsResponse =
  | { accounts: SpAccount[]; configured: true }
  | { accounts: []; configured: false }
  | { error: string; reconnect_required?: boolean };

type Props = {
  brandId: string;
  initialAccountId: string | null;
};

export default function SocialPilotBinding({ brandId, initialAccountId }: Props) {
  const [accounts, setAccounts] = useState<SpAccount[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [reconnectRequired, setReconnectRequired] = useState(false);
  const [boundId, setBoundId] = useState<string | null>(initialAccountId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/socialpilot/accounts");
        const data = (await res.json()) as AccountsResponse;
        if (cancelled) return;
        if (!res.ok || "error" in data) {
          if ("error" in data && data.reconnect_required) {
            setReconnectRequired(true);
            setConfigured(true);
            setAccounts([]);
          } else {
            setError(("error" in data && data.error) || "load_failed");
          }
          return;
        }
        setAccounts(data.accounts);
        setConfigured(data.configured);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (newId: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/socialpilot`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ socialpilot_account_id: newId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "save_failed");
      setBoundId(newId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Shell><span style={muted}>Loading SocialPilot binding…</span></Shell>;
  }

  if (configured === false) {
    return (
      <Shell>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ ...muted, margin: 0 }}>
            SocialPilot isn&apos;t connected to the agency account yet. Approved
            posts will not auto-queue until an admin runs the one-time OAuth
            bootstrap.
          </p>
          <a href="/api/socialpilot/connect" style={cta}>
            Connect SocialPilot →
          </a>
        </div>
      </Shell>
    );
  }

  if (reconnectRequired) {
    return (
      <Shell>
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ ...muted, margin: 0, color: "#fca5a5" }}>
            SocialPilot refresh token expired. Reconnect to resume auto-queueing.
          </p>
          <a href="/api/socialpilot/connect" style={cta}>
            Reconnect SocialPilot →
          </a>
        </div>
      </Shell>
    );
  }

  const boundAccount = accounts?.find((a) => a.id === boundId);

  return (
    <Shell>
      <div style={{ display: "grid", gap: 8 }}>
        {boundAccount ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ ...muted, margin: 0 }}>Bound to</span>
            <strong style={{ color: "#dcdce4" }}>
              {boundAccount.name}
            </strong>
            <span
              style={{
                fontSize: 11,
                color: "#9999a6",
                textTransform: "capitalize",
              }}
            >
              {boundAccount.type}
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(null)}
              style={linkButton}
            >
              unbind
            </button>
          </div>
        ) : (
          <p style={{ ...muted, margin: 0 }}>
            No SocialPilot profile bound — approved posts won&apos;t auto-queue.
          </p>
        )}
        <select
          value={boundId ?? ""}
          disabled={saving}
          onChange={(e) => save(e.target.value || null)}
          style={selectStyle}
        >
          <option value="">— Select a SocialPilot profile —</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.type})
            </option>
          ))}
        </select>
        {error && (
          <p role="alert" style={{ ...muted, color: "#fca5a5", margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="lg-chip"
      style={{
        borderRadius: 10,
        padding: "12px 14px",
        backdropFilter: "blur(12px) saturate(150%)",
        WebkitBackdropFilter: "blur(12px) saturate(150%)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#9999a6",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        SocialPilot publishing
      </div>
      {children}
    </div>
  );
}

const muted: React.CSSProperties = {
  fontSize: 12,
  color: "#9999a6",
  lineHeight: 1.5,
};

const cta: React.CSSProperties = {
  display: "inline-block",
  alignSelf: "start",
  background: "rgba(192,132,252,0.12)",
  border: "1px solid rgba(192,132,252,0.35)",
  color: "#c084fc",
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 500,
  textDecoration: "none",
};

const linkButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#9999a6",
  fontSize: 11,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
};

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "white",
  fontSize: 13,
  width: "100%",
};
