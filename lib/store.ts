import {env} from 'cloudflare:workers';
import {fetchLiveJobs,makeReport,type Job,type SourceStatus} from './radar';
export function database(){if(!env.DB)throw new Error('D1 unavailable');return env.DB;}
export async function readRadar(){
  const db=database();
  const [items,last]=await Promise.all([
    db.prepare('SELECT * FROM jobs WHERE active=1 ORDER BY score DESC, first_seen DESC LIMIT 150').all(),
    db.prepare('SELECT * FROM runs ORDER BY at DESC LIMIT 1').first()
  ]);
  const jobs=(items.results||[]).map(entry=>{const r=entry as Record<string,unknown>;return {id:r.id,source:r.source,company:r.company,title:r.title,location:r.location,team:r.team,applyUrl:r.apply_url,description:r.description,postedAt:r.posted_at,firstSeen:r.first_seen,lastSeen:r.last_seen,salary:r.salary,skills:JSON.parse(String(r.skills)),score:r.score,fit:r.fit,reasons:JSON.parse(String(r.reasons))} as Job});
  const run=last as {at:number;sources:string;report:string}|null;
  return {jobs,report:run?JSON.parse(run.report):makeReport(jobs,Date.now()),sources:run?JSON.parse(run.sources) as SourceStatus[]:[],updatedAt:run?.at||null};
}
export async function refreshRadar(){
  const data=await fetchLiveJobs();
  if(!data.sources.some(s=>s.ok))throw new Error('全部来源不可用，保留旧数据');
  const db=database();
  const operations=[];
  for(const job of data.jobs)operations.push(db.prepare('INSERT INTO jobs(id,source,company,title,location,team,apply_url,description,posted_at,first_seen,last_seen,salary,skills,score,fit,reasons,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET company=excluded.company,title=excluded.title,location=excluded.location,team=excluded.team,apply_url=excluded.apply_url,description=excluded.description,posted_at=excluded.posted_at,last_seen=excluded.last_seen,salary=excluded.salary,skills=excluded.skills,score=excluded.score,fit=excluded.fit,reasons=excluded.reasons,active=1').bind(job.id,job.source,job.company,job.title,job.location,job.team,job.applyUrl,job.description,job.postedAt,job.firstSeen,job.lastSeen,job.salary,JSON.stringify(job.skills),job.score,job.fit,JSON.stringify(job.reasons)));
  for(const source of data.sources.filter(s=>s.ok)){const board=SOURCES_BY_NAME[source.name];if(board)operations.push(db.prepare('UPDATE jobs SET active=0 WHERE source=? AND last_seen<?').bind(board,data.fetchedAt));}
  if(operations.length)await db.batch(operations);
  const current=await readRadar();
  const report=makeReport(current.jobs,data.fetchedAt);
  await db.prepare('INSERT INTO runs(id,at,found,sources,report) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),data.fetchedAt,report.active,JSON.stringify(data.sources),JSON.stringify(report)).run();
  return {jobs:current.jobs,report,sources:data.sources,updatedAt:data.fetchedAt};
}
const SOURCES_BY_NAME:Record<string,string>={Yuno:'yuno',Xsolla:'xsolla',WGSN:'wgsn',dLocal:'dlocal'};
