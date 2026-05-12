import "server-only";

// Direct Gemini REST client for image generation. Replaces the nanobanana MCP
// path so this runs server-side on Vercel without a local Claude session.
//
// Model is configurable via GEMINI_IMAGE_MODEL — defaults to the current
// Gemini image-capable model. As of writing, "gemini-2.5-flash-image" is the
// public image-generation model; "nano banana 2" / Gemini 3.x variants can
// be selected through the env var when generally available.

const ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

export type GenerateImageInput = {
  prompt: string;
  // Square 1:1 Instagram post by default. Reels / portrait can pass "9:16".
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
};

export type GenerateImageResult =
  | { ok: true; bytes: Buffer; mimeType: string; model: string }
  | { ok: false; error: string };

export async function generateImage(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY not set" };
  }

  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const url = `${ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: input.prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(input.aspectRatio
        ? { imageConfig: { aspectRatio: input.aspectRatio } }
        : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      error: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Gemini ${res.status}: ${text.slice(0, 500)}`,
    };
  }

  type Part = { inlineData?: { mimeType?: string; data?: string } };
  type Candidate = { content?: { parts?: Part[] } };
  let json: { candidates?: Candidate[] };
  try {
    json = (await res.json()) as { candidates?: Candidate[] };
  } catch {
    return { ok: false, error: "Gemini returned non-JSON" };
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  const data = imagePart?.inlineData?.data;
  const mimeType = imagePart?.inlineData?.mimeType ?? "image/png";
  if (!data) {
    return { ok: false, error: "No inlineData image in Gemini response" };
  }

  return {
    ok: true,
    bytes: Buffer.from(data, "base64"),
    mimeType,
    model,
  };
}
