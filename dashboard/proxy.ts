import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_EMAILS = [
  "reggie@inspiredideationstrategies.com",
  "reggieebryant@gmail.com",
  "courtney@workbyccmarketing.com",
];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
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
    "/api/cron/", // Vercel Cron — gated by CRON_SECRET inside the route
    "/api/stripe/webhook", // Stripe — gated by webhook signature
    "/api/stripe/checkout", // unauthenticated buyers from marketing site
    "/api/socialpilot/callback", // SP OAuth bounce — admin already authed at /connect
  ];
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));

  if (isPublic) return supabaseResponse;

  // Not signed in
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const isAdmin = !!user.email && ADMIN_EMAILS.includes(user.email);

  // Admin-only routes
  if (pathname.startsWith("/dashboard") && !isAdmin) {
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
    return NextResponse.redirect(url);
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
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
