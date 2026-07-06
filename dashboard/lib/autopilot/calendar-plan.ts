// Pure calendar-planning helpers shared by the onboarding seeder
// (seed-first-batch) and the on-demand month generator (generate-calendar).
//
// Deliberately free of `server-only`, Supabase, and Date.now() so the logic
// is unit-testable in isolation. Callers pass in any "today" anchor they need.

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Visual mix: most brands lean image-heavy, with reels for variety and the
// occasional text post. Numbers are weights (sum need not be 100).
const POST_TYPE_WEIGHTS: Record<"Image" | "Reel" | "Text Post", number> = {
  Image: 6,
  Reel: 3,
  "Text Post": 1,
};

// Lower bound — if a cadence string is unparseable we still plan ~1/wk rather
// than nothing.
const DEFAULT_POSTS_PER_WEEK = 3;

export type PillarPick = { name: string; pct: number };

/** Parse "3 per week" / "5/wk" / "weekly" / "biweekly" / "2x/month" → posts per week. */
export function parsePostsPerWeek(input: string | null | undefined): number {
  if (!input) return DEFAULT_POSTS_PER_WEEK;
  const lower = input.toLowerCase().trim();
  // "2x/month" / "2 per month" → convert a monthly count to a weekly rate.
  if (lower.includes("month")) {
    const m = lower.match(/(\d+)/);
    const perMonth = m ? parseInt(m[1], 10) : 2;
    if (Number.isFinite(perMonth) && perMonth > 0) return (perMonth * 12) / 52;
    return 0.5;
  }
  // Order matters: 'biweekly' contains 'weekly'; 'semi-weekly' = twice a week.
  if (lower.includes("biweekly") || lower.includes("bi-weekly")) return 0.5;
  if (lower.includes("semi-weekly") || lower.includes("semiweekly")) return 2;
  if (lower.includes("daily")) return 7;
  if (lower.includes("weekly")) return 1;
  if (lower.includes("twice")) return 2;
  const match = lower.match(/(\d+)/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 14) return n;
  }
  return DEFAULT_POSTS_PER_WEEK;
}

const WEEKDAY_TOKEN_TO_NUM: Record<string, number> = {
  su: 0,
  m: 1,
  tu: 2,
  w: 3,
  th: 4,
  f: 5,
  sa: 6,
};

/**
 * Extract explicit weekday tokens from a cadence string like "3x/week (M/W/F)"
 * or "2x/week (Tu/Th)". Returns weekday numbers (0=Sun..6=Sat), de-duped and
 * sorted. Empty array when no weekday hint is present (e.g. "2x/month").
 *
 * Two-letter tokens (Su/Sa/Tu/Th) are matched before single-letter ones
 * (M/W/F) so "Tu" isn't read as "T".
 *
 * Only the contents of the parenthesised hint are scanned — otherwise words
 * like "month" ("m" + "th") or "weekly" ("w") would register false weekdays.
 * No parentheses → no explicit hint → empty.
 */
export function parseWeekdayTokens(input: string | null | undefined): number[] {
  if (!input) return [];
  const paren = input.match(/\(([^)]*)\)/);
  if (!paren) return [];
  const scope = paren[1].toLowerCase();
  const found = new Set<number>();
  for (const m of scope.matchAll(/su|sa|tu|th|m|w|f/g)) {
    const num = WEEKDAY_TOKEN_TO_NUM[m[0]];
    if (num !== undefined) found.add(num);
  }
  return [...found].sort((a, b) => a - b);
}

