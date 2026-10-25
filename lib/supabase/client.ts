import { createBrowserClient } from "@supabase/ssr";

export const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://cdhoxleeagkbtkdrtekv.supabase.co";
export const PUBLIC_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_9mdTPoYym8PBKuuOEIPzbw_C7EHAfEn";

export function createClient() {
  return createBrowserClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_KEY
  );
}
