import {describe,expect,it} from "vitest";
import {buildSearchQueries,normalizeSearchResults,searchInput} from "@/lib/agency/search-contract";
import {sanitizeArtist,withSupplementalArtists} from "@/lib/agency/roster";
describe("search-only discovery",()=>{
 it("accepts Thai and international city names but rejects query operators and oversized input",()=>{
  for(const city of ["Bangkok","กรุงเทพฯ","Ho Chi Minh City","St. John's"]){expect(searchInput.safeParse({city,mode:"opportunities",country:"th"}).success).toBe(true);}
  for(const city of ['Bangkok" OR site:evil.test','https://example.com',"x".repeat(100)])expect(searchInput.safeParse({city,mode:"opportunities",country:"th"}).success).toBe(false);
 });
 it("has a bounded two-query contract with no email or contact extraction",()=>{
  const queries=buildSearchQueries({city:"Bangkok",country:"th",language:"en",mode:"opportunities"});expect(queries).toHaveLength(2);expect(queries.every(q=>q.includes('"Bangkok" Thailand'))).toBe(true);expect(queries.join(" ")).not.toMatch(/email|contact|mailto/i);
 });
 it("preserves source text and date uncertainty; deduplicates tracking links; refuses unsafe schemes",()=>{
  const results=normalizeSearchResults([{organic:[{title:"DJ wanted",link:"https://example.com/job?utm_source=x",snippet:"Read the original",date:"2 days ago"},{title:"duplicate",link:"https://example.com/job",snippet:"dup"},{title:"unsafe",link:"javascript:alert(1)"},{title:"credentials",link:"https://user:pass@example.com/job"},{title:"Venue programme",link:"https://example.com/venue"}]}]);
  expect(results).toEqual([{title:"DJ wanted",url:"https://example.com/job",host:"example.com",snippet:"Read the original",date:"2 days ago"},{title:"Venue programme",url:"https://example.com/venue",host:"example.com",snippet:"",date:null}]);
 });
 it("bounds results and tolerates incomplete provider shapes",()=>{
  expect(normalizeSearchResults([null,{},[],{organic:null}])).toEqual([]);const rows=Array.from({length:200},(_,i)=>({title:"row",link:`https://example.com/${i}`}));expect(normalizeSearchResults([{organic:rows}])).toHaveLength(10);
 });
});
describe("public artist projection",()=>{
 it("normalizes platform hosts and handles without duplicating the domain",()=>{
  const artist=sanitizeArtist({id:"test",stageName:"Test",mixcloud:"m.mixcloud.com/buabenchawan9",instagram:"dj.linze",youtube:"https://youtu.be/example"});
  expect(artist?.links.map(link=>link.url)).toEqual(["https://instagram.com/dj.linze","https://m.mixcloud.com/buabenchawan9","https://youtu.be/example"]);
  expect(sanitizeArtist({id:"test",stageName:"Test",mixcloud:"mixcloud.com/yuitruluv"})?.links[0].url).toBe("https://mixcloud.com/yuitruluv");
 });
 it("never serializes operational identity, rate or contact data",()=>{
  const data=sanitizeArtist({id:"test",stageName:"Test",bio:"A DJ",genres:["House"],contactEmail:"PRIVATE_EMAIL",contactPhone:"PRIVATE_PHONE",lineId:"PRIVATE_LINE",hourlyRate:123456,realName:"PRIVATE_NAME",user:{email:"PRIVATE_USER"}});
  expect(JSON.stringify(data)).not.toContain("PRIVATE");expect(JSON.stringify(data)).not.toContain("123456");expect(data?.name).toBe("Test");
 });
 it("does not publish staffing notes or unsafe social links",()=>{
  const data=sanitizeArtist({id:"test",stageName:"Test",bio:"Replacement every Monday, 2000 THB per shift",instagram:"https://evil.example/x",profileImage:"https://evil.example/photo"});expect(data?.bio).toBe("");expect(data?.image).toBeNull();expect(data?.links).toEqual([]);
 });
 it.each(["2000 THB per shift", "ค่าตัว 2000 บาทต่อกะ", "ไม่ว่างวันศุกร์", "ตารางงานส่งในกลุ่ม"])("screens independent Thai-field staffing notes: %s",bioTh=>{
  const data=sanitizeArtist({id:"test",stageName:"Test",bio:"House and disco DJ.",bioTh});
  expect(data?.bio).toBe("House and disco DJ.");expect(data?.bioTh).toBe("");
 });
 it("preserves a public Thai biography when both source fields are promotional",()=>{
  const data=sanitizeArtist({id:"test",stageName:"Test",bio:"House and disco DJ.",bioTh:"ดีเจแนวเฮาส์และดิสโก้"});
  expect(data?.bioTh).toBe("ดีเจแนวเฮาส์และดิสโก้");
 });
 it("allows curated local roster photos",()=>{
  const data=sanitizeArtist({id:"test",stageName:"Test",profileImage:"/agency/roster/test.jpg",images:["/agency/roster/test-live.jpg"]});
  expect(data?.image).toBe("/agency/roster/test.jpg");
  expect(data?.gallery).toEqual(["/agency/roster/test.jpg","/agency/roster/test-live.jpg"]);
 });
 it("adds missing supplemental artists without replacing an upstream record",()=>{
  const missing=withSupplementalArtists([]);
  expect(missing.some(artist=>artist.id==="dj-funktastic")).toBe(true);
  const upstream={id:"dj-funktastic",stageName:"Funktastic from API"};
  const merged=withSupplementalArtists([upstream]);
  expect(merged.filter(artist=>artist.id==="dj-funktastic")).toEqual([upstream]);
 });
});
