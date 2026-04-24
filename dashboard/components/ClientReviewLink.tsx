"use client";

import { useState } from "react";

interface ClientReviewLinkProps {
  path: string;
  label?: string;
  emailSubject?: string;
  emailBody?: string;
}

export default function ClientReviewLink({
  path,
  label = "Client Review Link",
  emailSubject = "Your content is ready for review",
  emailBody = "Hi,\n\nYour content is ready for review. Please use the link below to approve or request changes:\n\n",
}: ClientReviewLinkProps) {
  const [copied, setCopied] = useState(false);

  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", fullUrl);
    }
  }

  const mailtoHref = `mailto:?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(emailBody + fullUrl)}`;

  return (
    <div
      className="surface-card flex flex-col"
      style={{ padding: "18px 20px", gap: "12px", borderRadius: "14px" }}
    >
      <h2 className="eyebrow">{label}</h2>

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

      <div className="flex" style={{ gap: "8px" }}>
        <a
          href={mailtoHref}
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
          ✉ Email Client
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
    </div>
  );
}
