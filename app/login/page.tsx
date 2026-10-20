"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const signIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="loginShell">
      <section className="loginCard">
        <span className="kicker">CATCAPTION / ADMIN</span>
        <h1>Protected<br />control room.</h1>
        <p>
          Google sign-in is required. Only accounts marked as superadmin in the
          database can view users, manage AI-generated captions, and inspect ratings.
        </p>
        <button onClick={signIn}>Continue with Google →</button>
      </section>
    </main>
  );
}
