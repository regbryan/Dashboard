"use client";

import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton({
  className = "text-[13px] text-white/60 hover:text-white transition",
}: {
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const signOut = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button onClick={signOut} disabled={loading} className={className}>
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
