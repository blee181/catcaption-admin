import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Config = {
  title: string;
  subtitle: string;
  table: string;
  mode: "read" | "crud" | "mix" | "media" | "votes" | "images";
  fields?: { key: string; label: string; type?: "text" | "number" | "boolean" }[];
  select?: string;
};

const configs: Record<string, Config> = {
  users: {
    title: "Users",
    subtitle: "Read profiles and admin roles.",
    table: "profiles",
    mode: "read",
    select: "id,created_at,first_name,last_name,is_superadmin",
    fields: [
      { key: "first_name", label: "First name" },
      { key: "last_name", label: "Last name" },
      { key: "id", label: "Profile ID" },
      { key: "is_superadmin", label: "Role" },
      { key: "created_at", label: "Joined" },
    ],
  },
  images: { title: "Images", subtitle: "Upload and manage meme images used by the caption app.", table: "meme_images", mode: "images" },
  media: {
    title: "AI Media",
    subtitle: "View generated captions and their meme templates.",
    table: "captions",
    mode: "media",
  },
  votes: {
    title: "Votes",
    subtitle: "Read upvotes and downvotes from the rating app.",
    table: "votes",
    mode: "votes",
  },
  "prompt-chains": {
    title: "Prompt chains",
    subtitle: "Read configured prompt chains.",
    table: "prompt_chains",
    mode: "read",
    fields: [
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
      { key: "created_at", label: "Created" },
    ],
  },
  "chain-steps": {
    title: "Chain steps",
    subtitle: "Read the ordered steps in each prompt chain.",
    table: "prompt_chain_steps",
    mode: "read",
    select: "id,step_order,name,prompt_template,created_at,prompt_chains(name)",
    fields: [
      { key: "chain_name", label: "Chain" },
      { key: "step_order", label: "Order" },
      { key: "name", label: "Step" },
      { key: "prompt_template", label: "Prompt template" },
    ],
  },
  "chain-mix": {
    title: "Chain mix",
    subtitle: "Read and update prompt-chain weights.",
    table: "prompt_chain_mix",
    mode: "mix",
  },
  terms: {
    title: "Terms",
    subtitle: "Create, read, update, and delete prompt vocabulary.",
    table: "terms",
    mode: "crud",
    fields: [
      { key: "term", label: "Term" },
      { key: "category", label: "Category" },
      { key: "definition", label: "Definition" },
    ],
  },
  examples: {
    title: "Generation examples",
    subtitle: "CRUD examples used to steer and evaluate AI output.",
    table: "ai_generation_examples",
    mode: "crud",
    fields: [
      { key: "title", label: "Title" },
      { key: "input_text", label: "Input" },
      { key: "expected_output", label: "Expected output" },
      { key: "notes", label: "Notes" },
    ],
  },
  "generation-requests": {
    title: "Generation requests",
    subtitle: "Read generation jobs and status.",
    table: "generation_requests",
    mode: "read",
    select: "id,status,input_text,created_at,prompt_chains(name),llm_models(name)",
    fields: [
      { key: "status", label: "Status" },
      { key: "chain_name", label: "Prompt chain" },
      { key: "model_name", label: "Model" },
      { key: "input_text", label: "Input" },
      { key: "created_at", label: "Created" },
    ],
  },
  "llm-responses": {
    title: "LLM responses",
    subtitle: "Read response text, latency, and token usage.",
    table: "llm_responses",
    mode: "read",
    select: "id,output_text,latency_ms,token_count,created_at,llm_models(name)",
    fields: [
      { key: "model_name", label: "Model" },
      { key: "output_text", label: "Response" },
      { key: "latency_ms", label: "Latency (ms)" },
      { key: "token_count", label: "Tokens" },
      { key: "created_at", label: "Created" },
    ],
  },
  models: {
    title: "LLM models",
    subtitle: "CRUD models available to generation.",
    table: "llm_models",
    mode: "crud",
    fields: [
      { key: "name", label: "Model" },
      { key: "model_key", label: "Model key" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  providers: {
    title: "LLM providers",
    subtitle: "CRUD provider configuration.",
    table: "llm_providers",
    mode: "crud",
    fields: [
      { key: "name", label: "Provider" },
      { key: "base_url", label: "Base URL" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  domains: {
    title: "Signup domains",
    subtitle: "CRUD domains allowed to create accounts.",
    table: "allowed_signup_domains",
    mode: "crud",
    fields: [
      { key: "domain", label: "Domain" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  whitelist: {
    title: "Whitelisted emails",
    subtitle: "CRUD address-level signup exceptions.",
    table: "whitelisted_emails",
    mode: "crud",
    fields: [
      { key: "email", label: "E-mail" },
      { key: "note", label: "Note" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
};

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).single();
  const { data: ownerAccess } = await supabase.rpc("is_project_owner");
  if (!profile?.is_superadmin && !ownerAccess) throw new Error("Unauthorized");
  return supabase;
}

function normalize(row: any) {
  return {
    ...row,
    chain_name: row.prompt_chains?.name ?? "",
    model_name: row.llm_models?.name ?? "",
  };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const config = configs[section];
  if (!config) notFound();
  const supabase = await assertAdmin();


  if (section === "users") {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data: users, error } = await supabase.from("profiles")
      .select("id,first_name,last_name,created_at,is_superadmin")
      .order("created_at", { ascending: false });

    async function setRole(fd: FormData) {
      "use server";
      const db = await assertAdmin();
      const userId = String(fd.get("user_id") || "");
      const grantAdmin = fd.get("grant_admin") === "true";
      const { error: roleError } = await db.rpc("set_admin_role", {
        target_user_id: userId,
        grant_admin: grantAdmin,
      });
      if (roleError) throw new Error(roleError.message);
      revalidatePath("/admin/users");
    }

    return <PageShell title="Users & admin access" subtitle="Manage who can access the independent CATCAPTION admin dashboard. Only existing admins can change roles.">
      {error && <div className="createBox">Error loading users: {error.message}</div>}
      <div className="dataCard">
        <table className="adminTable">
          <thead><tr><th>User</th><th>User ID</th><th>Joined</th><th>Access</th><th>Manage role</th></tr></thead>
          <tbody>{(users ?? []).map((u) => <tr key={u.id}>
            <td>{[u.first_name,u.last_name].filter(Boolean).join(" ") || "Unnamed user"}</td>
            <td className="mono">{u.id}</td>
            <td>{u.created_at ? new Date(u.created_at).toLocaleString() : "—"}</td>
            <td><span className="scorePill">{u.is_superadmin ? "Admin" : "User"}</span></td>
            <td><form action={setRole} className="rowForm">
              <input type="hidden" name="user_id" value={u.id} />
              <input type="hidden" name="grant_admin" value={u.is_superadmin ? "false" : "true"} />
              <button className={u.is_superadmin ? "softButton" : "orangeButton"} disabled={u.id === currentUser?.id && u.is_superadmin}>
                {u.is_superadmin ? (u.id === currentUser?.id ? "Your account" : "Remove admin") : "Make admin"}
              </button>
            </form></td>
          </tr>)}</tbody>
        </table>
      </div>
    </PageShell>;
  }

  if (config.mode === "images") {
    const { data: images, error: imageError } = await supabase.from("meme_images").select("id,title,description,image_url,created_at").order("created_at", {ascending:false});
    async function createImage(fd: FormData) {
      "use server";
      const db=await assertAdmin();
      const file=fd.get("file");
      let imageUrl=String(fd.get("image_url")||"").trim();
      if (file instanceof File && file.size>0) {
        if (!file.type.startsWith("image/") || file.size>5*1024*1024) throw new Error("Please upload an image under 5 MB.");
        const name=crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_");
        const uploaded=await db.storage.from("admin-meme-images").upload(name,await file.arrayBuffer(),{contentType:file.type,upsert:false});
        if (uploaded.error) throw new Error(uploaded.error.message);
        imageUrl=db.storage.from("admin-meme-images").getPublicUrl(name).data.publicUrl;
      }
      if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) throw new Error("Upload an image or provide a valid image URL.");
      const {error}=await db.from("meme_images").insert({title:String(fd.get("title")||"").trim(),description:String(fd.get("description")||"").trim(),image_url:imageUrl});
      if(error) throw new Error(error.message);
      revalidatePath("/admin/images");
    }
    async function updateImage(fd: FormData) {
      "use server";
      const db=await assertAdmin();
      const id=String(fd.get("id"));
      const {error}=await db.from("meme_images").update({title:String(fd.get("title")||"").trim(),description:String(fd.get("description")||"").trim()}).eq("id",id);
      if(error) throw new Error(error.message);
      revalidatePath("/admin/images");
    }
    async function deleteImage(fd: FormData) {
      "use server";
      const db=await assertAdmin();
      const id=String(fd.get("id"));
      const {error}=await db.from("meme_images").delete().eq("id",id);
      if(error) throw new Error(error.message);
      revalidatePath("/admin/images");
    }
    return <PageShell title="Images" subtitle="Upload, edit, and delete meme templates used in CATCAPTION.">
      <section className="createBox"><span className="eyebrow">ADD IMAGE</span><h2>New meme template</h2>
      <form action={createImage} className="createGrid">
        <input name="title" placeholder="Image title" required />
        <input name="description" placeholder="Description" />
        <input name="image_url" type="url" placeholder="Image URL (or upload a file)" />
        <input name="file" type="file" accept="image/*" />
        <button className="orangeButton">Upload / Create</button>
      </form></section>
      {imageError && <div className="createBox">Error loading images: {imageError.message}</div>}
      <div className="mediaCards">{(images??[]).map(row=><article className="mediaAdminCard" key={row.id}>
        <img src={row.image_url} alt={row.title} />
        <div className="mediaAdminBody"><form action={updateImage} className="rowForm">
          <input type="hidden" name="id" value={row.id}/><input name="title" defaultValue={row.title} required/><input name="description" defaultValue={row.description||""}/>
          <button className="softButton">Save changes</button>
        </form><p className="mono">{row.id}</p><form action={deleteImage}><input type="hidden" name="id" value={row.id}/><button className="deleteButton">Delete image</button></form></div>
      </article>)}</div>
      {!images?.length && <div className="emptyState">No images found.</div>}
    </PageShell>;
  }

  if (config.mode === "media") {
    const { data } = await supabase
      .from("captions")
      .select("id,created_at,caption_text,prompt,meme_images(title,image_url),votes(vote)")
      .order("created_at", { ascending: false });
    const rows = (data ?? []).map((r: any) => ({
      ...r,
      score: (r.votes ?? []).reduce((s: number, v: any) => s + Number(v.vote || 0), 0),
    }));
    return (
      <PageShell title={config.title} subtitle={config.subtitle}>
        <div className="mediaCards">
          {rows.map((row: any) => (
            <article className="mediaAdminCard" key={row.id}>
              {row.meme_images?.image_url ? <img src={row.meme_images.image_url} alt={row.meme_images?.title ?? "Meme"} /> : <div className="mediaPlaceholder">AI</div>}
              <div className="mediaAdminBody">
                <span className="eyebrow">{row.meme_images?.title ?? "Meme"}</span>
                <h3>{row.caption_text}</h3>
                <p>{row.prompt || "No prompt stored"}</p>
                <div className="scorePill">Net score {row.score >= 0 ? "+" : ""}{row.score}</div>
              </div>
            </article>
          ))}
        </div>
      </PageShell>
    );
  }

  if (config.mode === "votes") {
    const { data } = await supabase
      .from("votes")
      .select("id,created_at,user_id,vote,captions(caption_text)")
      .order("created_at", { ascending: false });
    return (
      <PageShell title={config.title} subtitle={config.subtitle}>
        <div className="dataCard">
          <table className="adminTable">
            <thead><tr><th>Vote</th><th>Caption</th><th>User ID</th><th>Created</th></tr></thead>
            <tbody>
              {(data ?? []).map((row: any) => (
                <tr key={row.id}>
                  <td><span className={row.vote === 1 ? "voteUp" : "voteDown"}>{row.vote === 1 ? "↑ Upvote" : "↓ Downvote"}</span></td>
                  <td>{row.captions?.caption_text ?? "—"}</td>
                  <td className="mono">{row.user_id}</td>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageShell>
    );
  }

  if (config.mode === "mix") {
    const { data } = await supabase.from("prompt_chain_mix").select("id,weight,enabled,updated_at,prompt_chains(name)").order("updated_at", { ascending: false });

    async function updateMix(fd: FormData) {
      "use server";
      const db = await assertAdmin();
      const id = String(fd.get("id"));
      const { error } = await db.from("prompt_chain_mix").update({
        weight: Number(fd.get("weight") ?? 0),
        enabled: fd.get("enabled") === "on",
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw new Error(error.message);
      revalidatePath("/admin/chain-mix");
    }

    return (
      <PageShell title={config.title} subtitle={config.subtitle}>
        <div className="dataCard">
          <table className="adminTable">
            <thead><tr><th>Chain</th><th>Weight</th><th>Enabled</th><th>Action</th></tr></thead>
            <tbody>
              {(data ?? []).map((row: any) => (
                <tr key={row.id}>
                  <td>{row.prompt_chains?.name ?? "—"}</td>
                  <td colSpan={3}>
                    <form action={updateMix} className="rowForm">
                      <input type="hidden" name="id" value={row.id} />
                      <input className="smallInput" type="number" name="weight" step="0.01" defaultValue={row.weight} />
                      <label className="toggleLabel"><input type="checkbox" name="enabled" defaultChecked={row.enabled} /> enabled</label>
                      <button className="orangeButton">Update</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageShell>
    );
  }

  const select = config.select ?? "*";
  const { data } = await supabase.from(config.table).select(select).order("created_at", { ascending: false });
  const rows = (data ?? []).map(normalize);

  if (config.mode === "read") {
    return (
      <PageShell title={config.title} subtitle={config.subtitle}>
        <div className="dataCard">
          <table className="adminTable">
            <thead><tr>{config.fields?.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id}>
                  {config.fields?.map((f) => <td key={f.key} className={f.key === "id" ? "mono" : ""}>{formatValue(row[f.key], f.key)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageShell>
    );
  }

  async function createRow(fd: FormData) {
    "use server";
    const db = await assertAdmin();
    const payload: any = {};
    for (const field of config.fields ?? []) {
      payload[field.key] = field.type === "boolean" ? fd.get(field.key) === "on" : String(fd.get(field.key) ?? "").trim();
    }
    const { error } = await db.from(config.table).insert(payload);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/" + section);
  }

  async function updateRow(fd: FormData) {
    "use server";
    const db = await assertAdmin();
    const id = String(fd.get("id"));
    const payload: any = {};
    for (const field of config.fields ?? []) {
      payload[field.key] = field.type === "boolean" ? fd.get(field.key) === "on" : String(fd.get(field.key) ?? "").trim();
    }
    if (["terms","ai_generation_examples","llm_models","llm_providers","allowed_signup_domains","whitelisted_emails"].includes(config.table)) {
      payload.updated_at = new Date().toISOString();
    }
    const { error } = await db.from(config.table).update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/" + section);
  }

  async function deleteRow(fd: FormData) {
    "use server";
    const db = await assertAdmin();
    const id = String(fd.get("id"));
    const { error } = await db.from(config.table).delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/" + section);
  }

  return (
    <PageShell title={config.title} subtitle={config.subtitle}>
      <section className="createBox">
        <div>
          <span className="eyebrow">CREATE NEW</span>
          <h2>Add {config.title.toLowerCase().replace(/s$/, "")}</h2>
        </div>
        <form action={createRow} className="createGrid">
          {config.fields?.map((field) => field.type === "boolean"
            ? <label className="toggleLabel" key={field.key}><input type="checkbox" name={field.key} defaultChecked /> {field.label}</label>
            : <input key={field.key} name={field.key} placeholder={field.label} required={["term","title","name","model_key","domain","email"].includes(field.key)} />
          )}
          <button className="orangeButton">Create</button>
        </form>
      </section>

      <div className="dataCard">
        <table className="adminTable">
          <thead><tr>{config.fields?.map((f) => <th key={f.key}>{f.label}</th>)}<th>Manage</th></tr></thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.id}>
                <td colSpan={(config.fields?.length ?? 0) + 1}>
                  <div className="crudLine">
                    <form action={updateRow} className="rowForm grow">
                      <input type="hidden" name="id" value={row.id} />
                      {config.fields?.map((field) => field.type === "boolean"
                        ? <label className="toggleLabel" key={field.key}><input type="checkbox" name={field.key} defaultChecked={Boolean(row[field.key])} /> active</label>
                        : <input key={field.key} name={field.key} defaultValue={row[field.key] ?? ""} />
                      )}
                      <button className="softButton">Update</button>
                    </form>
                    <form action={deleteRow}><input type="hidden" name="id" value={row.id} /><button className="deleteButton">Delete</button></form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="pageWrap"><header className="pageHeader"><div><span className="eyebrow">CATCAPTION ADMIN</span><h1>{title}</h1><p>{subtitle}</p></div></header>{children}</div>;
}

function formatValue(value: any, key: string) {
  if (key === "is_superadmin") return value ? "Superadmin" : "User";
  if (key.includes("created_at") && value) return new Date(value).toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "—");
}
