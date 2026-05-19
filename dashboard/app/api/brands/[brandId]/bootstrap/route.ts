import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

import { withRequestContext } from "@/lib/request-context";

// Bootstraps human-only brand_kit fields by reading the brand's website.
// We fetch the URL ourselves (Gemini's free-tier doesn't auto-fetch), strip
// HTML to plain text, send the text to Gemini with a strict-JSON schema,
// and only fill fields that are currently null — so re-running on a brand
// you've already curated won't blow away your edits.

export const maxDuration = 60;

const TEXT_ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_PAGE_TEXT_CHARS = 40_000; // ~10k tokens worth, safely inside flash context

type BootstrapBody = {
  website_url?: string;
  // Override the only-fill-nulls behavior — useful if you want to refresh
  // everything from the latest website copy.
  overwrite?: boolean;
};

type ExtractedKit = {
  tagline?: string;
  description?: string;
  positioning?: string;
  mission?: string;
  audiences?: {
    tier?: "primary" | "secondary";
    description?: string;
    pain_points?: string[];
  }[];
  hq_location?: string;
  service_area?: string[];
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  return withRequestContext(req as Request, () => handlePOST(req, { params }));
}

async function handlePOST(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    await requireAdmin();
    const { brandId } = await params;

    let body: BootstrapBody;
    try {
      body = (await req.json()) as BootstrapBody;
    } catch {
      return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
    }

    const url = (body.website_url ?? "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return Response.json(
        { ok: false, error: "website_url must be an http(s) URL" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ ok: false, error: "GEMINI_API_KEY not set" }, { status: 500 });
    }

    // 1. Fetch the page.
    let pageText: string;
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (SocialPulse Brand Bootstrap)" },
        redirect: "follow",
      });
      if (!r.ok) {
        return Response.json(
          { ok: false, error: `fetch ${url} returned ${r.status}` },
          { status: 400 }
        );
      }
      const html = await r.text();
      pageText = stripHtmlToText(html).slice(0, MAX_PAGE_TEXT_CHARS);
    } catch (e) {
      return Response.json(
        { ok: false, error: `fetch failed: ${e instanceof Error ? e.message : String(e)}` },
        { status: 400 }
      );
    }

    // 2. Ask Gemini to extract.
    const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
    const instruction = `You are extracting brand kit fields from a company's website. Return ONLY strict JSON matching the schema below. Omit any field you can't confidently extract — better empty than guessed.

{
  "tagline": "Short tagline / hero subhead (1 short sentence or phrase)",
  "description": "1-3 sentence description of what this company does",
  "positioning": "1-2 sentence positioning statement: who they serve and what makes them different",
  "mission": "Mission statement if explicitly stated on the site, otherwise omit",
  "audiences": [
    {"tier":"primary","description":"who they are","pain_points":["problem 1","problem 2"]}
  ],
  "hq_location": "City, State / Country if mentioned",
  "service_area": ["region","region"]
}

Website URL: ${url}

Page text:

${pageText}`;

    let res: Response;
    try {
      res = await fetch(
        `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: instruction }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
    } catch (e) {
      return Response.json(
        { ok: false, error: `gemini call failed: ${e instanceof Error ? e.message : String(e)}` },
        { status: 500 }
      );
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return Response.json(
        { ok: false, error: `gemini ${res.status}: ${t.slice(0, 400)}` },
        { status: 500 }
      );
    }
    type Part = { text?: string };
    type Candidate = { content?: { parts?: Part[] } };
    const envelope = (await res.json()) as { candidates?: Candidate[] };
    const text = envelope.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return Response.json({ ok: false, error: "empty gemini response" }, { status: 500 });
    }
    let extracted: ExtractedKit;
    try {
      extracted = JSON.parse(text) as ExtractedKit;
    } catch {
      return Response.json(
        { ok: false, error: "gemini returned non-JSON: " + text.slice(0, 300) },
        { status: 500 }
      );
    }

    // 3. Merge into brand_kits — only fill nulls unless overwrite=true.
    const admin = supabaseAdmin();
    const { data: existing } = await admin
      .from("brand_kits")
      .select("tagline, description, positioning, mission, audiences, hq_location, service_area")
      .eq("slug", brandId)
      .maybeSingle();
    type Existing = {
      tagline: string | null;
      description: string | null;
      positioning: string | null;
      mission: string | null;
      audiences: unknown[] | null;
      hq_location: string | null;
      service_area: string[] | null;
    };
    const e = (existing as Existing | null) ?? {
      tagline: null,
      description: null,
      positioning: null,
      mission: null,
      audiences: null,
      hq_location: null,
      service_area: null,
    };

    function pickStr(extractedV: string | undefined, currentV: string | null): string | null {
      if (body.overwrite && extractedV) return extractedV;
      return currentV && currentV.length > 0 ? currentV : extractedV ?? null;
    }
    function pickArr<T>(extractedV: T[] | undefined, currentV: T[] | null): T[] | null {
      if (body.overwrite && extractedV && extractedV.length > 0) return extractedV;
      return currentV && currentV.length > 0 ? currentV : extractedV ?? null;
    }

    const updates: Record<string, unknown> = {
      website_url: url,
      updated_at: new Date().toISOString(),
      tagline: pickStr(extracted.tagline, e.tagline),
      description: pickStr(extracted.description, e.description),
      positioning: pickStr(extracted.positioning, e.positioning),
      mission: pickStr(extracted.mission, e.mission),
      hq_location: pickStr(extracted.hq_location, e.hq_location),
      service_area: pickArr(extracted.service_area, e.service_area),
      audiences: pickArr(extracted.audiences, e.audiences),
    };

    const { error: upErr } = await admin
      .from("brand_kits")
      .update(updates)
      .eq("slug", brandId);
    if (upErr) {
      return Response.json({ ok: false, error: `update: ${upErr.message}` }, { status: 500 });
    }

    return Response.json({
      ok: true,
      filled: Object.fromEntries(
        Object.entries(updates).filter(([k]) => k !== "updated_at")
      ),
    });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
