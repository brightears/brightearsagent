// Single source of truth for every country picker in the app (onboarding,
// settings, travel windows). PLAIN module — no "use server"; safe to import
// from client components and server actions alike.
//
// `COUNTRIES` is the full ISO-3166-1 alpha-2 list (common English names),
// sorted alphabetically by name, with the EXCLUDED jurisdictions filtered out
// so no dropdown ever offers them. `isAllowedCountry` is the server-side guard:
// a code is allowed only if it's a real ISO-2 country AND not excluded.

// ---------------------------------------------------------------------------
// EXCLUSION SET — EDITABLE BY THE FOUNDER.
//
// Comprehensively-sanctioned / embargoed jurisdictions we won't onboard or
// hunt into. Add or remove a two-letter code below and it disappears from /
// reappears in every picker automatically, and isAllowedCountry follows suit.
// Codes are ISO-3166-1 alpha-2, uppercase.
// ---------------------------------------------------------------------------
export const EXCLUDED_COUNTRY_CODES: ReadonlySet<string> = new Set([
  "KP", // North Korea — comprehensive US/UN embargo (OFAC).
  "IR", // Iran — comprehensive US sanctions program (OFAC).
  "SY", // Syria — comprehensive US sanctions program (OFAC).
  "CU", // Cuba — comprehensive US embargo (OFAC).
  "RU", // Russia — broad US/EU/UK sanctions (post-2022).
  "BY", // Belarus — broad US/EU/UK sanctions (post-2022).
]);

