// Em/en dashes read as an "AI tell" and the client doesn't want them. Strip
// them deterministically from all generated copy (models ignore a "don't use
// em dashes" instruction too often to rely on it).
//
// A dash used as a clause separator becomes a comma; collapse any resulting
// doubled punctuation/space.

export function stripEmDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ") // em (U+2014) / en (U+2013) dash → comma
    .replace(/\s+,/g, ",") // no space before a comma
    .replace(/,\s*,/g, ", ") // collapse accidental double commas
    .replace(/\s{2,}/g, " ") // collapse double spaces
    .trim();
}

/** Apply stripEmDashes to a possibly-null string, preserving null. */
export function stripEmDashesOrNull(text: string | null | undefined): string | null {
  if (text == null) return null;
  const out = stripEmDashes(text);
  return out.length > 0 ? out : null;
}
