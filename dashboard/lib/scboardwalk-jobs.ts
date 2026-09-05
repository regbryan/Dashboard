import "server-only";
import { createHiringDraft, type HiringJob } from "@/lib/hiring-draft";

// SC Boardwalk hiring scrape + diff. The careers page renders client-side, but
// the Asure/EnterTime ATS exposes a clean public JSON endpoint (no auth). We GET
// it, normalize each open requisition, and hand each to createHiringDraft, which
// dedups on the ATS req id — so only NEW openings become drafts.
//
// This is the "works today in the dashboard" path. The Dify platform workflow
// mirrors it: HTTP GET (same URL) -> diff (known-job-ids) -> LLM copy -> POST
// hiring-draft. Both create identical drafts.

const ATS_BASE = "https://secure3.entertimeonline.com";
const COMPANY_ID = process.env.SCBOARDWALK_ATS_COMPANY_ID || "6036097";

type AtsJob = {
  id: number | string;
  job_title?: string;
  job_categories?: string[];
  employee_type?: { name?: string } | null;
  base_pay_from?: number | null;
  base_pay_frequency?: string | null;
  job_description?: string | null;
};

export type NormalizedJob = HiringJob & { description: string | null };

function payText(from: number | null | undefined, freq: string | null | undefined): string | null {
  if (from == null) return null;
  // Hourly rates keep cents ($19.50); yearly/other whole amounts get thousands
  // separators and drop cents ($104,000).
  const hourly = freq === "HOUR";
  const amt = `$${Number(from).toLocaleString("en-US", {
    minimumFractionDigits: hourly ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
  const per =
    freq === "HOUR" ? "Hour" : freq === "YEAR" ? "Year" : freq === "WEEK" ? "Week" : freq ? String(freq).toLowerCase() : "";
  return per ? `${amt} / ${per}` : amt;
}

export function jobsApiUrl(): string {
  const cid = encodeURIComponent(`|${COMPANY_ID}`);
  return `${ATS_BASE}/ta/rest/ui/recruitment/companies/${cid}/job-requisitions?offset=1&size=100&sort=desc&ein_id=&lang=en-US`;
}

export async function fetchOpenPositions(): Promise<NormalizedJob[]> {
  const res = await fetch(jobsApiUrl(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`ATS fetch failed: ${res.status}`);
  const data = (await res.json()) as { job_requisitions?: AtsJob[] };
  const rows = data.job_requisitions ?? [];
  return rows
    .filter((j) => j && j.id != null && (j.job_title ?? "").trim())
    .map((j) => ({
      reqId: String(j.id),
      title: (j.job_title ?? "").trim(),
      category: j.job_categories?.[0] ?? null,
      employeeType: j.employee_type?.name ?? null,
      payText: payText(j.base_pay_from, j.base_pay_frequency),
      description: (j.job_description ?? null) as string | null,
    }));
}

// Deterministic on-brand caption (no LLM spend on the native path). The Dify
// workflow can swap in a richer LLM-written caption via the POST endpoint.
export function buildHiringCaption(job: NormalizedJob): string {
  const payLine = [job.payText, job.employeeType].filter(Boolean).join(" · ");
  return [
    `🎢 NOW HIRING: ${job.title}`,
    "",
    `Join the crew at the Santa Cruz Beach Boardwalk!${payLine ? ` ${payLine}.` : ""}`,
    "",
    "Apply today at beachboardwalk.com/jobs",
    "",
    "#SantaCruz #NowHiring #BoardwalkJobs #SantaCruzJobs",
  ].join("\n");
}

export type JobsSyncSummary = {
  ok: boolean;
  fetched: number;
  created: number;
  skipped: number;
  failed: number;
  createdTitles: string[];
  errors: { reqId: string; error: string }[];
  error?: string;
};

export async function runScboardwalkJobsSync(
  brandId = "scboardwalk"
): Promise<JobsSyncSummary> {
  const summary: JobsSyncSummary = {
    ok: true,
    fetched: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    createdTitles: [],
    errors: [],
  };

  let positions: NormalizedJob[];
  try {
    positions = await fetchOpenPositions();
  } catch (err) {
    return { ...summary, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  summary.fetched = positions.length;

  for (const job of positions) {
    const result = await createHiringDraft(brandId, {
      ...job,
      caption: buildHiringCaption(job),
    });
    if (!result.ok) {
      summary.failed += 1;
      summary.errors.push({ reqId: String(job.reqId), error: result.error });
    } else if (result.skipped) {
      summary.skipped += 1;
    } else {
      summary.created += 1;
      summary.createdTitles.push(job.title);
    }
  }

  summary.ok = summary.failed === 0;
  return summary;
}
