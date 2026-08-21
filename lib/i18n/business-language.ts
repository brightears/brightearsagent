/**
 * Add the local outreach language when a country has a deterministic primary
 * language. Never remove languages the artist already configured.
 */
export function pitchLanguagesForCountry(country: string, current: string[]): string[] {
  const local = country.trim().toUpperCase() === "TH" ? "th" : null;
  return local && !current.includes(local) ? [local, ...current] : current;
}
