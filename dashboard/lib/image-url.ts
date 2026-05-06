const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Build a public URL for an image in the `post-images` Supabase bucket.
 *
 * Pass `version` (typically `post.updated_at`) so the URL changes whenever
 * the row is updated — that busts both browser and CDN caches when an image
 * is re-uploaded for the same `file_path`. Without this, a refresh keeps
 * showing the previous version forever.
 */
export function getImageUrl(
  brandId: string,
  filePath: string | null,
  version?: string | number | null
): string | null {
  if (!filePath) return null;
  const base = `${SUPABASE_URL}/storage/v1/object/public/post-images/${brandId}/${filePath}`;
  if (version === undefined || version === null || version === "") return base;
  return `${base}?v=${encodeURIComponent(String(version))}`;
}
