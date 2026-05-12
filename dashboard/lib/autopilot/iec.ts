import "server-only";

// IEC-specific prompt builder + caption-footer enforcer.
//
// The memory rule "Every IEC IG caption must end with #InlandEmpireComfort +
// License No.: 1053697 + 📞: 951.789.3238" is enforced here, not in the
// model prompt — appending deterministically is more reliable than asking
// the model to remember.

const IEC_CAPTION_FOOTER = [
  "",
  "#InlandEmpireComfort",
  "License No.: 1053697",
  "📞: 951.789.3238",
].join("\n");

export type IECPostInput = {
  concept: string | null;
  visualDirection: string | null;
  contentPillar: string | null;
  postType: string | null;
};

/**
 * Build a Gemini image-gen prompt for an IEC post. We keep this deliberately
 * dense: brand palette (the navy/light-blue/red from brand-mapping.ts), no
 * baked-in logo (universal "no automated logos" rule), no embedded text
 * unless visual_direction explicitly calls for a headline.
 */
export function buildIECImagePrompt(post: IECPostInput): string {
  const lines: string[] = [];
  lines.push(
    "Instagram square (1:1) post for Inland Empire Comfort, a Southern California HVAC company."
  );
  lines.push(
    "Brand palette: deep navy #104B94 primary, soft sky blue #87ABCF secondary, signature red #DB222A accent. Clean, trustworthy, residential-service feel."
  );
  if (post.contentPillar) {
    lines.push(`Content pillar: ${post.contentPillar}.`);
  }
  if (post.postType) {
    lines.push(`Post type: ${post.postType}.`);
  }
  if (post.concept) {
    lines.push(`Concept: ${post.concept}`);
  }
  if (post.visualDirection) {
    lines.push(`Visual direction: ${stripLogoMentions(post.visualDirection)}`);
  }
  lines.push(
    "Photography style: bright, real, lived-in Inland Empire homes — no stock-photo plastic. Authentic California stucco/tile-roof context when exterior."
  );
  lines.push(
    "DO NOT render any company logo, watermark, brand name text, phone number, or license number — those are composited later. DO NOT add a footer band."
  );
  lines.push(
    "Composition must be visually full and bold — no dead space, no sparse empty backdrops."
  );
  return lines.join(" ");
}

/**
 * Strip references to brand marks from visual_direction text. The universal
 * "no automated logos" rule says the pipeline never paints a logo; the client
 * composites them after generation. Older calendar entries were written for
 * human designers and still say things like "Brand logo center" — leaving
 * those in the Gemini prompt collides with the explicit "DO NOT render any
 * company logo" instruction lower in the prompt. We remove sentence-level
 * fragments that mention logo/watermark/brand mark before passing the rest
 * of the visual direction to the model.
 */
export function stripLogoMentions(visualDirection: string): string {
  const pattern = /\b(logo|watermark|brand[\s-]?mark|brand[\s-]?name(?:\s+text)?)\b/i;
  const cleaned = visualDirection
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !pattern.test(sentence))
    .join(" ")
    .trim();
  return cleaned.length > 0 ? cleaned : visualDirection.replace(pattern, "").trim();
}

export function ensureIECCaptionFooter(caption: string | null): string {
  const base = (caption ?? "").trimEnd();
  if (
    base.includes("License No.: 1053697") &&
    base.includes("#InlandEmpireComfort")
  ) {
    return base;
  }
  return `${base}${IEC_CAPTION_FOOTER}`;
}
