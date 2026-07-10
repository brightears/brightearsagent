// Per-performerKind query packs (P12.1 — founder-elevated: the product is
// for EVERY freelance artist, so the Hunt must speak every performer kind's
// buyer language, not DJ dialect). Pure module: the Serper batteries and the
// extraction prompt consume these; the caps in serper.ts stay untouched —
// kind-awareness recuts the SAME query budget, it never grows it.
import type { PerformerKind } from "@/app/generated/prisma/enums";

export type KindPack = {
  /** Venue-side program language, quoted for search ("comedy night" OR "stand-up"). */
  programTerms: string;
  /** A recurring-slot phrasing for the "every friday/saturday" query. */
  recurringTerm: string;
  /** The kind's OWN room/buyer expansion query (theaters, planners, resorts…). */
  buyerQuery: string;
  /** One plain word for the Instagram-surface query. */
  instagramTerm: string;
  /** How to name the act in the extraction prompt ("a DJ or live act"). */
  actLabel: string;
  /** Program evidence the extractor should treat as HOSTS_ENTERTAINMENT. */
  programExamples: string;
};

const PACKS: Record<PerformerKind, KindPack> = {
  DJ: {
    programTerms: `"DJ nights" OR "resident DJ" OR "guest DJs"`,
    recurringTerm: "DJ",
    buyerQuery: `beach club OR pool party OR "day club" DJ bookings`,
    instagramTerm: "DJ",
    actLabel: "a DJ",
    programExamples: "DJ nights, resident DJ slots, club programming",
  },
  BAND: {
    programTerms: `"live music" OR "live band" OR "bands wanted"`,
    recurringTerm: `"live band"`,
    buyerQuery: `"music venue" OR "concert hall" OR festival "book a band"`,
    instagramTerm: "livemusic",
    actLabel: "a live band",
    programExamples: "live-music programs, band nights, festival lineups",
  },
  SINGER: {
    programTerms: `"live singer" OR "acoustic night" OR "live vocalist"`,
    recurringTerm: `"acoustic night"`,
    buyerQuery: `"supper club" OR "jazz bar" OR "piano bar" singer`,
    instagramTerm: "livemusic",
    actLabel: "a singer",
    programExamples: "acoustic nights, vocalist residencies, supper-club sets",
  },
  MUSICIAN: {
    programTerms: `"live music" OR "acoustic sets" OR "resident musician"`,
    recurringTerm: `"live music"`,
    buyerQuery: `"jazz bar" OR "wine bar" OR restaurant "live musician"`,
    instagramTerm: "livemusic",
    actLabel: "a musician",
    programExamples: "live-music evenings, acoustic sets, restaurant residencies",
  },
  MAGICIAN: {
    programTerms: `"magician" OR "close-up magic" OR "magic show"`,
    recurringTerm: `"magic night"`,
    buyerQuery: `"corporate event planner" OR "family entertainment" magician`,
    instagramTerm: "magician",
    actLabel: "a magician",
    programExamples: "magic nights, close-up table magic, family entertainment programs",
  },
  DANCER: {
    programTerms: `"dance show" OR "cabaret" OR "dancers"`,
    recurringTerm: "cabaret",
    buyerQuery: `"dinner show" OR theater OR "cabaret venue" dancers`,
    instagramTerm: "cabaret",
    actLabel: "a dancer or dance act",
    programExamples: "cabaret shows, dinner-show programs, resident dance acts",
  },
  MC: {
    programTerms: `"MC" OR "host" OR "compere" events`,
    recurringTerm: `"quiz night"`,
    buyerQuery: `"corporate event planner" OR "awards night" OR conference MC host`,
    instagramTerm: "eventhost",
    actLabel: "an MC or event host",
    programExamples: "hosted event nights, quiz nights, awards programs",
  },
  PHOTO_BOOTH: {
    programTerms: `"photo booth" events`,
    recurringTerm: `"photo booth"`,
    buyerQuery: `"wedding venue" OR "event planner" "photo booth"`,
    instagramTerm: "photobooth",
    actLabel: "a photo booth service",
    programExamples: "photo-booth partnerships at weddings and corporate events",
  },
  COMEDIAN: {
    programTerms: `"comedy night" OR "stand-up" OR "open mic comedy"`,
    recurringTerm: `"comedy night"`,
    buyerQuery: `"comedy club" OR theater "comedy night" bookings`,
    instagramTerm: "comedy",
    actLabel: "a comedian",
    programExamples: "comedy nights, stand-up showcases, open-mic programs",
  },
  OTHER: {
    programTerms: `"live entertainment" OR "entertainment program"`,
    recurringTerm: `"live entertainment"`,
    buyerQuery: `"event planner" OR "entertainment agency" OR theater bookings`,
    instagramTerm: "entertainment",
    actLabel: "a live entertainer",
    programExamples: "live-entertainment programs and event bookings",
  },
};

export function kindPack(kind: string | null | undefined): KindPack {
  return PACKS[(kind ?? "OTHER") as PerformerKind] ?? PACKS.OTHER;
}
