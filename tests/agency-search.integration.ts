import assert from "node:assert/strict";
import {db} from "@/lib/db";
import {searchAgencyWeb} from "@/lib/agency/search";
const url=new URL(process.env.DATABASE_URL||"");
const localFixture=url.port==="55439"&&url.pathname==="/agency_test";
const ciFixture=process.env.CI==="true"&&url.port==="5432"&&url.pathname==="/brightears_ci";
if(url.hostname!=="127.0.0.1"||!(localFixture||ciFixture))throw Error("Isolated agency test database required");
process.env.SERPER_API_KEY="fixture-only";
let calls=0;let fail=false;
globalThis.fetch=async (input)=>{assert.equal(String(input),"https://google.serper.dev/search");calls++;await new Promise(r=>setTimeout(r,60));if(fail)return new Response("",{status:503});return Response.json({organic:[{title:"DJ opportunity",link:"https://example.com/#/jobs/123",snippet:"See original source"}]});};
async function reset(){await db.agencySearchCache.deleteMany();await db.agencySearchBudget.deleteMany();calls=0;fail=false;}
const input={mode:"opportunities" as const,city:"Bangkok",country:"th" as const,language:"en" as const};
async function main(){
try{
 await reset();const concurrent=await Promise.allSettled(Array.from({length:10},(_,i)=>searchAgencyWeb(input,`user-${i}`)));assert.equal(concurrent.filter(r=>r.status==="fulfilled").length,1);assert.equal(calls,2);const cached=await searchAgencyWeb(input,"another-user");assert.equal(cached.cached,true);assert.equal(calls,2);assert.equal(cached.results[0].url,"https://example.com/#/jobs/123");
 await reset();for(const city of ["Bangkok","Phuket","Pattaya","London","Berlin","Vienna","Paris","Rome","Tokyo","Seoul"])await searchAgencyWeb({...input,city},"one-user");assert.equal(calls,20);await assert.rejects(searchAgencyWeb({...input,city:"Singapore"},"one-user"),/allowance/);assert.equal(calls,20);
 await reset();const now=new Date(),month=now.toISOString().slice(0,7);await db.agencySearchBudget.create({data:{key:`month:${month}`,used:1998,expiresAt:new Date(Date.now()+86400000)}});const boundary=await Promise.allSettled([searchAgencyWeb(input,"first"),searchAgencyWeb({...input,city:"Phuket"},"second")]);assert.equal(boundary.filter(r=>r.status==="fulfilled").length,1);assert.equal(calls,2);assert.equal((await db.agencySearchBudget.findUniqueOrThrow({where:{key:`month:${month}`}})).used,2000);assert.equal((await db.agencySearchBudget.findUniqueOrThrow({where:{key:`day:${now.toISOString().slice(0,10)}`}})).used,2);
 await reset();fail=true;await assert.rejects(searchAgencyWeb(input,"failure-user"),/provider is unavailable/);assert.equal(calls,2);assert.equal((await db.agencySearchBudget.findUniqueOrThrow({where:{key:`month:${month}`}})).used,2);assert.equal((await db.agencySearchCache.findFirst())?.leaseUntil.getTime() || 0,0);
 console.log("PASS: concurrent coalescing, fresh cache, user ceiling, atomic global ceiling, conservative failed-provider reservation, lease release and source fragments.");
}finally{await reset();await db.$disconnect();}

}
main().catch(e=>{console.error(e);process.exitCode=1;});
