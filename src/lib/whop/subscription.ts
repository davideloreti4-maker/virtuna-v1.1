import { createClient } from "@/lib/supabase/server";
import type { VirtunaTier } from "./config";

export async function getUserSubscription() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return data;
}

export async function getUserTier(): Promise<VirtunaTier> {
  const subscription = await getUserSubscription();
  return (subscription?.virtuna_tier as VirtunaTier) || "free";
}
