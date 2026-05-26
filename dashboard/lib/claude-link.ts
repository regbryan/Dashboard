// Build a deep-link to Claude.ai that opens a fresh conversation pre-filled
// with everything Claude needs to draft a revision: brand context, the post's
// current copy, the asset URL, and the client's verbatim feedback.
//
// Claude.ai's URL pattern (https://claude.ai/new?q=<encoded>) loads the chat
// with the prompt already in the input. Reggie clicks the link, hits enter,
// and Claude has full context immediately.
//
// URL length matters — most browsers/servers cap around 2000 chars in
// practice. We trim the longest free-text fields so the link stays portable.

export type ClaudeLinkInput = {
  brandName: string;
  postNumber: number | null | undefined;
  concept: string | null | undefined;
  postType: string | null | undefined;
  date: string | null | undefined;
  caption: string | null | undefined;
  hashtags: string | null | undefined;
  cta: string | null | undefined;
  visualDirection: string | null | undefined;
  assetUrl: string | null | undefined;
  clientComment: string | null | undefined;
};

const CLAUDE_BASE = "https://claude.ai/new";

// Conservative cap so the final URL stays under typical 2000-char limits
// after percent-encoding (which bloats text ~1.3x for typical English).
const MAX_FIELD_CHARS = 600;

function trim(value: string | null | undefined, max = MAX_FIELD_CHARS): string {
  const v = (value ?? "").trim();
  if (v.length <= max) return v;
  return v.slice(0, max - 1).trimEnd() + "…";
}

function buildClaudeRevisionPrompt(input: ClaudeLinkInput): string {
  const lines = [
    "Help me draft a revision for this post based on the client's feedback. Stay on-brand and propose:",
    "1. Revised caption",
    "2. Revised hashtags (if needed)",
    "3. Revised CTA (if needed)",
    "4. Visual changes (if any — describe what to update, not regenerate art here)",
    "5. One-line rationale",
    "",
    "── CONTEXT ──",
    `Brand: ${trim(input.brandName, 80)}`,
    `Post: #${input.postNumber ?? "?"} — ${trim(input.concept, 120) || "Untitled"}`,
    input.postType ? `Type: ${trim(input.postType, 40)}` : "",
    input.date ? `Date: ${trim(input.date, 40)}` : "",
    "",
    "── CURRENT COPY ──",
    `Caption:\n${trim(input.caption) || "(none)"}`,
    "",
    `Hashtags:\n${trim(input.hashtags, 300) || "(none)"}`,
    "",
    `CTA:\n${trim(input.cta, 200) || "(none)"}`,
    "",
    `Visual direction:\n${trim(input.visualDirection) || "(none)"}`,
    "",
    input.assetUrl ? `Current asset: ${input.assetUrl}` : "",
    "",
    "── CLIENT FEEDBACK ──",
    trim(input.clientComment, 800) || "(no specific note — client requested changes without a comment)",
  ];
  return lines.filter((l) => l !== null && l !== undefined).join("\n");
}

export function buildClaudeRevisionLink(input: ClaudeLinkInput): string {
  const prompt = buildClaudeRevisionPrompt(input);
  const params = new URLSearchParams({ q: prompt });
  return `${CLAUDE_BASE}?${params.toString()}`;
}
