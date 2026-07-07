/**
 * True while Business.name still carries the first-sign-in provisioning
 * default ("<owner>'s Business" / "My Business" — lib/tenant.ts
 * createBusinessForUser) rather than a stage name the artist typed.
 *
 * Surfaces that display or SEND the name (wizard prefill, Control Room
 * stage-name field, white-label From) use this so a placeholder never
 * masquerades as a brand in front of a client or venue.
 *
 * Pure module — safe to import from client components (lib/tenant.ts is not).
 */
export function isProvisionedBusinessName(business: {
  name: string;
  ownerName: string | null;
}): boolean {
  if (business.name === "My Business") return true;
  return business.ownerName !== null && business.name === `${business.ownerName}'s Business`;
}
