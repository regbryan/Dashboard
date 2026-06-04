import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import {
  dayShortFor,
  makePillarPicker,
  makeTypePicker,
  pickPillars,
  planMonthDates,
} from "./calendar-plan";
import { stripEmDashesOrNull } from "./sanitize-copy";

// Authors a full calendar month of DRAFT posts (text only) for a brand, on its
// cadence, grounded in the brand kit. No images are generated here — that's a
// separate, explicit step (per-post regenerate route / multi-select UI).
//
// Idempotent: any date in the month that already has a post is skipped, so
// re-running only fills the gaps.

const TEXT_ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

export type GenerateCalendarSummary = {
  brandSlug: string;
  year: number;
  month: number; // 1-indexed
  created: number;
  skipped: number;
  dates: string[];
  error?: string;
};

type AuthoredSlot = {
  concept?: string;
  caption?: string;
  visual_direction?: string;
  hashtags?: string;
};

type PlannedSlot = {
  date: string;
  day: string;
  post_type: string;
  content_pillar: string;
};

// Month-specific hooks the model may weave in *when naturally on-brand*. Keys
// are 1-indexed months. Intentionally light — the brand kit drives voice.
const MONTH_HOOKS: Record<number, string> = {
  1: "New Year goals, fresh starts, winter",
  2: "Valentine's Day, Black History Month",
  3: "spring kickoff, Women's History Month, tax season",
  4: "spring, Earth Day (Apr 22), tax deadline",
  5: "Mother's Day (2nd Sun), Memorial Day, late spring",
  6: "summer kickoff, Father's Day (3rd Sun), Juneteenth (Jun 19), Pride Month",
  7: "Independence Day (Jul 4), peak summer",
  8: "late summer, back-to-school",
  9: "Labor Day, fall kickoff, back-to-school",
  10: "fall, Halloween, cozy season",
  11: "Thanksgiving, gratitude, holiday lead-in, Black Friday",
  12: "holidays, year-end, New Year lead-in",
};

/**
 * @param month 1-indexed month (1 = January)
 * @param notBefore optional ISO yyyy-mm-dd; planned dates earlier than this are
 *   dropped (used so generating the current month skips days already past)
 */
