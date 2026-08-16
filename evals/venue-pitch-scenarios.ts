import type { VenuePitchRequest } from "../lib/agent/venue-pitch";

const EPK_ROOT = "https://brightears.io/epk";

type PitchExpectation = {
  mustInclude?: RegExp[];
  mustNotInclude?: RegExp[];
};

export type VenuePitchScenario = {
  name: string;
  request: VenuePitchRequest;
  expect: PitchExpectation;
};

function request(
  slug: string,
  business: VenuePitchRequest["business"],
  venue: VenuePitchRequest["venue"],
  language = "en",
): VenuePitchRequest {
  return { business, venue, language, epkUrl: `${EPK_ROOT}/${slug}` };
}

const DJ: VenuePitchRequest["business"] = {
  id: null,
  name: "Night Atlas",
  ownerName: "Maya Reyes",
  performerKind: "DJ",
  voiceSamples:
    "Hey — thanks for thinking of me. I build the room gradually, then keep the floor moving without turning every set into the same playlist. Happy to keep it simple.",
  headline: "Open-format DJ for rooms that want a real arc",
  bio: "Maya has played bars, rooftops and private events for twelve years.",
  genres: ["disco", "house", "open format"],
  eventTypes: ["club night", "rooftop", "private party"],
  serviceCities: ["Austin"],
  gigTypes: ["one-off", "residency"],
  riderNotes: "I bring a controller and laptop; the venue provides a house PA and stable table.",
  feeFloor: 70000,
  feeSweetSpot: 100000,
  reviewQuotes: ["She reads the room instead of forcing a playlist."],
  notableVenues: ["The East Room"],
  recentGigs90d: 9,
};

const BAND: VenuePitchRequest["business"] = {
  id: null,
  name: "Cedar & Gold",
  ownerName: "Alex Morgan",
  performerKind: "BAND",
  voiceSamples:
    "Hi — lovely to meet you. We play warm acoustic sets that can sit under conversation and still turn into a proper singalong later on.",
  headline: "Acoustic soul duo for intimate rooms",
  bio: "A two-piece vocal and guitar act with a flexible dinner-to-late set.",
  genres: ["soul", "folk", "acoustic pop"],
  eventTypes: ["restaurant", "hotel lounge", "private event"],
  serviceCities: ["Manchester"],
  gigTypes: ["one-off", "residency"],
  riderNotes: "Compact vocal and guitar setup; we can bring a small PA.",
  reviewQuotes: [],
  notableVenues: ["The Whitworth Lounge"],
};

const MAGICIAN: VenuePitchRequest["business"] = {
  id: null,
  name: "Rosa Marvelli",
  ownerName: "Rosa Chen",
  performerKind: "MAGICIAN",
  voiceSamples:
    "Hello — I work close-up, moving between tables and giving people something to talk about without interrupting the event around them.",
  headline: "Close-up magic that starts conversations",
  bio: "Rosa performs roaming close-up magic for hotels, weddings and corporate receptions.",
  genres: ["close-up", "roaming", "interactive"],
  eventTypes: ["wedding", "hotel", "corporate reception"],
  serviceCities: ["Chicago"],
  gigTypes: ["one-off"],
  riderNotes: "No stage or technical setup needed for roaming close-up work.",
  reviewQuotes: ["Guests were still talking about the card reveal at breakfast."],
  notableVenues: [],
};

const COMEDIAN: VenuePitchRequest["business"] = {
  id: null,
  name: "Dev Sharma Comedy",
  ownerName: "Dev Sharma",
  performerKind: "COMEDIAN",
  voiceSamples:
    "Hey — I do sharp, room-aware stand-up and can keep it clean when the brief calls for it. No generic corporate routine pasted onto the night.",
  headline: "Smart stand-up built for the room",
  bio: "Dev performs club and corporate sets, with material adapted to the audience.",
  genres: ["observational", "clean corporate", "club"],
  eventTypes: ["comedy night", "awards", "corporate event"],
  serviceCities: ["New York"],
  gigTypes: ["one-off"],
  riderNotes: "A wired microphone, stand and simple stage wash are enough.",
  reviewQuotes: [],
  notableVenues: ["Union Hall"],
};

const DANCER: VenuePitchRequest["business"] = {
  id: null,
  name: "Velvet Duo Cabaret",
  ownerName: "Ana Silva",
  performerKind: "DANCER",
  voiceSamples:
    "Hello — we're a two-person cabaret act with choreography, costume and a compact footprint. We like building a set around the room rather than dropping in a generic show.",
  headline: "Modern cabaret for dinner and late-night rooms",
  bio: "Ana and Luisa perform two-part cabaret and dance sets for supper clubs and galas.",
  genres: ["cabaret", "jazz", "contemporary"],
  eventTypes: ["supper club", "gala", "dinner show"],
  serviceCities: ["Lisbon"],
  gigTypes: ["one-off", "residency"],
  riderNotes: "A clear 4x4 metre floor and one sound input; no aerial rigging.",
  reviewQuotes: [],
  notableVenues: [],
};

