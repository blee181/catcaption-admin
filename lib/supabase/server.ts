import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY } from "./client";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
