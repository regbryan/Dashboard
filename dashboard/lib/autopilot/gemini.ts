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
  // Override the model for this call (e.g. the pro image model for the
  // archetype path). Falls back to GEMINI_IMAGE_MODEL, then the flash default.
  model?: string;
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

  const model =
    input.model || process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const url = `${ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  // imageConfig carries the aspect ratio and, where the model supports it, an
  // image size (e.g. "2K" on the pro image model). imageSize is opt-in via env
  // so we don't send an unknown field to models that reject it.
  const imageSize = process.env.GEMINI_IMAGE_SIZE; // e.g. "1K" | "2K" | "4K"
  const imageConfig: Record<string, string> = {};
  if (input.aspectRatio) imageConfig.aspectRatio = input.aspectRatio;
  if (imageSize) imageConfig.imageSize = imageSize;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: input.prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
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
    // Surface the exact Google API error (model not found, no access, quota /
    // out-of-tokens, etc.) in the serverless logs for diagnosis.
    console.error(`[gemini] image model "${model}" -> HTTP ${res.status}: ${text.slice(0, 400)}`);
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
