import {NextResponse} from "next/server";
/** Retired public acquisition demo. Existing tenant drafting is unaffected. */
export async function POST(){
 return NextResponse.json({error:"The public artist-assistant demo is retired.",accountUrl:"/assistant"},{status:410});
}
