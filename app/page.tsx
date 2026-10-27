import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, is_superadmin")
    .eq("id", user.id)
    .single();

  const { data: ownerAccess } = await supabase.rpc("is_project_owner");

  if (!profile?.is_superadmin && !ownerAccess) {
    return {
      supabase,
      user,
      profile: null,
    };
  }

  return {
    supabase,
    user,
    profile,
  };
}

export default async function AdminHome() {
  const { supabase, user, profile } = await requireAdmin();

  if (!profile) {
    return (
      <main className="denied">
        <section className="deniedCard">
          <h1>Not an admin.</h1>
        </section>
      </main>
    );
  }

  const [
    profilesR,
    captionsR,
    votesR,
    chainsR,
    stepsR,
    mixR,
    termsR,
    providersR,
    modelsR,
    requestsR,
    examplesR,
    responsesR,
    domainsR,
    emailsR,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("captions")
      .select("*,meme_images(title,image_url),votes(vote)")
      .order("created_at", { ascending: false }),

    supabase
      .from("votes")
      .select("*,captions(caption_text)")
      .order("created_at", { ascending: false }),

    supabase
      .from("prompt_chains")
      .select("*"),

    supabase
      .from("prompt_chain_steps")
      .select("*,prompt_chains(name)")
      .order("step_order"),

    supabase
      .from("prompt_chain_mix")
      .select("*,prompt_chains(name)"),

    supabase
      .from("terms")
      .select("*")
      .order("term"),

    supabase
      .from("llm_providers")
      .select("*")
      .order("name"),

    supabase
      .from("llm_models")
      .select("*,llm_providers(name)")
      .order("name"),

    supabase
      .from("generation_requests")
      .select("*,prompt_chains(name),llm_models(name)")
      .order("created_at", { ascending: false }),

    supabase
      .from("ai_generation_examples")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("llm_responses")
      .select("*,llm_models(name)")
      .order("created_at", { ascending: false }),

    supabase
      .from("allowed_signup_domains")
      .select("*")
      .order("domain"),

    supabase
      .from("whitelisted_emails")
      .select("*")
      .order("email"),
  ]);

  const profiles = profilesR.data ?? [];

  const captions = (captionsR.data ?? []).map((caption: any) => ({
    ...caption,
    score: (caption.votes ?? []).reduce(
      (sum: number, vote: any) =>
        sum + Number(vote.vote || 0),
      0
    ),
  }));

  const votes = votesR.data ?? [];
  const chains = chainsR.data ?? [];
  const steps = stepsR.data ?? [];
  const mix = mixR.data ?? [];
  const terms = termsR.data ?? [];
  const providers = providersR.data ?? [];
  const models = modelsR.data ?? [];
  const requests = requestsR.data ?? [];
  const examples = examplesR.data ?? [];
  const responses = responsesR.data ?? [];
  const domains = domainsR.data ?? [];
  const emails = emailsR.data ?? [];

  const upvotes = votes.filter(
    (vote: any) => vote.vote === 1
  ).length;

  const downvotes = votes.filter(
    (vote: any) => vote.vote === -1
  ).length;

  async function updateRow(
    table: string,
    id: string,
    data: any
  ) {
    "use server";

    const { supabase, profile } = await requireAdmin();

    if (!profile) {
      throw new Error("Unauthorized");
    }

    const { error } = await supabase
      .from(table)
      .update(data)
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/");
  }

  async function insertRow(
    table: string,
    data: any
  ) {
    "use server";

    const { supabase, profile } = await requireAdmin();

    if (!profile) {
      throw new Error("Unauthorized");
    }

    const { error } = await supabase
      .from(table)
      .insert(data);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/");
  }

  async function deleteRow(
    table: string,
    id: string
  ) {
    "use server";

    const { supabase, profile } = await requireAdmin();

    if (!profile) {
      throw new Error("Unauthorized");
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/");
  }

  async function updateMix(
    formData: FormData
  ) {
    "use server";

    await updateRow(
      "prompt_chain_mix",
      String(formData.get("id")),
      {
        weight: Number(formData.get("weight")),
        enabled:
          formData.get("enabled") === "on",
        updated_at: new Date().toISOString(),
      }
    );
  }

  async function createTerm(
    formData: FormData
  ) {
    "use server";

    await insertRow("terms", {
      term: String(
        formData.get("term") ?? ""
      ),
      category: String(
        formData.get("category") ?? ""
      ),
      definition: String(
        formData.get("definition") ?? ""
      ),
    });
  }

  async function updateTerm(
    formData: FormData
  ) {
    "use server";

    await updateRow(
      "terms",
      String(formData.get("id")),
      {
        term: String(
          formData.get("term") ?? ""
        ),
        category: String(
          formData.get("category") ?? ""
        ),
        definition: String(
          formData.get("definition") ?? ""
        ),
        updated_at:
          new Date().toISOString(),
      }
    );
  }

  async function deleteTerm(
    formData: FormData
  ) {
    "use server";

    await deleteRow(
      "terms",
      String(formData.get("id"))
    );
  }

  async function createExample(
    formData: FormData
  ) {
    "use server";

    await insertRow(
      "ai_generation_examples",
      {
        title: String(
          formData.get("title") ?? ""
        ),
        input_text: String(
          formData.get("input_text") ?? ""
        ),
        expected_output: String(
          formData.get("expected_output") ?? ""
        ),
        notes: String(
          formData.get("notes") ?? ""
        ),
      }
    );
  }

  async function updateExample(
    formData: FormData
  ) {
    "use server";

    await updateRow(
      "ai_generation_examples",
      String(formData.get("id")),
      {
        title: String(
          formData.get("title") ?? ""
        ),
        input_text: String(
          formData.get("input_text") ?? ""
        ),
        expected_output: String(
          formData.get("expected_output") ?? ""
        ),
        notes: String(
          formData.get("notes") ?? ""
        ),
        updated_at:
          new Date().toISOString(),
      }
    );
  }

  async function deleteExample(
    formData: FormData
  ) {
    "use server";

    await deleteRow(
      "ai_generation_examples",
      String(formData.get("id"))
    );
  }

  async function createProvider(
    formData: FormData
  ) {
    "use server";

    await insertRow("llm_providers", {
      name: String(
        formData.get("name") ?? ""
      ),
      base_url: String(
        formData.get("base_url") ?? ""
      ),
      active: true,
    });
  }

  async function updateProvider(
    formData: FormData
  ) {
    "use server";

    await updateRow(
      "llm_providers",
      String(formData.get("id")),
      {
        name: String(
          formData.get("name") ?? ""
        ),
        base_url: String(
          formData.get("base_url") ?? ""
        ),
        active:
          formData.get("active") === "on",
        updated_at:
          new Date().toISOString(),
      }
    );
  }

  async function deleteProvider(
    formData: FormData
  ) {
    "use server";

    await deleteRow(
      "llm_providers",
      String(formData.get("id"))
    );
  }

  async function createModel(
    formData: FormData
  ) {
    "use server";

    await insertRow("llm_models", {
      name: String(
        formData.get("name") ?? ""
      ),
      model_key: String(
        formData.get("model_key") ?? ""
      ),
      provider_id:
        String(
          formData.get("provider_id") ?? ""
        ) || null,
      active: true,
    });
  }

  async function updateModel(
    formData: FormData
  ) {
    "use server";

    await updateRow(
      "llm_models",
      String(formData.get("id")),
      {
        name: String(
          formData.get("name") ?? ""
        ),
        model_key: String(
          formData.get("model_key") ?? ""
        ),
        provider_id:
          String(
            formData.get("provider_id") ?? ""
          ) || null,
        active:
          formData.get("active") === "on",
        updated_at:
          new Date().toISOString(),
      }
    );
  }

  async function deleteModel(
    formData: FormData
  ) {
    "use server";

    await deleteRow(
      "llm_models",
      String(formData.get("id"))
    );
  }

  async function createDomain(
    formData: FormData
  ) {
    "use server";

    await insertRow(
      "allowed_signup_domains",
      {
        domain: String(
          formData.get("domain") ?? ""
        ),
        active: true,
      }
    );
  }

  async function updateDomain(
    formData: FormData
  ) {
    "use server";

    await updateRow(
      "allowed_signup_domains",
      String(formData.get("id")),
      {
        domain: String(
          formData.get("domain") ?? ""
        ),
        active:
          formData.get("active") === "on",
        updated_at:
          new Date().toISOString(),
      }
    );
  }

  async function deleteDomain(
    formData: FormData
  ) {
    "use server";

    await deleteRow(
      "allowed_signup_domains",
      String(formData.get("id"))
    );
  }

  async function createEmail(
    formData: FormData
  ) {
    "use server";

    await insertRow(
      "whitelisted_emails",
      {
        email: String(
          formData.get("email") ?? ""
        ),
        note: String(
          formData.get("note") ?? ""
        ),
        active: true,
      }
    );
  }

  async function updateEmail(
    formData: FormData
  ) {
    "use server";

    await updateRow(
      "whitelisted_emails",
      String(formData.get("id")),
      {
        email: String(
          formData.get("email") ?? ""
        ),
        note: String(
          formData.get("note") ?? ""
        ),
        active:
          formData.get("active") === "on",
        updated_at:
          new Date().toISOString(),
      }
    );
  }

  async function deleteEmail(
    formData: FormData
  ) {
    "use server";

    await deleteRow(
      "whitelisted_emails",
      String(formData.get("id"))
    );
  }

  return (
    <main className="adminShell">
      <header className="topbar">
        <div className="brand">
          CATCAPTION / ADMIN
        </div>

        <div className="topbarRight">
          <span>{user.email}</span>
          <strong>WEEK 7</strong>
        </div>
      </header>

      <section className="hero">
        <span className="kicker">
          WEEK 7 / MORE OBSERVABILITY
        </span>

        <h1>
          See more.
          <br />
          Control more.
        </h1>

        <p>
          Users, prompt chains, AI
          generation, LLM configuration
          and access control.
        </p>
      </section>

      <section className="content">
        <div className="stats">
          <div className="stat">
            <span>Profiles</span>
            <strong>
              {profiles.length}
            </strong>
          </div>

          <div className="stat">
            <span>AI media</span>
            <strong>
              {captions.length}
            </strong>
          </div>

          <div className="stat">
            <span>Requests</span>
            <strong>
              {requests.length}
            </strong>
          </div>

          <div className="stat">
            <span>Prompt chains</span>
            <strong>
              {chains.length}
            </strong>
          </div>

          <div className="stat">
            <span>Total ratings</span>
            <strong>
              {votes.length}
            </strong>
          </div>

          <div className="stat">
            <span>Upvotes</span>
            <strong>
              {upvotes}
            </strong>
          </div>

          <div className="stat">
            <span>Downvotes</span>
            <strong>
              {downvotes}
            </strong>
          </div>
        </div>

        <div className="grid">
          <SimpleTable
            title="Users / Profiles"
            kicker="READ"
            heads={[
              "Name",
              "ID",
              "Role",
            ]}
            rows={profiles.map(
              (profile: any) => [
                [
                  profile.first_name,
                  profile.last_name,
                ]
                  .filter(Boolean)
                  .join(" ") || "Unnamed",

                profile.id,

                profile.is_superadmin
                  ? "Superadmin"
                  : "User",
              ]
            )}
          />

          <SimpleTable
            title="Prompt Chains"
            kicker="READ"
            heads={[
              "Name",
              "Description",
            ]}
            rows={chains.map(
              (chain: any) => [
                chain.name,
                chain.description,
              ]
            )}
          />

          <SimpleTable
            title="Prompt Chain Steps"
            kicker="READ"
            heads={[
              "Chain",
              "Order",
              "Name",
              "Prompt",
            ]}
            rows={steps.map(
              (step: any) => [
                step.prompt_chains?.name,
                step.step_order,
                step.name,
                step.prompt_template,
              ]
            )}
          />

          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="kicker">
                  READ / UPDATE
                </span>

                <h2>
                  Prompt Chain Mix
                </h2>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <tbody>
                  {mix.map(
                    (item: any) => (
                      <tr key={item.id}>
                        <td>
                          {
                            item
                              .prompt_chains
                              ?.name
                          }
                        </td>

                        <td>
                          <form
                            className="inlineEdit"
                            action={
                              updateMix
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                item.id
                              }
                            />

                            <input
                              name="weight"
                              type="number"
                              defaultValue={
                                item.weight
                              }
                            />

                            <label>
                              <input
                                name="enabled"
                                type="checkbox"
                                defaultChecked={
                                  item.enabled
                                }
                              />
                              Enabled
                            </label>

                            <button className="primary">
                              Update
                            </button>
                          </form>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <Crud
            title="Terms"
            rows={terms}
            fields={[
              ["term", "Term"],
              [
                "category",
                "Category",
              ],
              [
                "definition",
                "Definition",
              ],
            ]}
            createAction={
              createTerm
            }
            updateAction={
              updateTerm
            }
            deleteAction={
              deleteTerm
            }
          />

          <SimpleTable
            title="AI-generated Media"
            kicker="READ / VIEW"
            heads={[
              "Caption",
              "Prompt",
              "Score",
            ]}
            rows={captions.map(
              (caption: any) => [
                caption.caption_text,
                caption.prompt || "—",
                caption.score,
              ]
            )}
          />

          <SimpleTable
            title="Generation Requests"
            kicker="READ"
            heads={[
              "Status",
              "Chain",
              "Model",
              "Input",
            ]}
            rows={requests.map(
              (request: any) => [
                request.status,
                request
                  .prompt_chains
                  ?.name || "—",
                request
                  .llm_models
                  ?.name || "—",
                request.input_text ||
                  "—",
              ]
            )}
          />

          <Crud
            title="AI Generation Examples"
            rows={examples}
            fields={[
              ["title", "Title"],
              [
                "input_text",
                "Input",
              ],
              [
                "expected_output",
                "Expected Output",
              ],
              ["notes", "Notes"],
            ]}
            createAction={
              createExample
            }
            updateAction={
              updateExample
            }
            deleteAction={
              deleteExample
            }
          />

          <Crud
            title="LLM Providers"
            rows={providers}
            fields={[
              [
                "name",
                "Provider",
              ],
              [
                "base_url",
                "Base URL",
              ],
            ]}
            createAction={
              createProvider
            }
            updateAction={
              updateProvider
            }
            deleteAction={
              deleteProvider
            }
            checkbox="active"
          />

          <Crud
            title="LLM Models"
            rows={models}
            fields={[
              [
                "name",
                "Model",
              ],
              [
                "model_key",
                "Model Key",
              ],
            ]}
            createAction={
              createModel
            }
            updateAction={
              updateModel
            }
            deleteAction={
              deleteModel
            }
            checkbox="active"
          />

          <SimpleTable
            title="LLM Responses"
            kicker="READ"
            heads={[
              "Model",
              "Response",
              "Latency",
              "Tokens",
            ]}
            rows={responses.map(
              (response: any) => [
                response
                  .llm_models
                  ?.name || "—",
                response.output_text,
                response.latency_ms ??
                  "—",
                response.token_count ??
                  "—",
              ]
            )}
          />

          <Crud
            title="Allowed Signup Domains"
            rows={domains}
            fields={[
              [
                "domain",
                "Domain",
              ],
            ]}
            createAction={
              createDomain
            }
            updateAction={
              updateDomain
            }
            deleteAction={
              deleteDomain
            }
            checkbox="active"
          />

          <Crud
            title="Whitelisted E-mail Addresses"
            rows={emails}
            fields={[
              [
                "email",
                "E-mail",
              ],
              [
                "note",
                "Note",
              ],
            ]}
            createAction={
              createEmail
            }
            updateAction={
              updateEmail
            }
            deleteAction={
              deleteEmail
            }
            checkbox="active"
          />
        </div>
      </section>
    </main>
  );
}

function SimpleTable({
  title,
  kicker,
  heads,
  rows,
}: any) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="kicker">
            {kicker}
          </span>

          <h2>{title}</h2>
        </div>
      </div>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              {heads.map(
                (head: string) => (
                  <th key={head}>
                    {head}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (
                row: any[],
                index: number
              ) => (
                <tr key={index}>
                  {row.map(
                    (
                      value: any,
                      cellIndex: number
                    ) => (
                      <td
                        key={
                          cellIndex
                        }
                      >
                        {String(
                          value ?? ""
                        )}
                      </td>
                    )
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Crud({
  title,
  rows,
  fields,
  createAction,
  updateAction,
  deleteAction,
  checkbox,
}: any) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span className="kicker">
            CREATE / READ / UPDATE
            / DELETE
          </span>

          <h2>{title}</h2>
        </div>
      </div>

      <form
        className="createForm"
        action={createAction}
      >
        {fields.map(
          ([key, label]: any) => (
            <input
              key={key}
              name={key}
              placeholder={label}
            />
          )
        )}

        <button className="primary">
          Create
        </button>
      </form>

      <div className="tableWrap">
        <table>
          <tbody>
            {rows.map(
              (item: any) => (
                <tr key={item.id}>
                  <td>
                    <form
                      className="inlineEdit"
                      action={
                        updateAction
                      }
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={
                          item.id
                        }
                      />

                      {fields.map(
                        ([key]: any) => (
                          <input
                            key={key}
                            name={key}
                            defaultValue={
                              item[
                                key
                              ] ?? ""
                            }
                          />
                        )
                      )}

                      {checkbox ? (
                        <label>
                          <input
                            name={
                              checkbox
                            }
                            type="checkbox"
                            defaultChecked={
                              item[
                                checkbox
                              ]
                            }
                          />

                          Active
                        </label>
                      ) : null}

                      <button className="primary">
                        Update
                      </button>
                    </form>
                  </td>

                  <td>
                    <form
                      action={
                        deleteAction
                      }
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={
                          item.id
                        }
                      />

                      <button className="danger">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
