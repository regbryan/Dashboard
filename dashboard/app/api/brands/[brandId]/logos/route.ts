import { requireBrandAccess, handleAuthError } from "@/lib/api-auth";

// List all logo variants for a brand. Used by LogoOverlayPanel's picker.
// Returns each variant with a public preview URL (Supabase storage) plus
// the row id so the apply call can reference the exact variant chosen.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const ctx = await requireBrandAccess(brandId);

    const { data, error } = await ctx.supabase
      .from("brand_logos")
      .select("id, label, storage_path, is_default")
      .eq("brand_id", brandId)
      .order("is_default", { ascending: false })
      .order("label", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const logos = (data ?? []).map((row) => {
      const r = row as {
        id: string;
        label: string;
        storage_path: string;
        is_default: boolean;
      };
      // Storage paths can contain spaces; encode each segment so the public
      // URL is fetchable. Don't encode forward slashes.
      const encoded = r.storage_path
        .split("/")
        .map((seg) => encodeURIComponent(seg))
        .join("/");
      return {
        id: r.id,
        label: r.label,
        isDefault: r.is_default,
        previewUrl: supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/post-images/${encoded}`
          : null,
      };
    });

    return Response.json({ logos });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
