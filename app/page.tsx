import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin) return { supabase, user, profile: null };
  return { supabase, user, profile };
}

export default async function AdminHome() {
  const { supabase, user, profile } = await requireAdmin();

  if (!profile) {
    return (
      <main className="denied">
        <section className="deniedCard">
          <span className="kicker">ACCESS DENIED</span>
          <h1>Not an admin.</h1>
          <p>This Google account is signed in, but profiles.is_superadmin is not TRUE.</p>
        </section>
      </main>
    );
  }

  const [{ data: profiles }, { data: captions }, { data: votes }, { data: memes }] = await Promise.all([
    supabase.from("profiles").select("id,created_at,first_name,last_name,avatar_url,is_superadmin").order("created_at", { ascending: false }),
    supabase.from("captions").select("id,created_at,meme_image_id,user_id,prompt,caption_text,meme_images(title),votes(vote)").order("created_at", { ascending: false }),
    supabase.from("votes").select("id,created_at,caption_id,user_id,vote,captions(caption_text)").order("created_at", { ascending: false }),
    supabase.from("meme_images").select("id,title,image_url").order("created_at", { ascending: true }),
  ]);

  const captionRows = (captions ?? []).map((caption: any) => ({
    ...caption,
    score: (caption.votes ?? []).reduce((sum: number, v: any) => sum + Number(v.vote || 0), 0),
  }));
  const upvotes = (votes ?? []).filter((v) => v.vote === 1).length;
  const downvotes = (votes ?? []).filter((v) => v.vote === -1).length;
  const topCaption = [...captionRows].sort((a: any, b: any) => b.score - a.score)[0];

  async function createCaption(formData: FormData) {
    "use server";
    const { supabase, user, profile } = await requireAdmin();
    if (!profile) throw new Error("Unauthorized");
    const memeImageId = String(formData.get("meme_image_id") ?? "");
    const captionText = String(formData.get("caption_text") ?? "").trim().slice(0, 240);
    const prompt = String(formData.get("prompt") ?? "Admin-created caption").trim().slice(0, 500);
    if (!memeImageId || !captionText) return;
    const { error } = await supabase.from("captions").insert({ meme_image_id: memeImageId, user_id: user.id, prompt, caption_text: captionText });
    if (error) throw new Error(error.message);
    revalidatePath("/");
  }

  async function updateCaption(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireAdmin();
    if (!profile) throw new Error("Unauthorized");
    const id = String(formData.get("id") ?? "");
    const captionText = String(formData.get("caption_text") ?? "").trim().slice(0, 240);
    const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 500);
    if (!id || !captionText) return;
    const { error } = await supabase.from("captions").update({ caption_text: captionText, prompt }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/");
  }

  async function deleteCaption(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireAdmin();
    if (!profile) throw new Error("Unauthorized");
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    const { error } = await supabase.from("captions").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/");
  }

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="adminShell">
      <header className="topbar">
        <div className="brand">CATCAPTION / ADMIN</div>
        <div className="topbarRight">
          <span>{user.email}</span>
          <form action={signOut}><button className="textBtn">Sign out</button></form>
        </div>
      </header>

      <section className="hero">
        <span className="kicker">WEEK 6 / ADMIN PANEL</span>
        <h1>See the system.<br/>Control the content.</h1>
        <p>Protected analytics and moderation for users, AI-generated captions, and community voting.</p>
      </section>

      <section className="content">
        <div className="stats">
          <div className="stat"><span>Profiles</span><strong>{profiles?.length ?? 0}</strong></div>
          <div className="stat"><span>AI captions</span><strong>{captionRows.length}</strong></div>
          <div className="stat"><span>Total ratings</span><strong>{votes?.length ?? 0}</strong></div>
          <div className="stat"><span>Upvote share</span><strong>{votes?.length ? Math.round((upvotes / votes.length) * 100) : 0}%</strong></div>
          <div className="stat"><span>Upvotes</span><strong>{upvotes}</strong></div>
          <div className="stat"><span>Downvotes</span><strong>{downvotes}</strong></div>
          <div className="stat wide"><span>Current top caption</span><strong>{topCaption ? `“${topCaption.caption_text}” · score ${topCaption.score}` : "No caption votes yet"}</strong></div>
        </div>

        <div className="grid">
          <section className="panel">
            <div className="panelHeader"><div><span className="kicker">READ</span><h2>Users / Profiles</h2><p>All profile records visible to the superadmin.</p></div></div>
            <div className="tableWrap"><table><thead><tr><th>Name</th><th>ID</th><th>Created</th><th>Role</th></tr></thead><tbody>
              {(profiles ?? []).map((p: any) => <tr key={p.id}><td>{[p.first_name,p.last_name].filter(Boolean).join(" ") || "Unnamed user"}</td><td className="small">{p.id}</td><td>{new Date(p.created_at).toLocaleDateString()}</td><td>{p.is_superadmin ? "Superadmin" : "User"}</td></tr>)}
            </tbody></table></div>
          </section>

          <section className="panel">
            <div className="panelHeader"><div><span className="kicker">CREATE / READ / UPDATE / DELETE</span><h2>AI-generated captions</h2><p>Manage the media users rate in the main app.</p></div></div>
            <form className="createForm" action={createCaption}>
              <select name="meme_image_id" required defaultValue=""><option value="" disabled>Choose meme</option>{(memes ?? []).map((m: any) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
              <input name="caption_text" placeholder="New caption text" required/>
              <input name="prompt" placeholder="Generation prompt / admin note"/>
              <button className="primary">Create</button>
            </form>
            <div className="tableWrap"><table><thead><tr><th>Meme</th><th>Caption / Prompt</th><th>Score</th><th>Manage</th></tr></thead><tbody>
              {captionRows.map((c: any) => <tr key={c.id}><td>{c.meme_images?.title ?? "Unknown"}</td><td><form className="inlineEdit" action={updateCaption}><input type="hidden" name="id" value={c.id}/><input name="caption_text" defaultValue={c.caption_text}/><input name="prompt" defaultValue={c.prompt}/><button className="primary">Update</button><span className="small">{new Date(c.created_at).toLocaleDateString()}</span></form></td><td><strong>{c.score >= 0 ? "+" : ""}{c.score}</strong></td><td><form action={deleteCaption}><input type="hidden" name="id" value={c.id}/><button className="danger">Delete</button></form></td></tr>)}
            </tbody></table></div>
          </section>

          <section className="panel">
            <div className="panelHeader"><div><span className="kicker">READ</span><h2>Upvotes / Downvotes</h2><p>Inspect rating behavior without allowing admins to rewrite votes.</p></div></div>
            <div className="tableWrap"><table><thead><tr><th>Vote</th><th>Caption</th><th>User ID</th><th>Created</th></tr></thead><tbody>
              {(votes ?? []).map((v: any) => <tr key={v.id}><td><strong>{v.vote === 1 ? "↑ Upvote" : "↓ Downvote"}</strong></td><td>{v.captions?.caption_text ?? "Deleted caption"}</td><td className="small">{v.user_id}</td><td>{new Date(v.created_at).toLocaleString()}</td></tr>)}
            </tbody></table></div>
          </section>
        </div>
      </section>
    </main>
  );
}
