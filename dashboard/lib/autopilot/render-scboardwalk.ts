import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// SC Boardwalk Crew hiring template — matches the client's own v1 designs:
//   ┌────────────────────────────┐
//   │  blue band: NOW HIRING      │  ← header (drawn in code)
//   │            ELECTRICIAN       │
//   ├────────────────────────────┤
//   │     no-people PHOTO          │  ← AI-generated middle (the ONLY AI part)
//   ├────────────────────────────┤
//   │  detail line                 │  ← footer (drawn in code)
//   │  Apply at beachboardwalk.../ │
//   │  @beachboardwalkjobs         │
//   └────────────────────────────┘
// Everything except the middle photo is painted in code, so the apply URL and
// handle are ALWAYS exact (never garbled by the image model), and the photo can
// never invent a fake uniform because it's a no-people scene.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 700 | 800; style: "normal" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Poppins", data: f("poppins-700.woff"), weight: 700, style: "normal" },
      { name: "Poppins", data: f("poppins-800.woff"), weight: 800, style: "normal" },
    ];
  }
  return fontsCache;
}

// Brand constants (SC Boardwalk Crew). Blue is brands.color_primary.
const BLUE = "#1070B0";
const WHITE = "#FFFFFF";
const APPLY_URL = "beachboardwalk.com/jobs";
const HANDLE = "@beachboardwalkjobs";

export type ScboardwalkRenderInput = {
  eyebrow: string; // e.g. "NOW HIRING"
  headline: string; // e.g. "ELECTRICIAN"
  detailLine: string; // short benefit / requirement line
  // The no-people middle photo. OMIT for the "blue bands, no photo" hiring-draft
  // variant — the middle renders a neutral placeholder and the operator drops in
  // SC Boardwalk's OWN real photo at approval time.
  photo?: Buffer | null;
  width?: number;
  height?: number;
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({
  type,
  props: { style, children },
});
const img = (src: string, style: Record<string, unknown>): El => ({ type: "img", props: { src, style } });

export async function renderScboardwalkDesign(input: ScboardwalkRenderInput): Promise<Buffer> {
  // Fixed 4:5 poster (matches the client's portrait hiring cards), independent
  // of the post's stored aspect.
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;

  const dataUri = input.photo
    ? `data:image/jpeg;base64,${(await sharp(input.photo).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`
    : null;

  const eyebrow = input.eyebrow.toUpperCase();
  const headline = input.headline.toUpperCase();
  // Scale the headline down for long role names so it never overflows the band.
  const headlineSize = headline.length > 16 ? 62 : headline.length > 11 ? 76 : 92;

  const header = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      background: BLUE,
      padding: "46px 56px 40px",
    },
    [
      h(
        "div",
        {
          display: "flex",
          fontFamily: "Poppins",
          fontWeight: 700,
          fontSize: "32px",
          letterSpacing: "7px",
          color: "rgba(255,255,255,0.92)",
        },
        eyebrow
      ),
      h(
        "div",
        {
          display: "flex",
          width: "100%",
          justifyContent: "center",
          textAlign: "center",
          fontFamily: "Poppins",
          fontWeight: 800,
          fontSize: `${headlineSize}px`,
          lineHeight: 1.03,
          color: WHITE,
        },
        headline
      ),
    ]
  );

  const photo = dataUri
    ? h("div", { display: "flex", flexGrow: 1, width: "100%" }, [
        img(dataUri, { width: "100%", height: "100%", objectFit: "cover" }),
      ])
    : // "Blue bands, no photo" hiring-draft variant — neutral placeholder the
      // operator replaces with SC Boardwalk's own real photo at approval.
      h(
        "div",
        {
          display: "flex",
          flexGrow: 1,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#E9EEF2",
        },
        [
          h(
            "div",
            {
              display: "flex",
              fontFamily: "Poppins",
              fontWeight: 700,
              fontSize: "30px",
              letterSpacing: "3px",
              color: "#8CA0AE",
            },
            "ADD PHOTO"
          ),
        ]
      );

  const footer = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "14px",
      background: BLUE,
      padding: "40px 56px 48px",
    },
    [
      h(
        "div",
        {
          display: "flex",
          width: "100%",
          justifyContent: "center",
          textAlign: "center",
          fontFamily: "Poppins",
          fontWeight: 700,
          fontSize: "36px",
          lineHeight: 1.22,
          color: WHITE,
        },
        input.detailLine
      ),
      h(
        "div",
        { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "42px", color: WHITE },
        `Apply at ${APPLY_URL}`
      ),
      h(
        "div",
        { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "27px", color: "rgba(255,255,255,0.85)" },
        HANDLE
      ),
    ]
  );

  const root = h(
    "div",
    { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: BLUE },
    [header, photo, footer]
  );

  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