function isoForDay(year: number, month0: number, day: number): string {
  const mm = String(month0 + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Plan the ISO dates for a single calendar month.
 *
 * - If the cadence names explicit weekdays (e.g. "(Tu/Th)"), every matching
 *   day in the month is used — mirrors how the brand actually posts.
 * - Otherwise the posts/week (or posts/month) rate is spread evenly across
 *   the month.
 *
 * `notBefore` (ISO yyyy-mm-dd, optional) drops any planned date strictly
 * earlier than it — used to avoid authoring posts for days already past when
 * generating the current month.
 *
 * @param month0 zero-indexed month (0 = January)
 */
export function planMonthDates(
  year: number,
  month0: number,
  cadence: string | null | undefined,
  notBefore?: string
): string[] {
  const total = daysInMonth(year, month0);
  const weekdays = parseWeekdayTokens(cadence);

  let dates: string[];
  if (weekdays.length > 0) {
    dates = [];
    for (let d = 1; d <= total; d++) {
      const dow = new Date(Date.UTC(year, month0, d)).getUTCDay();
      if (weekdays.includes(dow)) dates.push(isoForDay(year, month0, d));
    }
  } else {
    const perWeek = parsePostsPerWeek(cadence);
    const count = Math.max(1, Math.round((perWeek / 7) * total));
    const step = total / count;
    dates = [];
    for (let i = 0; i < count; i++) {
      // Center each slot within its band so posts aren't all at month start.
      const day = Math.min(total, Math.max(1, Math.round(i * step + step / 2)));
      dates.push(isoForDay(year, month0, day));
    }
    // Round-to-same-day collisions are possible for tiny counts; de-dupe.
    dates = [...new Set(dates)];
  }

  if (notBefore) {
    dates = dates.filter((iso) => iso >= notBefore);
  }
  return dates;
}

/**
 * Plan dates over a rolling horizon starting tomorrow — the original
 * seed-first-batch behavior, preserved for onboarding.
 */
export function planHorizonDates(
  postsPerWeek: number,
  horizonDays: number,
  start: Date
): string[] {
  const total = Math.max(1, Math.round((postsPerWeek / 7) * horizonDays));
  const stepDays = horizonDays / total;
  const dates: string[] = [];
  const base = new Date(start);
  base.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < total; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + 1 + Math.floor(i * stepDays));
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function dayShortFor(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  return DAY_SHORT[d.getUTCDay()];
}

export function pickPillars(raw: unknown[] | null | undefined): PillarPick[] {
  if (!raw || raw.length === 0) {
    return [
      { name: "Educational", pct: 50 },
      { name: "Behind the scenes", pct: 25 },
      { name: "Promotional", pct: 25 },
    ];
  }
  const out: PillarPick[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : null;
    const pct = typeof o.pct === "number" ? o.pct : 0;
    if (name) out.push({ name, pct: Math.max(0, pct) });
  }
  if (out.length === 0) return [{ name: "Educational", pct: 100 }];
  if (out.every((p) => p.pct === 0)) return out.map((p) => ({ ...p, pct: 1 }));
  return out;
}

/**
 * Deterministic weighted pillar picker. Uses a golden-ratio walk so the first
 * few posts spread across pillars rather than getting unlucky on a small N.
 */
export function makePillarPicker(pillars: PillarPick[]): (idx: number) => string {
  const total = pillars.reduce((sum, p) => sum + p.pct, 0);
  const cumulative: number[] = [];
  let acc = 0;
  for (const p of pillars) {
    acc += p.pct;
    cumulative.push(acc / total);
  }
  return (idx: number) => {
    const t = (idx * 0.6180339887 + 0.13) % 1;
    for (let i = 0; i < cumulative.length; i++) {
      if (t <= cumulative[i]) return pillars[i].name;
    }
    return pillars[pillars.length - 1].name;
  };
}

export function makeTypePicker(platform: string): (idx: number) => string {
  // LinkedIn / Facebook → no Reels; bump Image + Text Post.
  const weights = { ...POST_TYPE_WEIGHTS };
  if (platform === "linkedin" || platform === "facebook") {
    weights.Reel = 0;
    weights["Text Post"] = 3;
  } else {
    // Instagram (and default): IMAGE ONLY. Client rules — no video content for
    // now, and IG designs must carry real photography (no text-only posts).
    weights.Reel = 0;
    weights["Text Post"] = 0;
  }
  const entries = Object.entries(weights).filter(([, w]) => w > 0) as Array<
    [keyof typeof POST_TYPE_WEIGHTS, number]
  >;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const cumulative: number[] = [];
  let acc = 0;
  for (const [, w] of entries) {
    acc += w;
    cumulative.push(acc / total);
  }
  return (idx: number) => {
    const t = (idx * 0.3819660113 + 0.07) % 1;
    for (let i = 0; i < cumulative.length; i++) {
      if (t <= cumulative[i]) return entries[i][0];
    }
    return entries[entries.length - 1][0];
  };
}
