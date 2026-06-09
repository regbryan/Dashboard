import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Remotion + its esbuild dep can't be bundled. esbuild ships
  // platform-specific binaries under optional deps (@esbuild/linux-x64,
  // @esbuild/darwin-arm64, etc.), and Turbopack chokes trying to parse
  // README.md files inside those packages. The render-reel route at
  // /api/render-reel lazy-imports @remotion/bundler + @remotion/renderer
  // at runtime; marking them external keeps them as Node `require()`s
  // instead of build-time bundling, so the build doesn't try to
  // resolve the platform-mismatched binaries.
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-linux-arm64-gnu",
    "@remotion/compositor-linux-arm64-musl",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-win32-x64-msvc",
    "esbuild",
    // Native binaries — keep as runtime require()s, don't bundle.
    "@resvg/resvg-js",
    "sharp",
  ],
  // The Satori designed-graphic render reads bundled .woff fonts at runtime;
  // force them into the serverless functions that call generateBrandPost.
  outputFileTracingIncludes: {
    "/api/posts/[id]/regenerate": [
      "./lib/autopilot/fonts/**",
      "./lib/autopilot/brand-templates/**",
    ],
    "/api/cron/autopilot-generate": [
      "./lib/autopilot/fonts/**",
      "./lib/autopilot/brand-templates/**",
    ],
    // The footer overlay (lib/overlay-footer.ts) renders compliance text with
    // sharp/Pango and needs a bundled font at runtime — serverless has no
    // system fonts. Force the font into this route's lambda.
    "/api/run-script": ["./lib/autopilot/fonts/**"],
  },
  // Baseline security headers on every response. Intentionally NO strict
  // script-src/style-src CSP: the app uses inline styles throughout plus
  // Sentry/Stripe/Google, which a tight CSP would break. We set the
  // high-value, zero-risk headers — clickjacking (frame-ancestors +
  // X-Frame-Options), MIME sniffing, referrer leakage, feature access,
  // and HSTS. A full CSP can be layered in later behind report-only.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

// Wrap with Sentry so errors auto-ship to the configured project.
// All Sentry behavior is gated by NEXT_PUBLIC_SENTRY_DSN being set;
// when unset, the SDK is a no-op and the build still works without
// SENTRY_AUTH_TOKEN. Source-map upload only fires when both DSN and
// SENTRY_AUTH_TOKEN are present (production builds in Vercel).
export default withSentryConfig(nextConfig, {
  // Org + project slug. Override per-env via SENTRY_ORG / SENTRY_PROJECT.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Silent unless we're in CI (where logs help debug source-map upload).
  silent: !process.env.CI,
  // Upload all client bundles to Sentry for source-map symbolication,
  // not just the ones that import @sentry/* directly.
  widenClientFileUpload: true,
  // Strip uploaded source-map files from the deployed bundle so the
  // public asset directory doesn't leak source code (Sentry has the
  // maps server-side for symbolication).
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  // Tunnel client-side ingest requests through this Next.js route to
  // bypass ad blockers that filter sentry.io. Safe to leave even
  // without a DSN (the route just no-ops).
  tunnelRoute: "/monitoring",
});
