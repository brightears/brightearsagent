// Gig-brief PDF (P11.3). The one-pager an artist takes to the gig: what,
// when, where, timings, the client's asks, and who to call — every line
// grounded in the lead's parsed facts, the calendar entry, or an
// extraction-only pass over the actual thread. WHITE-LABEL: the artist's
// document — zero Bright Ears, zero "AI". Sections with nothing real to say
// are omitted, never padded.
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type GigBriefData = {
  artistName: string;
  performerLabel: string | null; // performer assigned to the gig (Studio), else null
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  eventType: string | null;
  eventDateLabel: string | null;
  venue: string | null;
  guestCount: number | null;
  setTimes: string | null; // "18:00–23:00" from the calendar entry, or thread-extracted
  feeLabel: string | null; // captured fee (11.1), owner's private record
  specialRequests: string[]; // thread-extracted, explicit asks only
  practicalNotes: string[]; // load-in, parking, power, contact-on-the-day…
  briefRef: string;
  issuedLabel: string;
};

const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const FAINT = "#9a9a9a";
const ACCENT = "#1a5152";
const HAIRLINE = "#e2e0df";

const s = StyleSheet.create({
  page: { paddingTop: 46, paddingBottom: 48, paddingHorizontal: 48, fontFamily: "Helvetica", color: INK, fontSize: 10.5 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  artist: { fontSize: 20, fontFamily: "Helvetica-Bold", letterSpacing: -0.4 },
  docTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 2, textTransform: "uppercase", textAlign: "right" },
  meta: { fontSize: 9, color: MUTED, textAlign: "right", marginTop: 4, lineHeight: 1.5 },
  rule: { borderBottomWidth: 1, borderBottomColor: HAIRLINE, marginVertical: 18 },
  kicker: { fontSize: 8, fontFamily: "Helvetica-Bold", color: FAINT, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap" },
  detail: { width: "50%", marginBottom: 8 },
  detailLabel: { fontSize: 8, color: FAINT, marginBottom: 1 },
  detailVal: { fontSize: 10.5, color: "#333" },
  section: { marginBottom: 16 },
  bulletRow: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 12, fontSize: 10.5, color: ACCENT },
  bulletText: { flex: 1, fontSize: 10.5, color: "#333", lineHeight: 1.45 },
  note: { fontSize: 9, color: MUTED, lineHeight: 1.5, marginTop: 4 },
  footer: { position: "absolute", bottom: 30, left: 48, right: 48, borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 10 },
  footerLine: { fontSize: 9, color: "#333", lineHeight: 1.45 },
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detail}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailVal}>{value}</Text>
    </View>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={s.section}>
      <Text style={s.kicker}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function GigBriefDocument({ data }: { data: GigBriefData }) {
  const details: { label: string; value: string }[] = [];
  if (data.eventType) details.push({ label: "Event", value: data.eventType });
  if (data.eventDateLabel) details.push({ label: "Date", value: data.eventDateLabel });
  if (data.setTimes) details.push({ label: "Set times", value: data.setTimes });
  if (data.venue) details.push({ label: "Venue", value: data.venue });
  if (data.guestCount) details.push({ label: "Guests", value: String(data.guestCount) });
  if (data.performerLabel) details.push({ label: "Performing", value: data.performerLabel });
  if (data.feeLabel) details.push({ label: "Fee (agreed)", value: data.feeLabel });

  const contact = [
    data.clientName,
    data.clientEmail,
    data.clientPhone,
  ].filter(Boolean) as string[];

  return (
    <Document title={`Gig brief — ${data.artistName}`} author={data.artistName}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <Text style={s.artist}>{data.artistName}</Text>
          <View>
            <Text style={s.docTitle}>Gig brief</Text>
            <Text style={s.meta}>
              {data.briefRef}
              {"\n"}Issued {data.issuedLabel}
            </Text>
          </View>
        </View>

        <View style={s.rule} />

        {details.length > 0 ? (
          <View style={s.section}>
            <Text style={s.kicker}>The booking</Text>
            <View style={s.detailGrid}>
              {details.map((d, i) => (
                <Detail key={i} label={d.label} value={d.value} />
              ))}
            </View>
          </View>
        ) : null}

        <Bullets title="Special requests" items={data.specialRequests} />
        <Bullets title="Practical notes" items={data.practicalNotes} />

        {contact.length > 0 ? (
          <View style={s.section}>
            <Text style={s.kicker}>Client contact</Text>
            <View style={s.detailGrid}>
              {data.clientName ? <Detail label="Name" value={data.clientName} /> : null}
              {data.clientEmail ? <Detail label="Email" value={data.clientEmail} /> : null}
              {data.clientPhone ? <Detail label="Phone" value={data.clientPhone} /> : null}
            </View>
          </View>
        ) : null}

        <Text style={s.note}>
          Everything above comes from the booking conversation and your calendar — check anything
          marked unclear directly with the client.
        </Text>

        <View style={s.footer} fixed>
          <Text style={s.footerLine}>{data.artistName}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderGigBriefPdf(data: GigBriefData): Promise<Buffer> {
  const buf = await renderToBuffer(<GigBriefDocument data={data} />);
  return Buffer.from(buf);
}
