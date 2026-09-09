import {createHash} from "node:crypto";
import {db} from "@/lib/db";
import {buildSearchQueries,normalizeSearchResults,type SearchInput,type SearchOutput} from "./search-contract";
export class SearchLimitError extends Error{constructor(readonly status:number,message:string){super(message);}}
export async function searchAgencyWeb(input:SearchInput,userId:string):Promise<SearchOutput>{
 if(!process.env.SERPER_API_KEY)throw new SearchLimitError(503,"Search is temporarily unavailable. Please try again later.");
 const key=createHash("sha256").update(JSON.stringify({...input,city:input.city.toLocaleLowerCase()})).digest("hex");
 const now=new Date();const emptyTime=new Date(0);const leaseUntil=new Date(now.getTime()+45000);
 const cached=await db.agencySearchCache.findUnique({where:{key}});
 if(cached?.payload&&cached.expiresAt>now)return {...cached.payload as unknown as SearchOutput,cached:true};
 const day=now.toISOString().slice(0,10),month=day.slice(0,7);const owner=createHash("sha256").update(userId).digest("hex");
 const nextDay=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));const nextMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
 await db.$transaction(async tx=>{
  await tx.agencySearchCache.upsert({where:{key},create:{key,expiresAt:emptyTime,leaseUntil:emptyTime},update:{}});
  const claim=await tx.agencySearchCache.updateMany({where:{key,leaseUntil:{lte:now},expiresAt:{lte:now}},data:{leaseUntil}});
  if(claim.count!==1)throw new SearchLimitError(409,"This search is already refreshing. Try again in a few seconds.");
  // Reserve the maximum TWO provider calls before any network request. Every
  // scope increments in this transaction; one full scope rolls everything back.
  for(const scope of [{key:`user:${owner}:${day}`,limit:20,expiresAt:nextDay},{key:`day:${day}`,limit:200,expiresAt:nextDay},{key:`month:${month}`,limit:2000,expiresAt:nextMonth}]){
   await tx.agencySearchBudget.upsert({where:{key:scope.key},create:{key:scope.key,expiresAt:scope.expiresAt},update:{}});
   const reserved=await tx.agencySearchBudget.updateMany({where:{key:scope.key,used:{lte:scope.limit-2}},data:{used:{increment:2}}});
   if(reserved.count!==1)throw new SearchLimitError(429,"The free search allowance has been reached. Please try again later.");
  }
 });
 try{
  const responses=await Promise.allSettled(buildSearchQueries(input).map(async q=>{
   const response=await fetch("https://google.serper.dev/search",{method:"POST",headers:{"X-API-KEY":process.env.SERPER_API_KEY!,"Content-Type":"application/json"},body:JSON.stringify({q,gl:input.country,num:10}),signal:AbortSignal.timeout(10000),cache:"no-store"});
   if(!response.ok)throw new Error("Search provider unavailable");const data=await response.json();if(!Array.isArray(data.organic))throw new Error("Search provider response incomplete");return data;
  }));
  const success=responses.filter((r):r is PromiseFulfilledResult<unknown>=>r.status==="fulfilled");if(!success.length)throw new SearchLimitError(503,"The search provider is unavailable. Please try again later.");
  const output:SearchOutput={results:normalizeSearchResults(success.map(r=>r.value)),fetchedAt:new Date().toISOString(),partial:success.length<responses.length,cached:false,mode:input.mode};
  const hours=output.partial?0.05:input.mode==="opportunities"?6:24;
  // Conditional ownership prevents an expired request overwriting a newer one.
  await db.agencySearchCache.updateMany({where:{key,leaseUntil},data:{payload:JSON.parse(JSON.stringify(output)),expiresAt:new Date(Date.now()+hours*3600000),leaseUntil:emptyTime}});
  return output;
 }finally{
  // The lease expires on its own; housekeeping must not replace the result.
  await db.agencySearchCache.updateMany({where:{key,leaseUntil},data:{leaseUntil:emptyTime}}).catch(()=>undefined);
  // Keep counters for one extra day; no permanent history of searches per user.
  const old=new Date(Date.now()-86400000);
  await db.agencySearchBudget.deleteMany({where:{expiresAt:{lt:old}}}).catch(()=>undefined);
  await db.agencySearchCache.deleteMany({where:{expiresAt:{lt:old},leaseUntil:{lt:now}}}).catch(()=>undefined);
 }
}
