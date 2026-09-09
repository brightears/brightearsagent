import { beforeEach, describe, expect, it, vi } from "vitest";
vi.unmock("@/lib/assistant-runtime");
vi.mock("@/lib/db", () => ({ db: {} }));
import { AssistantRetiredError } from "@/lib/assistant-runtime";
import { makeLiveDeps, runContactPass } from "@/lib/discovery/contacts";
import { SerperDiscoveryProvider } from "@/lib/discovery/serper";

describe("retired discovery cannot spend the retained Serper key", () => {
  const fetchFn = vi.fn();
  beforeEach(() => vi.clearAllMocks());
  it("blocks the legacy provider before any request or query accounting", async () => {
    const provider = new SerperDiscoveryProvider({ apiKey: "fixture", fetchFn });
    await expect(provider.searchVenueSignals({ city: "Bangkok", country: "th" }, { now: new Date() })).rejects.toBeInstanceOf(AssistantRetiredError);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(provider.queriesUsed).toBe(0);
  });
  it("blocks direct use of the legacy contact transport", async () => {
    const deps = makeLiveDeps({ apiKey: "fixture", fetchFn });
    await expect(deps.serperSearch("Example Bangkok")).rejects.toBeInstanceOf(AssistantRetiredError);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(deps.queries()).toBe(0);
  });
  it("blocks contact passes before database access", async () => {
    await expect(runContactPass("fixture-business")).rejects.toBeInstanceOf(AssistantRetiredError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
