import "server-only";

// In-code registry of brand rules enforced by the autopilot regardless of
// what's in brand_kits. Kept terse and central so adding a brand's compliance
// requirement is one entry.

export const UNIVERSAL_NEGATIVE_RULES: string[] = [
  "DO NOT render any company logo, watermark, brand name text, phone number, or license number — those are composited later.",
  "DO NOT add a footer band or disclaimer text — those are handled by post-processing.",
  "DO NOT include random, irrelevant, or nonsensical objects (e.g. toys or clutter unrelated to the subject).",
  "Any text that appears must be real, correctly spelled words — never gibberish, garbled, or warped lettering. Keep on-image text minimal.",
  "DO NOT output a generic stock-photo look. The result should read as an intentionally designed, on-brand graphic.",
];

export type CaptionFooterBlock = {
  text: string;
  // Tokens that, if all present in the existing caption, mean the footer
  // is already there and shouldn't be appended again.
  guard: string[];
};

export const BRAND_CAPTION_FOOTERS: Record<string, CaptionFooterBlock> = {
  iec: {
    text: "#InlandEmpireComfort\nLicense No.: 1053697\n📞: 951.789.3238",
    guard: ["License No.: 1053697", "#InlandEmpireComfort"],
  },
};
