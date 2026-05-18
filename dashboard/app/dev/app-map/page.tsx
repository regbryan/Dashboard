import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const metadata = { title: "App Map · SocialPulse Dev Docs" };

/**
 * Interactive app map served as an auth-gated route. The viewer
 * itself is a self-contained vanilla-JS LiteGraph HTML file at
 * `docs/app-map/index.html` (ComfyUI-style canvas with nodes,
 * sidecar docs, and side panel).
 *
 * Why iframe srcDoc instead of /public static file: this dashboard's
 * dev surfaces are admin-gated by middleware. Files under /public
 * bypass middleware. Serving the HTML inline through this page lets
 * proxy.ts enforce the admin check before the viewer ever loads.
 *
 * Why sandbox: the HTML loads litegraph.js from a CDN inside the
 * iframe. `allow-scripts` is required for that; `allow-same-origin`
 * lets the iframe address the parent's color scheme without breaking
 * fetches. No `allow-popups` or `allow-forms` — the viewer doesn't
 * navigate or submit anything.
 */
export default async function AppMapPage() {
  const html = await fs.readFile(
    path.join(process.cwd(), "docs", "app-map", "index.html"),
    "utf-8"
  );

  return (
    <iframe
      title="SocialPulse App Map"
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      style={{
        width: "100%",
        height: "calc(100vh - 200px)",
        minHeight: "640px",
        border: "1px solid #1a1a2e",
        borderRadius: "12px",
        background: "#0a0a0a",
      }}
    />
  );
}
