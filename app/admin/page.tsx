import { createClient } from "@/lib/supabase/server";

export default async function AdminOverview() {
  const supabase = await createClient();

  const [
    profilesR,
    captionsR,
    votesR,
    chainsR,
    requestsR,
    responsesR,
  ] = await Promise.all([
    supabase.from("profiles").select("id,is_superadmin"),
    supabase.from("captions").select("id,caption_text,votes(vote)"),
    supabase.from("votes").select("id,vote"),
    supabase.from("prompt_chains").select("id"),
    supabase.from("generation_requests").select("id,status"),
    supabase.from("llm_responses").select("id,latency_ms"),
  ]);

  const profiles = profilesR.data ?? [];
  const captions = captionsR.data ?? [];
  const votes = votesR.data ?? [];
  const chains = chainsR.data ?? [];
  const requests = requestsR.data ?? [];
  const responses = responsesR.data ?? [];

  const upvotes = votes.filter((v: any) => v.vote === 1).length;
  const downvotes = votes.filter((v: any) => v.vote === -1).length;

  const rate = votes.length
    ? Math.round((upvotes / votes.length) * 100)
    : 0;

  const superadmins = profiles.filter(
    (p: any) => p.is_superadmin
  ).length;

  const ranked = captions
    .map((c: any) => ({
      ...c,
      score: (c.votes ?? []).reduce(
        (sum: number, v: any) =>
          sum + Number(v.vote || 0),
        0
      ),
    }))
    .sort(
      (a: any, b: any) =>
        b.score - a.score
    );

  const avgLatency = responses.length
    ? Math.round(
        responses.reduce(
          (sum: number, r: any) =>
            sum +
            Number(
              r.latency_ms || 0
            ),
          0
        ) / responses.length
      )
    : 0;

  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <div>
          <h1>The Caption Report</h1>

          <p>
            A live overview of users,
            ratings, prompt activity, and
            AI generation.
          </p>
        </div>
      </header>

      <section className="metricGrid">
        <Metric
          label="Users"
          value={profiles.length}
          note={`${superadmins} superadmins`}
        />

        <Metric
          label="Captions"
          value={captions.length}
          note="AI-generated media"
        />

        <Metric
          label="Votes"
          value={votes.length}
          note={`${upvotes} up / ${downvotes} down`}
        />

        <Metric
          label="Prompt chains"
          value={chains.length}
          note="configured chains"
        />

        <Metric
          label="Requests"
          value={requests.length}
          note="generation requests"
        />

        <div className="metricCard gaugeCard">
          <div
            className="gaugeRing"
            style={
              {
                "--pct": `${rate}%`,
              } as React.CSSProperties
            }
          >
            <div className="gaugeCenter">
              <strong>
                {rate}%
              </strong>

              <span>
                upvote rate
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboardGrid">
        <article className="dashCard large">
          <div className="dashCardHeader">
            <h2>
              Engagement snapshot
            </h2>

            <p>
              Quick read on participation
              and content performance.
            </p>
          </div>

          <div className="barList">
            <Bar
              label="Upvotes"
              value={upvotes}
              total={Math.max(
                votes.length,
                1
              )}
            />

            <Bar
              label="Downvotes"
              value={downvotes}
              total={Math.max(
                votes.length,
                1
              )}
            />

            <Bar
              label="Captions"
              value={
                captions.length
              }
              total={Math.max(
                captions.length +
                  profiles.length,
                1
              )}
            />

            <Bar
              label="Users"
              value={
                profiles.length
              }
              total={Math.max(
                captions.length +
                  profiles.length,
                1
              )}
            />
          </div>
        </article>

        <article className="dashCard">
          <div className="dashCardHeader">
            <h2>Fun facts</h2>

            <p>
              Operational signals worth
              checking.
            </p>
          </div>

          <ul className="factList">
            <li>
              <strong>
                Top caption:
              </strong>{" "}
              {ranked[0]
                ?.caption_text ??
                "No rated caption yet"}
            </li>

            <li>
              <strong>
                Top score:
              </strong>{" "}
              {ranked[0]?.score ?? 0}
            </li>

            <li>
              <strong>
                Average LLM latency:
              </strong>{" "}
              {avgLatency} ms
            </li>

            <li>
              <strong>
                Generation requests:
              </strong>{" "}
              {requests.length}
            </li>

            <li>
              <strong>
                Prompt chains:
              </strong>{" "}
              {chains.length}
            </li>
          </ul>
        </article>

        <article className="dashCard full">
          <div className="dashCardHeader">
            <h2>
              Top captions
            </h2>

            <p>
              Ranked by net vote score.
            </p>
          </div>

          <div className="ranking">
            {ranked
              .slice(0, 5)
              .map(
                (
                  caption: any,
                  index: number
                ) => (
                  <div
                    className="rankRow"
                    key={caption.id}
                  >
                    <span className="rankNo">
                      #{index + 1}
                    </span>

                    <span className="rankText">
                      {
                        caption.caption_text
                      }
                    </span>

                    <strong>
                      {caption.score >=
                      0
                        ? "+"
                        : ""}
                      {
                        caption.score
                      }
                    </strong>
                  </div>
                )
              )}
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="metricCard">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {note}
      </small>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = Math.max(
    4,
    Math.round(
      (value / total) * 100
    )
  );

  return (
    <div className="barRow">
      <span>
        {label}
      </span>

      <div className="barTrack">
        <div
          className="barFill"
          style={{
            width: `${pct}%`,
          }}
        />
      </div>

      <strong>
        {value}
      </strong>
    </div>
  );
}
