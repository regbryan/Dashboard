"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ClientReviewLinkProps {
  path: string;
  label?: string;
  emailSubject?: string;
  emailBody?: string;
  to?: string[];
  brandId?: string;
  postId?: string;
}

export default function ClientReviewLink({
  path,
  label = "Client Review Link",
  emailSubject = "Your content is ready for review",
  emailBody = "Hi,\n\nYour content is ready for review. Please use the link below to approve or request changes:\n\n",
  to = [],
  brandId,
  postId,
}: ClientReviewLinkProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [marked, setMarked] = useState<number | null>(null);

  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function markInReview() {
    if (!brandId && !postId) return;
    try {
      const res = await fetch("/api/posts/mark-in-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postId ? { postId } : { brandId }),
      });
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      const updated = body?.updated ?? 0;
      setMarked(updated);
      // Refresh server components so status badges reflect new state.
      router.refresh();
    } catch {
      // Non-blocking — share still works.
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", fullUrl);
    }
    void markInReview();
  }

  const recipients = to.join(",");
  const fullBody = emailBody + fullUrl;

  const mailtoHref = `mailto:${encodeURIComponent(
    recipients
  )}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(
    fullBody
  )}`;

  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1${
    recipients ? `&to=${encodeURIComponent(recipients)}` : ""
  }&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(fullBody)}`;

  return (
    <div
      className="surface-card flex flex-col"
      style={{ padding: "18px 20px", gap: "12px", borderRadius: "14px" }}
    >
      <div className="flex items-center justify-between" style={{ gap: "12px" }}>
        <h2 className="eyebrow">{label}</h2>
        {to.length > 0 && (
          <span
            style={{
              fontSize: "11px",
              color: "#9999a6",
              fontFamily: "var(--font-mono, monospace)",
            }}
            title={to.join(", ")}
          >
            → {to.length === 1 ? to[0] : `${to.length} recipients`}
          </span>
        )}
      </div>

      <div className="flex" style={{ gap: "8px" }}>
        <input
          type="text"
          value={fullUrl}
          readOnly
          onFocus={(e) => e.target.select()}
          className="sp-input"
          style={{ flex: 1, fontSize: "13px" }}
        />
        <button
          onClick={handleCopy}
          style={{
            padding: "10px 14px",
            background: "white",
            color: "#07070e",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "10px",
            border: "1px solid white",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.2s ease",
          }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="flex flex-wrap" style={{ gap: "8px" }}>
        <a
          href={mailtoHref}
          onClick={() => void markInReview()}
          style={{
            padding: "8px 14px",
            background: "rgba(139,92,255,0.12)",
            color: "#e9d5ff",
            fontSize: "12px",
            fontWeight: 500,
            borderRadius: "999px",
            border: "1px solid rgba(139,92,255,0.35)",
            textDecoration: "none",
            transition: "background 0.2s ease",
          }}
        >
          ✉ Email Client{to.length === 0 ? " (no recipient)" : ""}
        </a>
        <a
          href={gmailHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void markInReview()}
          style={{
            padding: "8px 14px",
            background: "rgba(220,80,80,0.12)",
            color: "#fecaca",
            fontSize: "12px",
            fontWeight: 500,
            borderRadius: "999px",
            border: "1px solid rgba(220,80,80,0.35)",
            textDecoration: "none",
            transition: "background 0.2s ease",
          }}
        >
          ✉ Open in Gmail
        </a>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "8px 14px",
            background: "transparent",
            color: "#bfbfcc",
            fontSize: "12px",
            fontWeight: 500,
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.12)",
            textDecoration: "none",
            transition: "background 0.2s ease",
          }}
        >
          ↗ Open
        </a>
      </div>

      {marked !== null && (
        <p
          style={{
            fontSize: "11px",
            color: marked > 0 ? "#86efac" : "#9999a6",
            marginTop: "2px",
          }}
        >
          {marked > 0
            ? `${marked} post${marked === 1 ? "" : "s"} moved to In Review`
            : "Already in review"}
        </p>
      )}
    </div>
  );
}
