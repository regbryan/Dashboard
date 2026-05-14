import type { MetadataRoute } from "next";

/**
 * The dashboard is an auth-gated client portal — nothing here should
 * surface in search. Disallow all crawlers across all paths.
 *
 * Lighthouse SEO audit was flagging the missing robots.txt; this is
 * the proper response for a private app.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
