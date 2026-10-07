import {env} from 'cloudflare:workers';
import {refreshRadar} from '@/lib/store';

type Rpc={jsonrpc?:string;id?:string|number;method?:string;params?:{name?:string;arguments?:Record<string,unknown>}};
const tool={name:'refresh_job_radar',description:'从四家已配置的公开招聘页读取当前上海岗位，清洗去重并保存每日统计。',inputSchema:{type:'object',properties:{},additionalProperties:false}};
function answer(id:Rpc['id'],result:unknown){return Response.json({jsonrpc:'2.0',id: id??null,result});}
function error(id:Rpc['id'],code:number,message:string,status=200){return Response.json({jsonrpc:'2.0',id:id??null,error:{code,message}},{status});}
export async function POST(request:Request){
  let body:Rpc;
  try{body=await request.json() as Rpc;}catch{return error(undefined,-32700,'Invalid JSON',400);}
  if(body.method==='initialize')return answer(body.id,{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'ai-job-radar',version:'1.0.0'}});
  if(body.method==='notifications/initialized')return new Response(null,{status:202});
  if(body.method==='tools/list')return answer(body.id,{tools:[tool]});
  if(body.method==='tools/call'){
    if(body.params?.name!==tool.name)return error(body.id,-32602,'Unknown tool');
    const admin=(env as unknown as {RADAR_ADMIN_EMAIL?:string}).RADAR_ADMIN_EMAIL;
    const email=request.headers.get('oai-authenticated-user-email');
    if(!admin||!email||email.toLowerCase()!==admin.toLowerCase())return error(body.id,-32001,'Owner sign-in required',403);
    try{const result=await refreshRadar();return answer(body.id,{content:[{type:'text',text:JSON.stringify({updatedAt:result.updatedAt,total:result.report.active,sourceStatus:result.sources})}]});}
    catch(e){return error(body.id,-32000,e instanceof Error?e.message:'Refresh failed',503);}
  }
  return error(body.id,-32601,'Method not found');
}
