"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg border border-dormant/30 hover:border-danger hover:text-danger px-4 py-2 text-dormant font-mono text-xs uppercase tracking-wider transition-all duration-300 font-semibold"
    >
      Sign out
    </button>
  );
}
