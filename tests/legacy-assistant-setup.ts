import {vi} from "vitest";
// Preserve regression coverage of historical engines without reactivating them
// in production. Retirement tests explicitly unmock this module and exercise
// the shipped policy, transports and entry points.
vi.mock("@/lib/assistant-runtime",()=>({ASSISTANT_RUNTIME_RETIRED:false,ASSISTANT_RETIRED_MESSAGE:"retired",assertAssistantRuntimeActive:()=>{}}));
