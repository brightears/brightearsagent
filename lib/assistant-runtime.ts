/** The retired AI-manager cannot send, draft or launch background discovery.
 * The agency LINE relay and search-only service are separate, retained features.
 * Reactivation requires an explicit product decision and a reviewed code change.
 */
export const ASSISTANT_RUNTIME_RETIRED = true;
export const ASSISTANT_RETIRED_MESSAGE = "The artist assistant has been retired. Your saved work and billing settings remain available.";
export class AssistantRetiredError extends Error {
 constructor(){super(ASSISTANT_RETIRED_MESSAGE);this.name="AssistantRetiredError";}
}
export function assertAssistantRuntimeActive(){if(ASSISTANT_RUNTIME_RETIRED)throw new AssistantRetiredError();}