export async function generateCalendar(
  brandSlug: string,
  opts: { year: number; month: number; notBefore?: string }
): Promise<GenerateCalendarSummary> {
  const admin = supabaseAdmin();
  const { year, month } = opts;
  const month0 = month - 1;

  const base: GenerateCalendarSummary = {
    brandSlug,
    year,
    month,
    created: 0,
    skipped: 0,
    dates: [],
  };

  const { data: brandRow, error: brandErr } = await admin
    .from("brands")
    .select("id, name, handle, platform, cadence")
    .eq("id", brandSlug)
    .maybeSingle();
  if (brandErr || !brandRow) {
    return { ...base, error: "brand not found" };
  }
  const brand = brandRow as {
    name: string;
    handle: string | null;
    platform: string | null;
    cadence: string | null;
  };

  const { data: kitRow } = await admin
    .from("brand_kits")
    .select("positioning, tone, content_pillars, photography_direction, primary_platform")
    .eq("slug", brandSlug)
    .maybeSingle();
  const kit = (kitRow ?? {}) as {
    positioning?: string | null;
    tone?: Record<string, unknown> | null;
    content_pillars?: unknown[] | null;
    photography_direction?: string | null;
    primary_platform?: string | null;
  };

  // Plan dates for the month at the brand's cadence.
  const planned = planMonthDates(year, month0, brand.cadence, opts.notBefore);
  if (planned.length === 0) {
    return { ...base, error: "no dates planned for this month/cadence" };
  }

  // Skip dates already occupied (idempotency).
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;
  const { data: existing } = await admin
    .from("posts")
    .select("date")
    .eq("brand_id", brandSlug)
    .gte("date", monthStart)
    .lte("date", monthEnd);
  const occupied = new Set(
    ((existing ?? []) as { date: string | null }[])
      .map((r) => r.date)
      .filter(Boolean) as string[]
  );

  const openDates = planned.filter((d) => !occupied.has(d));
  base.skipped = planned.length - openDates.length;
  if (openDates.length === 0) {
    return base; // everything already seeded
  }

  // Assign post_type + content_pillar per open slot.
  const pillars = pickPillars(kit.content_pillars);
  const platform = (
    kit.primary_platform ||
    brand.platform ||
    "instagram"
  ).toLowerCase();
  const typePicker = makeTypePicker(platform);
  const pillarPicker = makePillarPicker(pillars);

  const slots: PlannedSlot[] = openDates.map((iso, idx) => ({
    date: iso,
    day: dayShortFor(iso),
    post_type: typePicker(idx),
    content_pillar: pillarPicker(idx),
  }));

  // Author copy for every slot in one model call.
  const authored = await authorSlots(brand.name, brand.handle, platform, kit, month, slots);
  if (!authored.ok) {
    return { ...base, error: authored.error };
  }

  // Determine next post_number.
  const { data: maxRow } = await admin
    .from("posts")
    .select("post_number")
    .eq("brand_id", brandSlug)
    .order("post_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextNum =
    (((maxRow ?? {}) as { post_number?: number | null }).post_number ?? 0) + 1;

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  slots.forEach((slot, idx) => {
    const copy = authored.slots[idx] ?? {};
    // Require a concept or visual_direction — otherwise the image pipeline
    // can't generate from this row, so skip rather than insert a dead slot.
    const concept = (copy.concept ?? "").trim();
    const visual = (copy.visual_direction ?? "").trim();
    if (!concept && !visual) return;
    rows.push({
      brand_id: brandSlug,
      post_number: nextNum++,
      date: slot.date,
      day: slot.day,
      post_type: slot.post_type,
      content_pillar: slot.content_pillar,
      concept: stripEmDashesOrNull(concept),
      caption: stripEmDashesOrNull(copy.caption),
      visual_direction: stripEmDashesOrNull(visual),
      hashtags: stripEmDashesOrNull(copy.hashtags),
      status: "not_started",
      created_at: now,
      updated_at: now,
    });
  });

  if (rows.length === 0) {
    return { ...base, error: "model returned no usable copy" };
  }

  const { error: insErr } = await admin.from("posts").insert(rows);
  if (insErr) {
    return { ...base, error: `insert failed: ${insErr.message}` };
  }

  base.created = rows.length;
  base.dates = rows.map((r) => r.date as string);
  return base;
}

async function authorSlots(
  brandName: string,
  handle: string | null,
  platform: string,
  kit: {
    positioning?: string | null;
    tone?: Record<string, unknown> | null;
    photography_direction?: string | null;
  },
  month: number,
  slots: PlannedSlot[]
): Promise<{ ok: true; slots: AuthoredSlot[] } | { ok: false; error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const tone = kit.tone ?? {};
  const toneStr = (key: string): string => {
    const v = (tone as Record<string, unknown>)[key];
    return Array.isArray(v) ? (v as unknown[]).filter((x) => typeof x === "string").join(", ") : "";
  };
  const monthName = new Date(Date.UTC(2000, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  const slotLines = slots
    .map(
      (s, i) =>
        `SLOT ${i + 1} — date ${s.date} (${s.day}), type ${s.post_type}, pillar "${s.content_pillar}"`
    )
    .join("\n");

  const instruction = `You are the social media copywriter for "${brandName}"${
    handle ? ` (${handle})` : ""
  }, posting on ${platform}.

BRAND CONTEXT
Positioning: ${kit.positioning ?? "(n/a)"}
Voice keywords: ${toneStr("keywords") || "(n/a)"}
Phrases to use: ${toneStr("vocab_use") || "(n/a)"}
Phrases to avoid: ${toneStr("vocab_avoid") || "(n/a)"}
Voice do's: ${toneStr("dos") || "(n/a)"}
Voice don'ts: ${toneStr("donts") || "(n/a)"}
Photography direction: ${kit.photography_direction ?? "(n/a)"}

You are writing the ${monthName} content calendar. Relevant seasonal hooks for ${monthName}: ${
    MONTH_HOOKS[month] ?? "(none specific)"
  }. Use a seasonal hook ONLY when it is naturally on-brand for this business; never force it.

For EACH slot below, write one post that fits its assigned pillar and post type. Match the brand voice exactly. Captions should read like a real ${platform} post (natural length, line breaks and tasteful emoji where they fit the brand, a clear call to action). visual_direction is concise art direction for the designer (subject, composition, colors, mood) — do NOT request logos or watermarks.

SLOTS:
${slotLines}

Return ONLY strict JSON (no markdown fences): an array of exactly ${slots.length} objects in slot order, each:
{"concept": "short hook/title", "caption": "full post caption", "visual_direction": "art direction", "hashtags": "space-separated #tags"}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: `gemini fetch: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `gemini ${res.status}: ${t.slice(0, 400)}` };
  }

  type Part = { text?: string };
  type Candidate = { content?: { parts?: Part[] } };
  let body: { candidates?: Candidate[] };
  try {
    body = (await res.json()) as { candidates?: Candidate[] };
  } catch {
    return { ok: false, error: "gemini returned non-JSON envelope" };
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "no text in gemini response" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "gemini text was not valid JSON" };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "gemini did not return a JSON array" };
  }

  return { ok: true, slots: parsed as AuthoredSlot[] };
}
