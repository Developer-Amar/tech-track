import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileTerminal from "@/components/profile-terminal";

export default async function CompleteProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If profile is already complete, skip straight to dashboard
  const { data: profile } = await supabase
    .from("users")
    .select("profile_completed, name, email")
    .eq("id", user.id)
    .single();

  if (profile?.profile_completed) {
    redirect("/dashboard");
  }

  return (
    <ProfileTerminal
      name={profile?.name ?? user.user_metadata?.full_name ?? ""}
      email={profile?.email ?? user.email ?? ""}
    />
  );
}