// ============================================================================
// Deterministic copy + photo prompt (no Gemini TEXT call — only the middle photo
// uses the image model). The headline is the open role; the photo is a NO-PEOPLE
// scene/equipment shot so it can never fabricate a uniform.
// ============================================================================

export type ScboardwalkSpec = {
  eyebrow: string;
  headline: string;
  detailLine: string;
  photoHint: string;
};

// Known roles → a concrete no-people scene. Anything else falls back to a
// generic "<role> tools & work environment" interpolation.
const ROLE_SCENES: Record<string, string> = {
  electrician:
    "an open electrical panel with neatly organized wiring and conduit, a voltage tester and hand tools resting beside it (or boardwalk string-lights being serviced at dusk)",
  "fiberglass technician":
    "a freshly sanded and primed fiberglass amusement-ride shell (a bumper-car or boat body) on sawhorses in a workshop, with sandpaper, resin, and brushes laid out",
  "fiberglass tech":
    "a freshly sanded fiberglass amusement-ride shell on sawhorses, with sandpaper, resin, and brushes laid out",
  controller:
    "a tidy office desk with an open laptop showing spreadsheets, a calculator, printed financial reports, and a coffee mug, with a sunny boardwalk visible through a window",
  "field technician":
    "amusement-ride machinery — gears, a motor, and a control box — with an open toolbox and wrenches laid out neatly",
  "field tech":
    "amusement-ride machinery with an open toolbox and wrenches laid out neatly",
  "grounds crew":
    "a spotless boardwalk at sunrise with a parked maintenance truck and grounds equipment (blower, rake, cart) nearby",
  "grounds crew (class b driver)":
    "a clean maintenance / box truck parked on the boardwalk at sunrise, grounds equipment nearby",
};

// "Now Hiring — Electrician" -> "Electrician"
function cleanRole(concept: string): string {
  return concept.replace(/^\s*now hiring\s*[—\-:]\s*/i, "").replace(/\s+/g, " ").trim() || "Crew";
}

export function buildScboardwalkSpec(concept: string | null): ScboardwalkSpec {
  const role = cleanRole(concept ?? "Crew");
  const hint =
    ROLE_SCENES[role.toLowerCase()] ??
    `the tools, equipment, and work environment of a ${role} at a seaside boardwalk amusement park (no people)`;
  return {
    eyebrow: "Now Hiring",
    headline: role,
    detailLine: "Flexible hours, great perks. Apply today!",
    photoHint: hint,
  };
}

export function buildScboardwalkPhotoPrompt(spec: ScboardwalkSpec): string {
  return [
    `A clean, professional, photorealistic photograph for a job-hiring social post: ${spec.photoHint}.`,
    `Warm golden-hour coastal light, with a beachfront amusement park and ferris wheel softly blurred far in the background.`,
    `Calm, well-composed, plenty of breathing room so it reads clearly as the centerpiece of a poster.`,
    `ABSOLUTELY NO people, faces, hands, or posed crew anywhere. NO uniforms, badges, lanyards, or branded clothing. NO text, words, letters, numbers, logos, or watermarks in the image.`,
  ].join(" ");
}
