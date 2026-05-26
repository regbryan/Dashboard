/**
 * Build a public URL for an image in the `post-images` Supabase bucket.
 *
 * Pass `version` (typically `post.updated_at`) so the URL changes whenever
 * the row is updated — that busts both browser and CDN caches when an image
 * is re-uploaded for the same `file_path`. Without this, a refresh keeps
 * showing the previous version forever.
 *
 * Reads `NEXT_PUBLIC_SUPABASE_URL` lazily (per-call) instead of at module
 * load. That keeps `next build` from blowing up in CI when env vars aren't
 * configured yet — the function only throws if it's actually called with a
 * real filePath, which doesn't happen at build time.
 */
export function getImageUrl(
  brandId: string,
  filePath: string | null,
  version?: string | number | null
): string | null {
  if (!filePath) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "getImageUrl requires NEXT_PUBLIC_SUPABASE_URL"
    );
  }
  const base = `${supabaseUrl}/storage/v1/object/public/post-images/${brandId}/${filePath}`;
  if (version === undefined || version === null || version === "") return base;
  return `${base}?v=${encodeURIComponent(String(version))}`;
}