export const VENUE_PITCH_SCENARIOS: VenuePitchScenario[] = [
  {
    name: "dj-hot-rooftop-opening",
    request: request("night-atlas", DJ, {
      name: "Halo Roof",
      city: "Austin",
      country: "US",
      kind: "ROOFTOP",
      temperature: "HOT",
      signals: ["Halo Roof announced a new sunset roof deck opening in September"],
      fitReasons: ["Books late-evening music for its rooftop crowd"],
    }),
    expect: { mustInclude: [/Halo|roof|opening/i], mustNotInclude: [/wedding package/i] },
  },
  {
    name: "band-warm-existing-thursday-program",
    request: request("cedar-and-gold", BAND, {
      name: "Northlight Kitchen",
      city: "Manchester",
      country: "GB",
      kind: "RESTAURANT",
      temperature: "WARM",
      signals: [],
      entertainmentEvidence: ["Its events page lists acoustic duos every Thursday"],
      fitReasons: ["An acoustic soul duo suits its dinner programme"],
    }),
    expect: {
      mustInclude: [/Thursday|acoustic/i],
      mustNotInclude: [/looking for|your job post|free (?:set|night)|guarantee/i],
    },
  },
  {
    name: "magician-seed-wedding-venue",
    request: request("rosa-marvelli", MAGICIAN, {
      name: "Linden House",
      city: "Chicago",
      country: "US",
      kind: "EVENT_SPACE",
      temperature: "SEED",
      signals: ["Linden House hosts weddings and corporate receptions"],
      entertainmentEvidence: [],
      fitReasons: ["Roaming close-up magic works during drinks receptions"],
    }),
    expect: {
      mustInclude: [/Linden|wedding|reception|close-up/i],
      mustNotInclude: [/\bDJ(?:s|ing)?\b|playlist|follow up|check back/i],
    },
  },
  {
    name: "comedian-warm-comedy-series",
    request: request("dev-sharma-comedy", COMEDIAN, {
      name: "Morrow Hall",
      city: "New York",
      country: "US",
      kind: "EVENT_SPACE",
      temperature: "WARM",
      signals: [],
      entertainmentEvidence: ["Morrow Hall runs a monthly new-comics showcase"],
      fitReasons: ["The room already programmes stand-up"],
    }),
    expect: {
      mustInclude: [/monthly|comic|stand-up|showcase/i],
      mustNotInclude: [/\bDJ(?:s|ing)?\b|dance floor|free (?:set|night)|revenue|profit/i],
    },
  },
  {
    name: "dancer-hot-supper-club-launch",
    request: request("velvet-duo-cabaret", DANCER, {
      name: "Maré Supper Club",
      city: "Lisbon",
      country: "PT",
      kind: "RESTAURANT",
      temperature: "HOT",
      signals: ["Maré announced its October supper-club launch with live floor shows"],
      fitReasons: ["A compact two-part cabaret fits a dinner-show format"],
    }),
    expect: {
      mustInclude: [/Maré|supper|launch|cabaret/i],
      mustNotInclude: [/\bDJ(?:s|ing)?\b|playlist/i],
    },
  },
  {
    name: "dj-travel-date-bounded",
    request: request("night-atlas", DJ, {
      name: "Miradouro 9",
      city: "Lisbon",
      country: "PT",
      kind: "ROOFTOP",
      temperature: "HOT",
      signals: ["Miradouro 9 is adding guest DJs for its August rooftop series"],
      fitReasons: ["Its sunset programme matches disco and house"],
      travelWindow: { city: "Lisbon", dateRange: "August 4-11" },
    }),
    expect: {
      mustInclude: [/Lisbon/i, /August 4[-–]11/i],
      mustNotInclude: [/based in Lisbon|local Lisbon|available anytime/i],
    },
  },
  {
    name: "band-german-language-warm",
    request: request(
      "cedar-and-gold",
      BAND,
      {
        name: "Hotel Morgenrot",
        city: "Berlin",
        country: "DE",
        kind: "HOTEL",
        temperature: "WARM",
        signals: [],
        entertainmentEvidence: ["Die Hotel-Website nennt jeden Freitag akustische Live-Musik"],
        fitReasons: ["Akustischer Soul passt zur Hotellounge"],
      },
      "de",
    ),
    expect: {
      mustInclude: [/Freitag|akustisch|Live-Musik|Hotel Morgenrot/i],
      mustNotInclude: [/free (?:set|night)|guarantee|\bDJ(?:s|ing)?\b/i],
    },
  },
];
