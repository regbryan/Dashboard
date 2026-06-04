# Brand Assets — authoritative source of truth

Recovered from the original **Instagram Automation** project folder (the
`_brands/` directory). These are the *authoritative* brand specs — the
dashboard's `brand_kits` table was re-grounded from these files on 2026-06-03.

Only the relevant, reusable assets are committed here (the full original folder
was ~9.5 GB of references, carousels, and node_modules — intentionally excluded).

## Per brand
- **`brand.json`** — the real spec: role-based color system, typography, design
  archetypes (named templates), license #, caption footer, forbidden text,
  native/generated sizes, posting cadence.
- **`voice.md`** — brand voice guidelines.
- **`post-template.json`** — design template (IEC only so far).
- **`cutouts/` · `photos/`** — real transparent **logos** (4C / black / white
  variants) and reference photography (e.g. IEC's `tech_back_logo_*` show the
  real navy uniform with the badge on the back).

## Brands
`blitz` `csc` `doug` `iec` `omega` `riverside` `scboardwalk` `stephanie`
(`riverside` has no logo file in the recovered set.)

## Why this matters
The dashboard's stored kits were degraded derivations. `brand.json` is the truth:
e.g. IEC is navy `#104B94` + red `#DB222A` (not pale blue), Omega is blue +
white + yellow `#FDD314`. The Satori designed-graphic render reads brand_kit
colors, and can later use these **logos**, **fonts**, and **archetypes** directly.
