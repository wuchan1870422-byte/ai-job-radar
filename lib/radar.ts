export type Job = {
  id:string; source:string; company:string; title:string; location:string; team:string;
  applyUrl:string; description:string; postedAt:number|null; firstSeen:number; lastSeen:number;
  salary:string; skills:string[]; score:number; fit:'possible'|'review'|'excluded'; reasons:string[];
};
export type SourceStatus={name:string;ok:boolean;count:number;error?:string};
export const SOURCES=[
  {board:'yuno',name:'Yuno'},
  {board:'xsolla',name:'Xsolla'},
  {board:'wgsn',name:'WGSN'},
  {board:'dlocal',name:'dLocal'},
] as const;

type LeverPosting={id?:string;text?:string;descriptionPlain?:string;description?:string;hostedUrl?:string;applyUrl?:string;createdAt?:number;categories?:{location?:string;team?:string};salaryRange?:{min?:number;max?:number;currency?:string;interval?:string};lists?:Array<{text?:string;content?:string}>};
const SKILLS=['AI','Agent','Python','JavaScript','TypeScript','React','SQL','Excel','API','自动化','数据分析','客服','销售','运营','技术支持'];
const rejectEducation=/(本科|学士|硕士|博士|大专|专科|bachelor'?s?|master'?s?|university degree|college degree|undergraduate degree|diploma in)/i;
const rejectExperience=/(?:[1-9]\d*|[一二三四五六七八九十])\s*(?:\+|年以上|年|years?)(?:\s+of)?\s*(?:工作|相关|经验|experience)|(?:至少|minimum|at least)\s*(?:[1-9]\d*|[一二三四五六七八九十])\s*(?:年|years?)/i;
const positiveEducation=/(高中|中专|不限学历|high school|no degree required|degree not required)/i;
const positiveExperience=/(无需经验|无经验|经验不限|应届|entry.level|no experience|required experience: 0)/i;
const escapeHtml=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();

export function assess(job:Omit<Job,'score'|'fit'|'skills'|'reasons'>):Job{
  const full=`${job.title}\n${job.description}`;
  const degree=rejectEducation.test(full),exp=rejectExperience.test(full);
  const skills=SKILLS.filter(s=>new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(full)).slice(0,8);
  const reasons:string[]=[];
  let fit:Job['fit']='review';
  if(degree)reasons.push('出现学历门槛，请核对原文');
  if(exp)reasons.push('出现年限经验门槛，请核对原文');
  if(degree||exp)fit='excluded';
  else if(positiveEducation.test(full)&&positiveExperience.test(full)){fit='possible';reasons.push('明确写有低学历与无经验友好表述，仍需核实');}
  else reasons.push('学历或经验未写明，需向招聘方核实');
  const tech=/(AI|Agent|Python|JavaScript|React|SQL|自动化|数据分析|技术支持)/i.test(full);
  const junior=/(助理|初级|实习|junior|associate|assistant|entry.level|part.time)/i.test(job.title);
  const score=Math.max(0,Math.min(100,30+(tech?22:0)+(junior?20:0)+(skills.length>2?10:0)+(fit==='possible'?18:fit==='excluded'?-45:0)));
  return {...job,score,fit,skills,reasons};
}

export async function fetchLiveJobs():Promise<{jobs:Job[];sources:SourceStatus[];fetchedAt:number}>{
  const fetchedAt=Date.now();
  const results=await Promise.all(SOURCES.map(async source=>{
    try{
      const response=await fetch(`https://api.lever.co/v0/postings/${source.board}?mode=json`,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data:unknown=await response.json();
      if(!Array.isArray(data))throw new Error('Unexpected response');
      const jobs=(data as LeverPosting[]).filter(x=>/上海|shanghai/i.test(x.categories?.location||'')&&x.id&&x.text&&x.hostedUrl).map(x=>{
        const plain=escapeHtml([x.descriptionPlain||x.description||'',...(x.lists||[]).map(y=>`${y.text||''} ${y.content||''}`)].join(' ')).slice(0,12000);
        const pay=x.salaryRange;
        const salary=pay?.min&&pay?.max?`${pay.currency||''} ${pay.min.toLocaleString()}–${pay.max.toLocaleString()} / ${pay.interval||'未注明'}`:'未公开';
        return assess({id:`lever:${source.board}:${x.id}`,source:source.board,company:source.name,title:x.text!,location:x.categories?.location||'上海',team:x.categories?.team||'未分类',applyUrl:x.hostedUrl!,description:plain,postedAt:typeof x.createdAt==='number'?x.createdAt:null,firstSeen:fetchedAt,lastSeen:fetchedAt,salary});
      });
      return {status:{name:source.name,ok:true,count:jobs.length} as SourceStatus,jobs};
    }catch(e){return {status:{name:source.name,ok:false,count:0,error:e instanceof Error?e.message:'请求失败'} as SourceStatus,jobs:[] as Job[]};}
  }));
  const unique=new Map<string,Job>();for(const r of results)for(const job of r.jobs)unique.set(job.id,job);
  return {jobs:[...unique.values()].sort((a,b)=>b.score-a.score),sources:results.map(r=>r.status),fetchedAt};
}

export function makeReport(jobs:Job[],fetchedAt:number){
  const active=jobs.length,possible=jobs.filter(j=>j.fit==='possible').length,review=jobs.filter(j=>j.fit==='review').length,excluded=active-possible-review;
  const companies=[...new Set(jobs.map(j=>j.company))].length;
  const skillCounts=new Map<string,number>();for(const j of jobs)for(const s of j.skills)skillCounts.set(s,(skillCounts.get(s)||0)+1);
  const topSkills=[...skillCounts].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count])=>({name,count}));
  return {fetchedAt,active,possible,review,excluded,companies,topSkills,topJobs:jobs.filter(j=>j.fit!=='excluded').slice(0,5).map(j=>({id:j.id,title:j.title,company:j.company,score:j.score})),note:'来源仅覆盖四家公司的公开 Lever 招聘页；没有确认低学历或零经验的岗位一律标记为待核实。'};
}
