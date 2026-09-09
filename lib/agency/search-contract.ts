import {z} from "zod";
export const searchInput=z.object({
 mode:z.enum(["opportunities","venues"]),
 city:z.string().trim().min(2).max(60).regex(/^[\p{L}\p{M}\s.'’-]+$/u,"Enter a city name."),
 country:z.enum(["th","sg","my","id","vn","ph","ae","gb","us","au"]),
 language:z.enum(["en","th"]).default("en")
}).strict();
export type SearchInput=z.infer<typeof searchInput>;
export type SearchResult={title:string;snippet:string;url:string;host:string;date:string|null};
export type SearchOutput={results:SearchResult[];fetchedAt:string;partial:boolean;cached:boolean;mode:SearchInput["mode"]};
export const countries={th:"Thailand",sg:"Singapore",my:"Malaysia",id:"Indonesia",vn:"Vietnam",ph:"Philippines",ae:"United Arab Emirates",gb:"United Kingdom",us:"United States",au:"Australia"};
export function buildSearchQueries(input:SearchInput):string[]{
 const place=`"${input.city}" ${countries[input.country]}`;
 if(input.mode==="opportunities")return input.language==="th"?[`${place} รับสมัครดีเจ งานดีเจ`,`${place} DJ audition "resident DJ" hiring`]:[`${place} DJ "hiring" OR "auditions" OR "DJ wanted"`,`${place} "resident DJ" vacancy OR "open call" OR opportunity`];
 return input.language==="th"?[`${place} โรงแรม รูฟท็อป บาร์ ดีเจ`,`${place} restaurant hotel "DJ nights"`]:[`${place} hotel rooftop bar "resident DJ"`,`${place} restaurant lounge "DJ nights"`];
}
export function normalizeSearchResults(responses:unknown[]):SearchResult[]{
 const seen=new Set<string>();const results:SearchResult[]=[];
 for(const response of responses){if(!response||typeof response!=="object")continue;const organic=(response as {organic?:unknown}).organic;if(!Array.isArray(organic))continue;
  for(const row of organic.slice(0,10)){if(!row||typeof row!=="object"||typeof row.link!=="string"||typeof row.title!=="string")continue;
   try{const url=new URL(row.link);if(url.protocol!=="https:"||url.username||url.password)continue;for(const key of [...url.searchParams.keys()])if(key.startsWith("utm_")||["fbclid","gclid"].includes(key))url.searchParams.delete(key);const key=url.href.replace(/\/$/,"");if(seen.has(key))continue;seen.add(key);results.push({title:row.title.slice(0,250),snippet:typeof row.snippet==="string"?row.snippet.slice(0,650):"",url:url.href,host:url.hostname.replace(/^www\./,""),date:typeof row.date==="string"?row.date.slice(0,80):null});}catch{continue;}
  }
 }return results.slice(0,20);
}
