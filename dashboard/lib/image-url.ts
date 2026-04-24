const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function getImageUrl(brandId: string, filePath: string | null): string | null {
  if (!filePath) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/post-images/${brandId}/${filePath}`;
}
