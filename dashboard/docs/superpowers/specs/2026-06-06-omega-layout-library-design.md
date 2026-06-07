# Omega Layout Library — Design Spec

**Date:** 2026-06-06
**Status:** Approved (design); implementation in progress
**Scope:** Omega Mortgage Group only (template to other brands later)

## Goal

Expand the Omega Satori renderer (`lib/autopilot/render-omega.ts`) from 8 built
layouts to **~11 distinct, reusable silhouettes**, so the content router can pick
the layout that fits each post and the feed never looks templated. Modeled on the
brand's proven reference designs (the v8 set + user-supplied examples).

## The 11-layout set

Already built (keep):
1. **COLLAGE** — 4 photos (2×2) + floating centered navy card. Market / seasonal.
2. **A** — photo band + numbered list. Educational with a photo.
3. **B** — full-bleed photo + bottom navy scrim. Emotional / brand.
4. **C** — list / 2-item comparison on cream (hollow navy rings). Lists, "X vs Y".
5. **D** — big-number hero / no-number closure card. Stats; holiday closure.
6. **E** — photo + statement. Testimonials / client stories.
7. **F** — split: photo + panel. **Refine → photo-LEFT + cream text panel** (per the
   "For the Moms…" example), navy bands top/bottom.
8. **G** — testimonial + gold stars on navy. Quote posts (low-priority).

Build new (modeled on user examples):
9. **QUAD** — navy header band (eyebrow + serif headline) + 2×2 grid of cream
   info-cards (bold navy heading + muted description) + soft CTA. No photo.
   Data: eyebrow, headline, 4 items {heading, desc}, cta. *("What Closing Costs Cover")*
10. **COLLAGE6** — 3 photos top row + full-width center navy band (serif+script
    headline + body) + 3 photos bottom row. Data: headline, body, 6 photos.
    *("What Closing Costs Actually Cover")* — richer market/recap/overview.
11. **BHEADER** — full-bleed photo + top navy header bar (serif+script headline) +
    body over a subtle scrim in the upper third. Data: headline, body, 1 photo.
    *("You Don't Need 20% Down")* — punchy myth/stat over a real home photo.

## Routing (extend `pickArchetype` in `omega-spec.ts`)

- "what X covers / includes / 4 components" (closing costs, loan-type overview) → **QUAD**
- punchy single claim / myth-bust that benefits from a home photo → **BHEADER**
- richer market / seasonal recap / "big picture" → **COLLAGE6** (rotate with COLLAGE)
- Mother's/Father's-style emotional with a longer message → **F** (rotate with B)
- (existing rules for COLLAGE / A / B / C / D / E unchanged)

Routing is heuristic and tunable; the goal is a varied feed, not rigid rules.

## Approach

Extend `render-omega.ts` in place: add `quadTree`, `collage6Tree`, `bheaderTree`
tree functions + dispatch branches + `OmegaArchetype` union members; refine
`splitTree` (F) to photo-left + cream panel. Update `omega-spec.ts` data
instructions + field population (QUAD needs 4 {heading,desc}; COLLAGE6 needs 6
photos; BHEADER needs headline+body+1 photo). Update `pipeline.ts` to generate 6
photos for COLLAGE6.

If `render-omega.ts` grows unwieldy (>~500 lines), split into per-layout modules.

## De-risk

For each new layout: render locally with placeholder photos (`tsx` + Satori →
PNG, zero generation credits, nothing deployed), review, adjust. Only after the
user approves the previews: wire routing → regenerate affected posts → QA → ship.

## Out of scope (deferred)

- **Logo / OMGLENDING.COM footer / NMLS overlay.** Reference designs carry these;
  current renders reserve the zones but leave them empty. Wiring the Dashboard to
  composite the real logo + footer + NMLS is a separate follow-up.
- Templating the library to the other 7 brands.
