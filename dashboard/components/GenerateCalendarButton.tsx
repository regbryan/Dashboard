"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function GenerateCalendarButton({
  brandId,
  defaultYear,
  defaultMonth, // 1-indexed
  todayIso,
}: {
  brandId: string;
  defaultYear: number;
  defaultMonth: number;
  todayIso: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      // Only skip past days when generating the current month.
      const isCurrentMonth =
        year === Number(todayIso.slice(0, 4)) &&
        month === Number(todayIso.slice(5, 7));
      const res = await fetch(`/api/brands/${brandId}/generate-calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          notBefore: isCurrentMonth ? todayIso : undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        summary?: { created: number; skipped: number; error?: string };
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.summary?.error || body.error || `HTTP ${res.status}`);
      } else {
        const s = body.summary;
        setMessage(
          `Created ${s?.created ?? 0} draft post${s?.created === 1 ? "" : "s"}${
            s && s.skipped > 0 ? ` · skipped ${s.skipped} already on the calendar` : ""
          }.`
        );
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const yearOptions = [defaultYear, defaultYear + 1];

  return (
    <div style={{ marginBottom: "20px" }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "9px 18px",
            borderRadius: "999px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: "#c084fc",
            color: "#07070e",
            border: "none",
          }}
        >
          + Generate calendar
        </button>
      ) : (
        <div
          className="surface-card flex flex-wrap items-center"
          style={{ gap: "10px", padding: "14px 16px", borderRadius: "12px" }}
        >
          <span style={{ fontSize: "13px", color: "#bfbfcc" }}>Generate draft posts for</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            disabled={busy}
            style={selectStyle}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={busy}
            style={selectStyle}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            style={{
              padding: "8px 16px",
              borderRadius: "999px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              cursor: busy ? "wait" : "pointer",
              background: "#c084fc",
              color: "#07070e",
            }}
          >
            {busy ? "Generating…" : "Generate"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setMessage(null);
              setError(null);
            }}
            disabled={busy}
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              fontSize: "13px",
              cursor: "pointer",
              background: "rgba(255,255,255,0.03)",
              color: "#bfbfcc",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Cancel
          </button>
          {message && (
            <span style={{ fontSize: "12px", color: "#86efac", width: "100%" }}>{message}</span>
          )}
          {error && (
            <span style={{ fontSize: "12px", color: "#fbb27a", width: "100%" }}>{error}</span>
          )}
          <span style={{ fontSize: "11px", color: "#8a8a98", width: "100%" }}>
            Writes captions + art direction only — no images. Dates already on the calendar are skipped.
          </span>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: "8px",
  fontSize: "13px",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
  cursor: "pointer",
};
