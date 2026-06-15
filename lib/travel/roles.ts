// Travel Mode role tags — the kinds of work an artist can have the Hunt look
// for in a travel city. Plain module (NOT "use server"): both the server
// actions (app/actions/travel.ts) and the client settings card import these,
// and a "use server" file may only export async functions.
export const TRAVEL_ROLE_TAGS = ["guest-spot", "residency", "private-event"] as const;
export type TravelRoleTag = (typeof TRAVEL_ROLE_TAGS)[number];
