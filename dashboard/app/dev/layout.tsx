import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, AuthError } from "@/lib/api-auth";

/**
 * /dev/* route group — admin-only system documentation.
 *
 * Pages here render the markdown files in `/docs` (architecture,
 * schema, flows) so non-engineering stakeholders can read them via
 * URL instead of cloning the repo. Locked to admin emails because
 * the diagrams expose internal architecture; non-admin signed-in
 * users (brand clients) get redirected to /no-access.
 *
 * Header nav at the top of every /dev page links to the three
 * documents so an admin can flip between them in one click.
 */
export default async function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth — proxy.ts also gates /dev/*, but this catches
  // any case where the proxy skips (e.g. local dev with auth off).
  try {
    const ctx = await requireUser();
    if (!ctx.isAdmin) redirect("/no-access");
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?next=/dev/architecture");
    throw err;
  }

  return (
    <div style={{ padding: "28px clamp(20px, 4vw, 56px) 64px" }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <nav
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "20px",
            marginBottom: "28px",
            flexWrap: "wrap",
            fontSize: "13px",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#c084fc",
              fontWeight: 600,
            }}
          >
            Dev docs
          </span>
          <span style={{ color: "#3a3a45" }}>·</span>
          <DevNavLink href="/dev/architecture" label="Architecture" />
          <DevNavLink href="/dev/schema" label="Schema" />
          <DevNavLink href="/dev/flows" label="Flows" />
          <DevNavLink href="/dev/app-map" label="App Map" />
        </nav>
        {children}
      </div>
    </div>
  );
}

function DevNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        color: "#bfbfcc",
        textDecoration: "none",
        fontWeight: 500,
        transition: "color 0.2s ease",
      }}
    >
      {label}
    </Link>
  );
}
