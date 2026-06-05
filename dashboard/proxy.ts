import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin-emails";

export async function proxy(request: NextRequest) {
  // Stamp every request with a correlation ID. Vercel always sets
  // x-vercel-id; for local dev (and any path where x-vercel-id is
  // missing) we generate one. The ID is forwarded to the downstream
  // handler via rewritten request headers AND echoed back to the
  // client on the response so a user can quote it when reporting a
  // bug. Edge-runtime middleware can't use AsyncLocalStorage; route
  // handlers pick the ID up by wrapping their body in
  // withRequestContext() — see lib/request-context.ts.
  const incoming = request.headers.get("x-request-id");
  const vercel = request.headers.get("x-vercel-id");
  const requestId = incoming ?? vercel ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // Helper: every NextResponse this middleware returns gets the
  // x-request-id header. Centralized so we can't miss a return path.
  function tagged(res: NextResponse): NextResponse {
    res.headers.set("x-request-id", requestId);
    return res;
  }

  // Test-only bypass — Playwright sends a header that this branch
  // checks for, combined with a server-side secret that's only set
  // during test runs. Production never sees DASHBOARD_TEST_SECRET,
  // so the header alone proves nothing.
  //
  // The secret is generated per-run in playwright.config.ts and only
  // exists in the test process env; no committed value, no leak.
  if (process.env.DASHBOARD_TEST_SECRET) {
    const headerSecret = request.headers.get("x-dashboard-test-auth");
    if (headerSecret && headerSecret === process.env.DASHBOARD_TEST_SECRET) {
      return tagged(NextResponse.next({ request: { headers: requestHeaders } }));
    }
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes
  const publicRoutes = [
    "/login",
    "/auth/callback",
    "/auth/error",
    "/api/health", // public liveness probe for uptime monitors (no data, no DB)
    "/api/cron/", // Vercel Cron — gated by CRON_SECRET inside the route
    "/api/stripe/webhook", // Stripe — gated by webhook signature
    "/api/stripe/checkout", // unauthenticated buyers from marketing site
    "/api/socialpilot/callback", // SP OAuth bounce — admin already authed at /connect
  ];
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));

  if (isPublic) return tagged(supabaseResponse);

  // Not signed in
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return tagged(
        NextResponse.json({ error: "unauthorized" }, { status: 401 })
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return tagged(NextResponse.redirect(url));
  }

  const isAdmin = isAdminEmail(user.email);

  // Admin-only routes
  if (
    (pathname.startsWith("/dashboard") || pathname.startsWith("/dev")) &&
    !isAdmin
  ) {
    // Non-admin trying to reach /dashboard — redirect to their brand.
    // URL params are brand UUIDs (the pages query brands by id), so we route
    // straight to the brand_id without a slug indirection.
    const { data: access } = await supabase
      .from("user_brand_access")
      .select("brand_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const brandId = (access as { brand_id?: string } | null)?.brand_id;
    const url = request.nextUrl.clone();
    url.pathname = brandId ? `/client/${brandId}` : "/no-access";
    return tagged(NextResponse.redirect(url));
  }

  // Client routes — verify access to the requested brand.
  // URL param is the brand UUID (matches pages' .eq("id", brand) queries).
  if (pathname.startsWith("/client/")) {
    const brandId = pathname.split("/")[2];
    if (!isAdmin && brandId) {
      const { data: access } = await supabase
        .from("user_brand_access")
        .select("brand_id")
        .eq("user_id", user.id)
        .eq("brand_id", brandId)
        .maybeSingle();

      if (!access) {
        const url = request.nextUrl.clone();
        url.pathname = "/no-access";
        return tagged(NextResponse.redirect(url));
      }
    }
  }

  return tagged(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     * - api (handle auth internally)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
