import { createClient } from "@/lib/supabase/server";

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export default async function AdminOverview() {
  const supabase = await createClient();

  const [profilesR,captionsR,votesR,memesR,chainsR,requestsR,responsesR] = await Promise.all([
    supabase.from("profiles").select("id,is_superadmin,created_at"),
    supabase.from("captions").select("id,user_id,caption_text,created_at,meme_image_id,votes(vote),meme_images(title,image_url)"),
    supabase.from("votes").select("id,vote,created_at,user_id,caption_id"),
    supabase.from("meme_images").select("id,title,image_url"),
    supabase.from("prompt_chains").select("id"),
    supabase.from("generation_requests").select("id,status,created_at"),
    supabase.from("llm_responses").select("id,latency_ms,token_count"),
  ]);

  const profiles=profilesR.data??[];
  const captions=captionsR.data??[];
  const votes=votesR.data??[];
  const memes=memesR.data??[];
  const chains=chainsR.data??[];
  const requests=requestsR.data??[];
  const responses=responsesR.data??[];

  const upvotes=votes.filter((v:any)=>v.vote===1).length;
  const downvotes=votes.filter((v:any)=>v.vote===-1).length;
  const rate=votes.length?Math.round(upvotes/votes.length*100):0;
  const superadmins=profiles.filter((p:any)=>p.is_superadmin).length;
  const avgLatency=responses.length?Math.round(responses.reduce((s:number,r:any)=>s+Number(r.latency_ms||0),0)/responses.length):0;

  const ranked=captions.map((c:any)=>({
    ...c,
    score:(c.votes??[]).reduce((s:number,v:any)=>s+Number(v.vote||0),0),
    voteCount:(c.votes??[]).length,
  })).sort((a:any,b:any)=>b.score-a.score);

  const memeStats=memes.map((m:any)=>{
    const related=captions.filter((c:any)=>c.meme_image_id===m.id);
    const allVotes=related.flatMap((c:any)=>c.votes??[]);
    const ups=allVotes.filter((v:any)=>v.vote===1).length;
    return {...m,captionCount:related.length,upRate:allVotes.length?Math.round(ups/allVotes.length*100):0};
  }).sort((a:any,b:any)=>b.captionCount-a.captionCount);

  const days=Array.from({length:14},(_,i)=>{
    const d=new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()-(13-i));
    return d;
  });
  const activity=days.map(d=>{
    const key=d.toISOString().slice(0,10);
    return {
      label:d.toLocaleDateString("en-US",{month:"numeric",day:"numeric"}),
      captions:captions.filter((c:any)=>dayKey(c.created_at)===key).length,
      votes:votes.filter((v:any)=>dayKey(v.created_at)===key).length,
    };
  });
  const maxActivity=Math.max(1,...activity.flatMap(x=>[x.captions,x.votes]));

  const weekdayCounts=Array.from({length:7},()=>Array(6).fill(0));
  votes.forEach((v:any)=>{
    const d=new Date(v.created_at);
    const bucket=Math.min(5,Math.floor(d.getHours()/4));
    weekdayCounts[d.getDay()][bucket]++;
  });
  const maxHeat=Math.max(1,...weekdayCounts.flat());

  const captionedByUser=new Map<string,number>();
  captions.forEach((c:any)=>{ if(c.user_id) captionedByUser.set(c.user_id,(captionedByUser.get(c.user_id)||0)+1); });
  const votedByUser=new Map<string,number>();
  votes.forEach((v:any)=>{ if(v.user_id) votedByUser.set(v.user_id,(votedByUser.get(v.user_id)||0)+1); });
  const lurkers=profiles.filter((p:any)=>!captionedByUser.get(p.id)&&!votedByUser.get(p.id)).length;
  const ghosted=captions.length?Math.round(captions.filter((c:any)=>!(c.votes??[]).length).length/captions.length*100):0;

  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h1>The Caption Report</h1>
          <p>Live product analytics and operational signals from CATCAPTION.</p>
        </div>
        <div className="livePill"><span /> Live data</div>
      </header>

      <section className="metricGrid">
        <Metric label="Users" value={profiles.length} note={`${superadmins} superadmin${superadmins===1?"":"s"}`} />
        <Metric label="Memes" value={memes.length} note={`${memes.filter((m:any)=>!captions.some((c:any)=>c.meme_image_id===m.id)).length} never captioned`} />
        <Metric label="Captions" value={captions.length} note={captions.length?`${(captions.reduce((s:number,c:any)=>s+String(c.caption_text||"").split(/\\s+/).filter(Boolean).length,0)/captions.length).toFixed(1)} words avg`:"0 words avg"} />
        <Metric label="Votes" value={votes.length} note={captions.length?`${(votes.length/captions.length).toFixed(1)} per caption`:"0 per caption"} />
        <Metric label="Requests" value={requests.length} note="AI generation jobs" />
        <div className="metricCard gaugeCard">
          <div className="gaugeRing" style={{"--pct":`${rate}%`} as React.CSSProperties}>
            <div className="gaugeCenter"><strong>{rate}%</strong><span>upvote rate</span></div>
          </div>
        </div>
      </section>

      <section className="dashboardGrid">
        <article className="dashCard large">
          <div className="dashCardHeader split"><div><h2>Pulse, last 14 days</h2><p>Captions created and votes cast.</p></div><div className="legend"><span className="legendVote"/>votes <span className="legendCaption"/>captions</div></div>
          <div className="activityChart">
            {activity.map((x,i)=><div className="activityCol" key={i}>
              <div className="bars">
                <div className="barVote" title={`${x.votes} votes`} style={{height:`${Math.max(2,x.votes/maxActivity*150)}px`}}/>
                <div className="barCaption" title={`${x.captions} captions`} style={{height:`${Math.max(2,x.captions/maxActivity*150)}px`}}/>
              </div>
              <span>{i%2===0?x.label:""}</span>
            </div>)}
          </div>
        </article>

        <article className="dashCard">
          <div className="dashCardHeader"><h2>Fun facts</h2><p>Signals from current usage.</p></div>
          <ul className="factList">
            <li><strong>Top caption:</strong> {ranked[0]?.caption_text??"No rated caption yet"}</li>
            <li><strong>Ghosted:</strong> {ghosted}% of captions have never gotten a vote.</li>
            <li><strong>Lurkers:</strong> {lurkers} users have neither voted nor captioned.</li>
            <li><strong>Average LLM latency:</strong> {avgLatency} ms.</li>
            <li><strong>Prompt chains:</strong> {chains.length} configured.</li>
          </ul>
        </article>

        <article className="dashCard full">
          <div className="dashCardHeader split"><div><h2>When do people vote?</h2><p>Weekday × 4-hour block. Bigger dot means more activity.</p></div></div>
          <div className="heatmap">
            <div className="heatLabels">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><span key={d}>{d}</span>)}</div>
            <div className="heatGrid">
              {weekdayCounts.flatMap((row,day)=>row.map((count,bucket)=><div className="heatCell" key={`${day}-${bucket}`}><span style={{width:`${8+(count/maxHeat)*34}px`,height:`${8+(count/maxHeat)*34}px`,opacity:count?0.35+(count/maxHeat)*0.65:0.12}}/></div>))}
            </div>
            <div className="heatTimes">{["12a","4a","8a","12p","4p","8p"].map(t=><span key={t}>{t}</span>)}</div>
          </div>
        </article>

        <article className="dashCard">
          <div className="dashCardHeader"><h2>Most-captioned memes</h2><p>Templates driving the most generation activity.</p></div>
          <div className="memeMiniGrid">
            {memeStats.slice(0,4).map((m:any)=><div className="memeMini" key={m.id}>
              {m.image_url?<img src={m.image_url} alt={m.title}/>:<div className="miniPlaceholder">CAT</div>}
              <strong>{m.title}</strong>
              <span>{m.captionCount} captions · {m.upRate}% up</span>
            </div>)}
          </div>
        </article>

        <article className="dashCard">
          <div className="dashCardHeader"><h2>Top captions</h2><p>Ranked by net vote score.</p></div>
          <div className="ranking">
            {ranked.slice(0,5).map((c:any,i:number)=><div className="rankRow" key={c.id}><span className="rankNo">#{i+1}</span><span className="rankText">{c.caption_text}</span><strong>{c.score>=0?"+":""}{c.score}</strong></div>)}
            {!ranked.length&&<div className="emptyState">No caption data yet.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({label,value,note}:{label:string;value:number;note:string}) {
  return <div className="metricCard"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
