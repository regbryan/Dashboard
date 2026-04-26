import "server-only";
import { supabaseAdmin } from "./supabase-admin";

export async function getBrandClientEmails(brandId: string): Promise<string[]> {
  const sb = supabaseAdmin();
  const { data: rows } = await sb
    .from("user_brand_access")
    .select("user_id")
    .eq("brand_id", brandId)
    .eq("role", "client");

  const userIds = (rows ?? []).map((r) => r.user_id as string);
  if (!userIds.length) return [];

  const emails: string[] = [];
  for (const id of userIds) {
    const { data } = await sb.auth.admin.getUserById(id);
    const email = data?.user?.email;
    if (email) emails.push(email);
  }
  return emails;
}
