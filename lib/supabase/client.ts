import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://cdhoxleeagkbtkdrtekv.supabase.co"),
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_9mdTPoYym8PBKuuOEIPzbw_C7EHAfEn")
  );
}
