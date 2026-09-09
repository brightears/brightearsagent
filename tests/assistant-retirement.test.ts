import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.unmock("@/lib/assistant-runtime");
const mockDb=vi.hoisted(()=>({mailboxConnection:{findUnique:vi.fn(),update:vi.fn()},business:{findUnique:vi.fn()},$queryRaw:vi.fn(),opsStamp:{findMany:vi.fn(),upsert:vi.fn()}}));
vi.mock("@/lib/db",()=>({db:mockDb}));
vi.mock("@/lib/sequences/engine",()=>({runSequenceTick:vi.fn()}));
import {sendEmail} from "@/lib/outbound/send";
import {sendGmail,getValidAccessToken} from "@/lib/outbound/gmail";
import {ASSISTANT_RUNTIME_RETIRED,AssistantRetiredError} from "@/lib/assistant-runtime";
import {GET as sequenceCron} from "@/app/api/cron/sequences/route";
import {GET as health} from "@/app/api/health/route";
import {runSequenceTick} from "@/lib/sequences/engine";
import {NextRequest} from "next/server";
const fetchMock=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("fetch",fetchMock);});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("shipped assistant retirement policy",()=>{
 it("is enabled independently of environment",()=>{expect(ASSISTANT_RUNTIME_RETIRED).toBe(true);});
 it.each(["postmark","dev","missing"])("blocks %s delivery before transport or outbox writes",async mode=>{
  vi.stubEnv("POSTMARK_SERVER_TOKEN",mode==="missing"?"":"configured-token");vi.stubEnv("EMAIL_TRANSPORT",mode==="dev"?"dev":"");
  await expect(sendEmail({fromName:"test",to:"test@example.com",replyTo:"test@example.com",subject:"test",textBody:"test"})).rejects.toBeInstanceOf(AssistantRetiredError);expect(fetchMock).not.toHaveBeenCalled();
 });
 it("blocks Gmail and refresh before reading stored credentials",async()=>{
  await expect(sendGmail("owner",{toEmail:"test@example.com",subject:"test",body:"test"},fetchMock)).rejects.toBeInstanceOf(AssistantRetiredError);
  await expect(getValidAccessToken("owner",fetchMock)).rejects.toBeInstanceOf(AssistantRetiredError);
  expect(mockDb.mailboxConnection.findUnique).not.toHaveBeenCalled();expect(mockDb.mailboxConnection.update).not.toHaveBeenCalled();expect(fetchMock).not.toHaveBeenCalled();
 });
 it("authenticates retired cron requests without claiming completed work",async()=>{
  vi.stubEnv("NODE_ENV","production");vi.stubEnv("CRON_SECRET","test-secret");
  const bad=await sequenceCron(new NextRequest("https://brightears.io/api/cron/sequences"));expect(bad.status).toBe(401);
  const good=await sequenceCron(new NextRequest("https://brightears.io/api/cron/sequences",{headers:{authorization:"Bearer test-secret"}}));expect(await good.json()).toEqual({status:"retired",workPerformed:false});expect(runSequenceTick).not.toHaveBeenCalled();expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
 });
 it("keeps real DB and retained service readiness without obsolete cron/provider dependencies",async()=>{
  for(const [k,v] of Object.entries({NODE_ENV:"production",DATABASE_URL:"postgresql://fixture",APP_URL:"https://brightears.io",SERPER_API_KEY:"fixture",STRIPE_SECRET_KEY:"sk_live_fixture",STRIPE_WEBHOOK_SECRET:"whsec_fixture",NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:"pk_live_fixture",CLERK_SECRET_KEY:"sk_live_fixture",POSTMARK_SERVER_TOKEN:"",OPENROUTER_API_KEY:"",GOOGLE_OAUTH_CLIENT_ID:"",VAPID_PUBLIC_KEY:""}))vi.stubEnv(k,v);
  mockDb.$queryRaw.mockResolvedValue([{ok:1}]);const ok=await health();expect(ok.status).toBe(200);expect(await ok.json()).toMatchObject({assistantRuntime:"retired",crons:{},db:true});expect(mockDb.opsStamp.findMany).not.toHaveBeenCalled();
  vi.stubEnv("SERPER_API_KEY","");expect((await health()).status).toBe(503);
  mockDb.$queryRaw.mockRejectedValue(new Error("Database unavailable"));expect((await health()).status).toBe(503);
 });
});
