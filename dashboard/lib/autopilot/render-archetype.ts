import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, FULL-BLEED IEC archetype renderer. The AI generates only a
// text-free PHOTO; this draws the navy / light-blue panel + all text in real
// fonts and embeds the photo, so the layout and copy are pixel-perfect and the
// design always fills the canvas edge-to-edge (no AI-invented frames/garble).
//
// Supports the two archetypes the IEC image posts use:
//   A — navy panel on top, photo on the bottom (color_block_photo_split)
//   C — photo on top, light-blue panel on the bottom (photo_top_light_block)

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 600 | 700 | 800; style: "normal" | "italic" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Oswald", data: f("oswald-600.woff"), weight: 600, style: "normal" },
      { name: "Poppins", data: f("poppins-700.woff"), weight: 700, style: "normal" },
      { name: "Poppins", data: f("poppins-800.woff"), weight: 800, style: "normal" },
      { name: "Montserrat", data: f("montserrat-700.woff"), weight: 700, style: "normal" },
      { name: "Playfair", data: f("playfair-700.woff"), weight: 700, style: "normal" },
      { name: "Playfair", data: f("playfair-700-italic.woff"), weight: 700, style: "italic" },
    ];
  }
  return fontsCache;
}

// IEC strict color contract.
const NAVY = "#104B94";
const LIGHT_BLUE = "#87ABCF";
const RED = "#DB222A";
const WHITE = "#FFFFFF";
const NEAR_BLACK = "#191518";
const EMPHASIS_ON_NAVY = "#A9C6E8"; // light-blue italic emphasis on navy

export type ArchetypeKey = "A" | "C";
export type HeadlineLine = { text: string; style: "sans" | "italic-serif" };
export type ArchetypeRenderInput = {
  archetype: ArchetypeKey;
  width?: number;
  height?: number;
  eyebrow?: { color?: "red" | "navy" | "light-blue"; text: string } | null;
  headlineLines: HeadlineLine[];
  body?: string | null;
  trust?: string | null;
  cta: string;
  photo: Buffer;
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({
  type,
  props: { style, children },
});

const PILL_BG: Record<string, string> = { red: RED, navy: NAVY, "light-blue": LIGHT_BLUE };

function panel(
  input: ArchetypeRenderInput,
  surface: "navy" | "light-blue",
  width: number
): El {
  const onNavy = surface === "navy";
  const headSans = onNavy ? WHITE : NAVY;
  const headItalic = onNavy ? EMPHASIS_ON_NAVY : NAVY;
  const bodyColor = onNavy ? "#E6EEF8" : NEAR_BLACK;
  const trustColor = onNavy ? WHITE : NAVY;
  const ctaPillBg = onNavy ? WHITE : NAVY;
  const ctaText = onNavy ? NAVY : WHITE;
  const pad = Math.round(width * 0.066);

  const children: El[] = [];

  if (input.eyebrow?.text) {
    const bg = PILL_BG[input.eyebrow.color ?? "red"] ?? RED;
    children.push(
      h(
        "div",
        {
          display: "flex",
          alignSelf: "flex-start",
          background: bg,
          color: WHITE,
          fontFamily: "Poppins",
          fontWeight: 800,
          fontSize: "26px",
          letterSpacing: "1.5px",
          padding: "12px 22px",
          borderRadius: "999px",
        },
        input.eyebrow.text.toUpperCase()
      )
    );
  }

  // Headline lines (bold sans + italic serif emphasis).
  children.push(
    h(
      "div",
      { display: "flex", flexDirection: "column", marginTop: "20px" },
      input.headlineLines.map((l) =>
        l.style === "italic-serif"
          ? h(
              "div",
              {
                display: "flex",
                fontFamily: "Playfair",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: "76px",
                lineHeight: 1.04,
                color: headItalic,
              },
              l.text
            )
          : h(
              "div",
              {
                display: "flex",
                fontFamily: "Oswald",
                fontWeight: 600,
                fontSize: "78px",
                lineHeight: 1.02,
                letterSpacing: "0.5px",
                color: headSans,
                textTransform: "uppercase",
              },
              l.text
            )
      )
    )
  );

  if (input.body?.trim()) {
    children.push(
      h(
        "div",
        {
          display: "flex",
          fontFamily: "Poppins",
          fontWeight: 700,
          fontSize: "30px",
          lineHeight: 1.32,
          color: bodyColor,
          marginTop: "24px",
          width: "92%",
        },
        input.body.trim()
      )
    );
  }

  if (input.trust?.trim()) {
    children.push(
      h(
        "div",
        {
          display: "flex",
          fontFamily: "Poppins",
          fontWeight: 700,
          fontSize: "26px",
          color: trustColor,
          marginTop: "22px",
        },
        input.trust.trim()
      )
    );
  }

  // CTA pill with a red arrow circle.
  children.push(
    h(
      "div",
      {
        display: "flex",
        alignItems: "center",
        alignSelf: "flex-start",
        background: ctaPillBg,
        borderRadius: "999px",
        padding: "16px 18px 16px 28px",
        marginTop: "30px",
        gap: "16px",
      },
      [
        h(
          "div",
          { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "30px", color: ctaText },
          input.cta
        ),
        h(
          "div",
          {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "999px",
            background: RED,
            color: WHITE,
            fontFamily: "Poppins",
            fontWeight: 800,
            fontSize: "28px",
          },
          "›"
        ),
      ]
    )
  );

  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      background: onNavy ? NAVY : LIGHT_BLUE,
      padding: `${pad}px`,
      width: "100%",
    },
    children
  );
}

export async function renderArchetypeDesign(input: ArchetypeRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;

  // Normalize the photo to a JPEG data URI Satori can embed.
  const jpeg = await sharp(input.photo).jpeg({ quality: 90 }).toBuffer();
  const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

  const surface: "navy" | "light-blue" = input.archetype === "A" ? "navy" : "light-blue";
  const panelEl = panel(input, surface, width);

  // Photo block (flex-grows to fill the remaining half), with a thin red seam.
  const photoBlock = h(
    "div",
    { display: "flex", flexGrow: 1, width: "100%" },
    [
      {
        type: "img",
        props: { src: dataUri, style: { width: "100%", height: "100%", objectFit: "cover" } },
      },
    ]
  );
  const seam = h("div", { display: "flex", width: "100%", height: "8px", background: RED }, []);

  const order =
    input.archetype === "A" ? [panelEl, seam, photoBlock] : [photoBlock, seam, panelEl];

  const root = h(
    "div",
    { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: NAVY },
    order
  );

  const svg = await satori(root as unknown as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: fonts(),
  });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}
