import type { NextConfig } from "next";

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
  ],
};

export default nextConfig;