// Raw ISO-3166-1 alpha-2 list (code + common English name). NOT pre-sorted and
// NOT pre-filtered here — COUNTRIES below does both, so this stays a flat,
// easy-to-audit reference. ~249 entries (every assigned alpha-2 code).
const ALL_COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "AF", name: "Afghanistan" },
  { code: "AX", name: "Åland Islands" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AS", name: "American Samoa" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AI", name: "Anguilla" },
  { code: "AQ", name: "Antarctica" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AW", name: "Aruba" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BM", name: "Bermuda" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BQ", name: "Bonaire, Sint Eustatius and Saba" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BV", name: "Bouvet Island" },
  { code: "BR", name: "Brazil" },
  { code: "IO", name: "British Indian Ocean Territory" },
  { code: "BN", name: "Brunei Darussalam" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "KY", name: "Cayman Islands" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CX", name: "Christmas Island" },
  { code: "CC", name: "Cocos (Keeling) Islands" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo (Democratic Republic of the)" },
  { code: "CK", name: "Cook Islands" },
  { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CW", name: "Curaçao" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FK", name: "Falkland Islands (Malvinas)" },
  { code: "FO", name: "Faroe Islands" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GF", name: "French Guiana" },
  { code: "PF", name: "French Polynesia" },
  { code: "TF", name: "French Southern Territories" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece" },
  { code: "GL", name: "Greenland" },
  { code: "GD", name: "Grenada" },
  { code: "GP", name: "Guadeloupe" },
  { code: "GU", name: "Guam" },
  { code: "GT", name: "Guatemala" },
  { code: "GG", name: "Guernsey" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HM", name: "Heard Island and McDonald Islands" },
  { code: "VA", name: "Holy See" },
  { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IM", name: "Isle of Man" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JE", name: "Jersey" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KP", name: "Korea (Democratic People's Republic of)" },
  { code: "KR", name: "Korea (Republic of)" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Lao People's Democratic Republic" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macao" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "YT", name: "Mayotte" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia (Federated States of)" },
  { code: "MD", name: "Moldova (Republic of)" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MS", name: "Montserrat" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NC", name: "New Caledonia" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "NU", name: "Niue" },
  { code: "NF", name: "Norfolk Island" },
  { code: "MK", name: "North Macedonia" },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestine, State of" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PN", name: "Pitcairn" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "PR", name: "Puerto Rico" },
  { code: "QA", name: "Qatar" },
  { code: "RE", name: "Réunion" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russian Federation" },
  { code: "RW", name: "Rwanda" },
  { code: "BL", name: "Saint Barthélemy" },
  { code: "SH", name: "Saint Helena, Ascension and Tristan da Cunha" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "MF", name: "Saint Martin (French part)" },
  { code: "PM", name: "Saint Pierre and Miquelon" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SX", name: "Sint Maarten (Dutch part)" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "GS", name: "South Georgia and the South Sandwich Islands" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SJ", name: "Svalbard and Jan Mayen" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syrian Arab Republic" },
  { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania, United Republic of" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Türkiye" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UM", name: "United States Minor Outlying Islands" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Viet Nam" },
  { code: "VG", name: "Virgin Islands (British)" },
  { code: "VI", name: "Virgin Islands (U.S.)" },
  { code: "WF", name: "Wallis and Futuna" },
  { code: "EH", name: "Western Sahara" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];

/** Every valid ISO-3166-1 alpha-2 code (incl. excluded ones) — for validation. */
const VALID_CODES: ReadonlySet<string> = new Set(ALL_COUNTRIES.map((c) => c.code));

/**
 * The list every picker renders: full ISO-3166-1, MINUS the excluded
 * jurisdictions, sorted alphabetically by name (locale-aware so accented
 * names like "Åland Islands" sort sensibly).
 */
export const COUNTRIES: ReadonlyArray<{ code: string; name: string }> = ALL_COUNTRIES.filter(
  (c) => !EXCLUDED_COUNTRY_CODES.has(c.code),
).sort((a, b) => a.name.localeCompare(b.name, "en"));

/**
 * Server-side guard: a country code is allowed only if it's a real ISO-2 code
 * AND not in the excluded set. Case/whitespace tolerant. Use this in actions —
 * never trust the client to have shown only allowed options.
 */
export function isAllowedCountry(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return VALID_CODES.has(normalized) && !EXCLUDED_COUNTRY_CODES.has(normalized);
}

// ---------------------------------------------------------------------------
// Country → fee currency (ISO-3166-1 alpha-2 → ISO-4217).
//
// The artist quotes THEIR OWN clients in this currency (a Thai DJ quotes ฿THB) —
// derived from the country picked at onboarding, stored on Business.currency.
// STRICTLY separate from our own USD subscription billing. Unmapped/obscure
// codes fall back to USD; Eurozone members all map to EUR.
// ---------------------------------------------------------------------------
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", MX: "MXN",
  // Eurozone
  AD: "EUR", AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR",
  DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR", LU: "EUR",
  MT: "EUR", NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR", MC: "EUR",
  SM: "EUR", VA: "EUR", ME: "EUR", XK: "EUR", HR: "EUR",
  // Rest of Europe
  GB: "GBP", CH: "CHF", NO: "NOK", SE: "SEK", DK: "DKK", IS: "ISK", PL: "PLN",
  CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", UA: "UAH", RS: "RSD", AL: "ALL",
  MK: "MKD", BA: "BAM", MD: "MDL", GE: "GEL", AM: "AMD", AZ: "AZN", TR: "TRY",
  // Asia-Pacific
  TH: "THB", SG: "SGD", MY: "MYR", ID: "IDR", PH: "PHP", VN: "VND", KH: "KHR",
  LA: "LAK", MM: "MMK", IN: "INR", PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR",
  JP: "JPY", KR: "KRW", CN: "CNY", HK: "HKD", TW: "TWD", MO: "MOP", MN: "MNT",
  AU: "AUD", NZ: "NZD", FJ: "FJD", PG: "PGK",
  // Middle East
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD",
  LB: "LBP", IL: "ILS", IQ: "IQD",
  // Africa
  ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS", EG: "EGP", MA: "MAD", TN: "TND",
  DZ: "DZD", ET: "ETB", TZ: "TZS", UG: "UGX", RW: "RWF", ZM: "ZMW", BW: "BWP",
  NA: "NAD", MU: "MUR", SN: "XOF", CI: "XOF", CM: "XAF",
  // Latin America & Caribbean
  BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", UY: "UYU", PY: "PYG",
  BO: "BOB", VE: "VES", CR: "CRC", GT: "GTQ", DO: "DOP",
  JM: "JMD", TT: "TTD", BS: "BSD", BB: "BBD",
};

/**
 * The fee currency (ISO-4217) for a country code — what the artist quotes their
 * OWN clients in. Falls back to USD for unmapped/obscure codes. Case-tolerant.
 */
export function currencyForCountry(code: string | null | undefined): string {
  if (!code) return "USD";
  return COUNTRY_CURRENCY[code.trim().toUpperCase()] ?? "USD";
}
