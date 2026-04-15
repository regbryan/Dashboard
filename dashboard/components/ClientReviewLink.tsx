"use client";

import { useState } from "react";

interface ClientReviewLinkProps {
  path: string; // e.g. "/client/omega" or "/client/omega/post/11"
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
      // clipboard API blocked — fall back to a prompt
      window.prompt("Copy this link:", fullUrl);
    }
  }

  const mailtoHref = `mailto:?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(emailBody + fullUrl)}`;

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">{label}</h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={fullUrl}
          readOnly
          onFocus={(e) => e.target.select()}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCopy}
          className="px-3 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 whitespace-nowrap"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="flex gap-2">
        <a
          href={mailtoHref}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 inline-block"
        >
          ✉ Email Client
        </a>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-white text-gray-700 text-sm rounded border border-gray-300 hover:bg-gray-50 inline-block"
        >
          ↗ Open
        </a>
      </div>
    </div>
  );
}
