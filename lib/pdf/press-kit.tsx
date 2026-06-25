// Press-kit / EPK PDF (June 2026). A clean, print-optimized one/two-pager built
// from the artist's existing profile — the same data as the web /epk page, laid
// out for paper and email attachment. WHITE-LABEL: this is the ARTIST's press
// kit — zero Bright Ears branding, zero "AI". Rendered server-side via
// @react-pdf/renderer (lib/pdf/render.ts) and returned by /epk/[slug]/pdf.
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type PressKitData = {
  name: string;
  ownerName: string;
  performerKind: string; // e.g. "DJ", "MAGICIAN"
  headline: string | null;
  bio: string | null;
  genres: string[];
  eventTypes: string[];
  serviceCities: string[];
  travelPolicy: string | null;
  notableVenues: string[];
  reviewQuotes: string[];
  riderNotes: string | null;
  websiteUrl: string | null;
  bookingLinkUrl: string | null;
  socialLinks: string[];
  videoLinks: string[];
  contactEmail: string | null;
  photoDataUris: string[]; // pre-fetched, validated (lib/pdf/images.ts)
};

const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const FAINT = "#9a9a9a";
const ACCENT = "#1a5152"; // deep teal from the brand palette — tasteful, neutral
const HAIRLINE = "#e2e0df";

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 48, paddingHorizontal: 46, fontFamily: "Helvetica", color: INK },
  // Header
  name: { fontSize: 26, fontFamily: "Helvetica-Bold", letterSpacing: -0.5 },
  kind: { fontSize: 8, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 },
  headline: { fontSize: 12.5, color: MUTED, marginTop: 4, lineHeight: 1.35 },
  rule: { borderBottomWidth: 1, borderBottomColor: HAIRLINE, marginVertical: 16 },
  // Photos
  hero: { width: "100%", height: 220, objectFit: "cover", borderRadius: 4, marginBottom: 6 },
  strip: { flexDirection: "row", gap: 6, marginBottom: 4 },
  stripImg: { flex: 1, height: 90, objectFit: "cover", borderRadius: 3 },
  // Sections
  section: { marginTop: 16 },
  kicker: { fontSize: 8, fontFamily: "Helvetica-Bold", color: FAINT, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 },
  body: { fontSize: 10.5, lineHeight: 1.5, color: "#333" },
  row: { flexDirection: "row", gap: 24, marginTop: 16 },
  col: { flex: 1 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tag: { fontSize: 9, color: ACCENT, backgroundColor: "#eef3f3", borderRadius: 3, paddingVertical: 2.5, paddingHorizontal: 7 },
  quote: { fontSize: 10.5, fontFamily: "Helvetica-Oblique", color: "#333", lineHeight: 1.45, marginBottom: 6 },
  venues: { fontSize: 10, color: "#333", lineHeight: 1.6 },
  // Footer
  footer: { position: "absolute", bottom: 30, left: 46, right: 46, borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 10 },
  footerLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: FAINT, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 },
  footerLine: { fontSize: 9.5, color: "#333", lineHeight: 1.4 },
});

const kindLabel = (k: string) => k.toLowerCase().replace(/_/g, " ");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section} wrap={false}>
      <Text style={s.kicker}>{title}</Text>
      {children}
    </View>
  );
}

export function PressKitDocument({ data }: { data: PressKitData }) {
  const photos = data.photoDataUris;
  const hero = photos[0];
  const strip = photos.slice(1, 4);
  const contactLines = [
    data.contactEmail,
    data.websiteUrl,
    data.bookingLinkUrl && `Book: ${data.bookingLinkUrl}`,
    ...data.socialLinks.slice(0, 4),
  ].filter(Boolean) as string[];

  return (
    <Document title={`${data.name} — Press kit`} author={data.name}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View>
          <Text style={s.kind}>{kindLabel(data.performerKind)}</Text>
          <Text style={s.name}>{data.name}</Text>
          {data.headline ? <Text style={s.headline}>{data.headline}</Text> : null}
        </View>

        <View style={s.rule} />

        {/* Photos */}
        {hero ? <Image style={s.hero} src={hero} /> : null}
        {strip.length > 0 ? (
          <View style={s.strip}>
            {strip.map((p, i) => (
              <Image key={i} style={s.stripImg} src={p} />
            ))}
          </View>
        ) : null}

        {/* Bio */}
        {data.bio ? (
          <Section title="About">
            <Text style={s.body}>{data.bio}</Text>
          </Section>
        ) : null}

        {/* Style + reach */}
        <View style={s.row}>
          {data.genres.length > 0 ? (
            <View style={s.col}>
              <Text style={s.kicker}>Style</Text>
              <View style={s.tagWrap}>
                {data.genres.slice(0, 12).map((g, i) => (
                  <Text key={i} style={s.tag}>{g}</Text>
                ))}
              </View>
            </View>
          ) : null}
          {(data.serviceCities.length > 0 || data.travelPolicy) ? (
            <View style={s.col}>
              <Text style={s.kicker}>Where I play</Text>
              {data.serviceCities.length > 0 ? (
                <Text style={s.body}>{data.serviceCities.join(", ")}</Text>
              ) : null}
              {data.travelPolicy ? <Text style={[s.body, { marginTop: 3 }]}>{data.travelPolicy}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Event types */}
        {data.eventTypes.length > 0 ? (
          <Section title="What I do">
            <View style={s.tagWrap}>
              {data.eventTypes.slice(0, 12).map((e, i) => (
                <Text key={i} style={s.tag}>{e}</Text>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Reviews */}
        {data.reviewQuotes.length > 0 ? (
          <Section title="What clients say">
            {data.reviewQuotes.slice(0, 3).map((q, i) => (
              <Text key={i} style={s.quote}>&ldquo;{q}&rdquo;</Text>
            ))}
          </Section>
        ) : null}

        {/* Notable venues */}
        {data.notableVenues.length > 0 ? (
          <Section title="Rooms played">
            <Text style={s.venues}>{data.notableVenues.join("  ·  ")}</Text>
          </Section>
        ) : null}

        {/* Rider */}
        {data.riderNotes ? (
          <Section title="What I bring & need">
            <Text style={s.body}>{data.riderNotes}</Text>
          </Section>
        ) : null}

        {/* Footer — contact */}
        {contactLines.length > 0 ? (
          <View style={s.footer} fixed>
            <Text style={s.footerLabel}>Get in touch</Text>
            {contactLines.map((line, i) => (
              <Text key={i} style={s.footerLine}>{line}</Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/** Render the press kit to a PDF Buffer (keeps JSX out of route handlers). */
export async function renderPressKitPdf(data: PressKitData): Promise<Buffer> {
  const buf = await renderToBuffer(<PressKitDocument data={data} />);
  return Buffer.from(buf);
}
