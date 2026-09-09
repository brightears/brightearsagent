import {rateLimit,clientIp} from "@/lib/rate-limit";
import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs/server";
import {searchInput} from "@/lib/agency/search-contract";
import {searchAgencyWeb,SearchLimitError} from "@/lib/agency/search";
// Local concurrency guard for the single Render process. Durable provider
// allowances remain enforced by the database across processes and restarts.
const searchesInFlight=new Set<string>();
export async function POST(request:Request){
 const headers={"Cache-Control":"no-store"};
 const burst=rateLimit(`agency-search-ip:${clientIp(request)}`,20,60000);
 if(!burst.ok)return NextResponse.json({error:"Please wait a moment before searching again."},{status:429,headers:{...headers,"Retry-After":String(burst.retryAfterSec)}});
 if(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY||!process.env.CLERK_SECRET_KEY)return NextResponse.json({error:"Search sign-in is temporarily unavailable."},{status:503,headers});
 // This account grants search access only. It never provisions a Business,
 // Artist or access to the separate agency/Vinyl records.
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in to use the free search tool."},{status:401,headers});
 const userBurst=rateLimit(`agency-search-user:${user.id}`,6,60000);
 if(!userBurst.ok)return NextResponse.json({error:"Please wait a moment before searching again."},{status:429,headers:{...headers,"Retry-After":String(userBurst.retryAfterSec)}});
 const primary=user.emailAddresses.find(e=>e.id===user.primaryEmailAddressId);
 if(primary?.verification?.status!=="verified")return NextResponse.json({error:"Verify your primary email before searching."},{status:403,headers});
 if(Number(request.headers.get("content-length"))>2048)return NextResponse.json({error:"Search input is too long."},{status:400,headers});
 let body;try{body=await readSearchBody(request);}catch{return NextResponse.json({error:"Enter a valid city and country."},{status:400,headers});}
 const parsed=searchInput.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Choose a search type, city and country."},{status:400,headers});
 if(searchesInFlight.has(user.id))return NextResponse.json({error:"Your previous search is still running. Please wait for it to finish."},{status:409,headers});
 searchesInFlight.add(user.id);
 try{return NextResponse.json(await searchAgencyWeb(parsed.data,user.id),{headers});}catch(e){return NextResponse.json({error:e instanceof SearchLimitError?e.message:"Search is temporarily unavailable. Please try again later."},{status:e instanceof SearchLimitError?e.status:503,headers});}finally{searchesInFlight.delete(user.id);}
}

/** Bound streamed bodies even when Content-Length is absent or untrusted. */
async function readSearchBody(request:Request):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw new Error("Missing input");
 const chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>2048){await reader.cancel();throw new Error("Too long");}chunks.push(part.value);}}finally{reader.releaseLock();}
 const content=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){content.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder().decode(content));
}
