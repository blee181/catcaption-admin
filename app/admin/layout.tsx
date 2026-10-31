import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "./admin.css";

const groups = [
  ["OVERVIEW", [["/admin", "Overview"]]],
  [
    "CONTENT",
    [
      ["/admin/users", "Users"],
      ["/admin/media", "AI Media"],
      ["/admin/images", "Images"],
      ["/admin/votes", "Votes"],
    ],
  ],
  [
    "PROMPTS",
    [
      ["/admin/prompt-chains", "Prompt chains"],
      ["/admin/chain-steps", "Chain steps"],
      ["/admin/chain-mix", "Chain mix"],
      ["/admin/terms", "Terms"],
      ["/admin/examples", "Generation examples"],
    ],
  ],
  [
    "AI ACTIVITY",
    [
      ["/admin/generation-requests", "Generation requests"],
      ["/admin/llm-responses", "LLM responses"],
    ],
  ],
  [
    "MODELS",
    [
      ["/admin/models", "LLM models"],
      ["/admin/providers", "LLM providers"],
    ],
  ],
  [
    "ACCESS",
    [
      ["/admin/domains", "Signup domains"],
      ["/admin/whitelist", "Whitelisted emails"],
    ],
  ],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  const { data: ownerAccess } = await supabase.rpc("is_project_owner");

  if (!profile?.is_superadmin && !ownerAccess) {
    redirect("/unauthorized");
  }

  return (
    <div className="adminFrame">
      <aside className="adminSidebar">
        <div className="adminBrand">
          <div className="brandMark">cc</div>

          <div>
            <strong>CATCAPTION</strong>
            <span>Admin</span>
          </div>
        </div>

        <nav>
          {groups.map(([section, items]) => (
            <div className="navGroup" key={section}>
              <div className="navSection">
                {section}
              </div>

              {items.map(([href, label]) => (
                <Link
                  className="navLink"
                  key={href}
                  href={href}
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="adminAccount">
          <span>Signed in as</span>
          <strong>{user.email}</strong>
        </div>
      </aside>

      <main className="adminMain">
        {children}
      </main>
    </div>
  );
}
