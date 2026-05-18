import { createSupabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { withRequestContext } from "@/lib/request-context";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return withRequestContext(request, () => handleGET(request));
}

async function handleGET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/dashboard";

  if (error) {
    logger.error("auth/callback", "provider error", { error, errorDescription });
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error)}&desc=${encodeURIComponent(errorDescription || "")}`
    );
  }

  if (!code) {
    logger.error("auth/callback", "no code in request");
    return NextResponse.redirect(`${origin}/auth/error?reason=no_code`);
  }

  const supabase = await createSupabaseServer();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logger.error("auth/callback", "exchangeCodeForSession failed", { err: exchangeError });
    return NextResponse.redirect(
      `${origin}/auth/error?reason=exchange_failed&desc=${encodeURIComponent(exchangeError.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
