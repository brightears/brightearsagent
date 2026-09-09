import {describe,expect,it,vi} from "vitest";
import {formatMusicBrief,briefEmailHref,EMPTY_BRIEF} from "@/lib/agency/brief";
import {POST} from "@/app/api/demo-reply/route";
const db=vi.hoisted(()=>({marketingContact:{upsert:vi.fn()}}));
vi.mock("@/lib/db",()=>({db}));
import {saveMarketingContact} from "@/app/actions/marketing";
describe("agency visitor handoff",()=>{
 it("preserves punctuation and non-Latin content without injecting email parameters",()=>{
  const brief={...EMPTY_BRIEF,occasion:"Brand & private",venue:"Rooftop & guests #1",sound:"Soul + house",name:"Test",email:"test@example.com",details:"Budget? Ask first. &bcc=someone@example.com"};
  const href=briefEmailHref(brief);
  const params=new URLSearchParams(href.split("?")[1]);
  expect(params.get("body")).toBe(formatMusicBrief(brief));
  expect(params.get("subject")).toBe("Music brief — Rooftop & guests #1");
  expect(params.has("bcc")).toBe(false);
  expect(formatMusicBrief(brief)).toContain("Date / start date: To be confirmed");
  expect(formatMusicBrief(brief)).not.toContain("Time / duration:");
 });
 it("never invokes the retired public LLM demo",async()=>{
  const response=await POST();
  expect(response.status).toBe(410);
  expect(await response.json()).toMatchObject({accountUrl:"/assistant"});
 });
 it("does not collect emails from cached acquisition forms",async()=>{
  expect(await saveMarketingContact({email:"visitor@example.com",source:"templates"})).toMatchObject({ok:false});
  expect(db.marketingContact.upsert).not.toHaveBeenCalled();
 });
});
