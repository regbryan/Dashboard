import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminEmail } from "./admin-emails";

export type AuthedClient = SupabaseClient;

export interface AuthContext {
  user: User;
  supabase: AuthedClient;
  isAdmin: boolean;
}

export class AuthError extends Error {
  constructor(public status: number, public body: { error: string }) {
    super(body.error);
  }
}

async function buildClient(): Promise<AuthedClient> {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            );
          } catch {
            // called from a server component — middleware refreshes sessions
          }
        },
      },
    }
  );
}

export async function requireUser(): Promise<AuthContext> {
  const supabase = await buildClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AuthError(401, { error: "unauthorized" });
  }
  const isAdmin = isAdminEmail(user.email);
  return { user, supabase, isAdmin };
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (!ctx.isAdmin) {
    throw new AuthError(403, { error: "forbidden" });
  }
  return ctx;
}

export async function requireBrandAccess(brandId: string): Promise<AuthContext> {
  const ctx = await requireUser();
  if (ctx.isAdmin) return ctx;

  const { data } = await ctx.supabase
    .from("user_brand_access")
    .select("brand_id")
    .eq("user_id", ctx.user.id)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (!data) {
    throw new AuthError(403, { error: "forbidden" });
  }
  return ctx;
}

export async function requirePostAccess(postId: number | string): Promise<{
  ctx: AuthContext;
  brandId: string;
}> {
  const ctx = await requireUser();
  const { data: post } = await ctx.supabase
    .from("posts")
    .select("brand_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    throw new AuthError(404, { error: "post not found" });
  }

  const brandId = (post as { brand_id: string }).brand_id;
  if (ctx.isAdmin) return { ctx, brandId };

  const { data: access } = await ctx.supabase
    .from("user_brand_access")
    .select("brand_id")
    .eq("user_id", ctx.user.id)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (!access) {
    throw new AuthError(403, { error: "forbidden" });
  }
  return { ctx, brandId };
}

export function handleAuthError(err: unknown): Response | null {
  if (err instanceof AuthError) {
    return Response.json(err.body, { status: err.status });
  }
  return null;
}
