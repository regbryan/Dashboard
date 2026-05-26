import path from "node:path";

/**
 * Resolve the Instagram Automation project root for local-only
 * filesystem ops (logo serving, hyperframes templates, .renders).
 *
 * Strictly env-driven — NO process.cwd() fallback. Previously we
 * had one, but Turbopack's NFT tracer treats any process.cwd() in a
 * module that's imported by a route as a signal to bundle the entire
 * project. The result was a multi-megabyte serverless function for
 * every route that touched this file.
 *
 * Set PROJECT_ROOT in .env.local for development. Routes that depend
 * on this are all dev-gated (NODE_ENV !== 'production' or
 * ENABLE_LOCAL_SCRIPTS !== '1'), so production deploys never hit this
 * code path — a missing env in production correctly throws on first
 * call rather than silently bundling the wrong root.
 */
export function getProjectRoot(): string {
  // Production guard: these routes are dev-only by design (logos +
  // hyperframes templates live on disk in the local checkout, not on
  // Vercel). Refuse to operate in prod even if someone sets the env —
  // the data won't be where it claims to be, and silent fallthrough
  // would mask the misconfiguration.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_LOCAL_SCRIPTS !== "1"
  ) {
    throw new Error(
      "Filesystem-backed paths are dev-only. Set ENABLE_LOCAL_SCRIPTS=1 " +
        "only if you've mounted the Instagram Automation checkout at " +
        "PROJECT_ROOT on the deployment host."
    );
  }

  const root = process.env.PROJECT_ROOT;
  if (!root) {
    throw new Error(
      "PROJECT_ROOT env var is not set. Add it to .env.local; these " +
        "filesystem-backed routes are dev-only and need an absolute path " +
        "to the Instagram Automation checkout."
    );
  }
  return root;
}

export function brandFolderPath(folderPath: string): string {
  return path.join(getProjectRoot(), folderPath);
}
