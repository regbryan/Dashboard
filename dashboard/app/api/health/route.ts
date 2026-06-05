// Public liveness endpoint for external uptime monitors. Intentionally
// minimal: confirms the app is serving, leaks nothing, touches no DB
// (a readiness/DB check would be an unauthenticated query surface). Listed
// in proxy.ts publicRoutes so monitors get 200 without auth.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok", service: "dashboard" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
