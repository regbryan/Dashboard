import type { Metadata } from "next";
import { Anton, Plus_Jakarta_Sans } from "next/font/google";
import { createSupabaseServer } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SocialPulse · Client Dashboard",
  description: "Review and approve your content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${anton.variable} ${jakarta.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <nav
          className="sticky top-0 z-50 flex items-center justify-between"
          style={{
            backgroundColor: "rgba(7,7,14,0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid #1a1a2e",
            padding: "14px clamp(20px, 4vw, 40px)",
          }}
        >
          <a
            href="/dashboard"
            style={{
              color: "white",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              textDecoration: "none",
            }}
          >
            SocialPulse
          </a>
          {user && (
            <div className="flex items-center" style={{ gap: "16px", fontSize: "13px" }}>
              <span
                className="hidden sm:inline"
                style={{ color: "#9999a6" }}
              >
                {user.email}
              </span>
              <SignOutButton />
            </div>
          )}
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
