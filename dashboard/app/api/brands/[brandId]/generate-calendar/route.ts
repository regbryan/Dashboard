import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { generateCalendar } from "@/lib/autopilot/generate-calendar";

import { withRequestContext } from "@/lib/request-context";

// One Gemini text call authors the whole month (~13 slots). Cap at 120s.
export const maxDuration = 120;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  return withRequestContext(req, () => handlePOST(req, { params }));
}

async function handlePOST(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    await requireAdmin();
    const { brandId } = await params;

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
    }
    const body = (bodyJson ?? {}) as { year?: unknown; month?: unknown; notBefore?: unknown };
    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      return Response.json({ ok: false, error: "invalid year" }, { status: 400 });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return Response.json({ ok: false, error: "invalid month (1-12)" }, { status: 400 });
    }
    const notBefore =
      typeof body.notBefore === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.notBefore)
        ? body.notBefore
        : undefined;

    const summary = await generateCalendar(brandId, { year, month, notBefore });
    return Response.json(
      { ok: !summary.error, summary },
      { status: summary.error ? 400 : 200 }
    );
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
