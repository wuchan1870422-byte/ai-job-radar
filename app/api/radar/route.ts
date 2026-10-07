import {fetchLiveJobs,makeReport} from '@/lib/radar';
import {readRadar} from '@/lib/store';

export async function GET(request:Request){
  try{
    const live=new URL(request.url).searchParams.get('live')==='1';
    if(!live){try{const stored=await readRadar();if(stored.updatedAt)return Response.json({...stored,mode:'snapshot'});}catch{/* live fallback */}}
    const data=await fetchLiveJobs();
    if(!data.sources.some(s=>s.ok))return Response.json({error:'招聘来源暂时不可用，请稍后重试。',sources:data.sources},{status:503});
    return Response.json({...data,report:makeReport(data.jobs,data.fetchedAt),updatedAt:data.fetchedAt,mode:'live'});
  }catch{return Response.json({error:'职位暂时不可用，请稍后重试。'},{status:503});}
}
