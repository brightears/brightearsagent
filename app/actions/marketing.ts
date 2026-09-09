"use server";
type ActionResult={ok:true}|{ok:false;error:string};
/** Old free-tool forms must not keep collecting email addresses from cached pages. */
export async function saveMarketingContact(_input:{email:string;source:string}):Promise<ActionResult>{
 return {ok:false,error:"Artist-assistant signups are closed. Visit brightears.io for our DJ agency."};
}
