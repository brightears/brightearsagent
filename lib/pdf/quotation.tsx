// Quotation PDF (June 2026). A clean, formal price quote built from the artist's
// OWN pricing (lib/quote/compute.ts) and the inquiry's facts. WHITE-LABEL: the
// artist's document — zero Bright Ears, zero "AI". Estimates are clearly marked
// as estimates; firm package/residency quotes show a firm figure. Never a price
// the artist didn't give us.
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/money";
import { quoteHeadline, type Quote } from "@/lib/quote/compute";

export type QuotationData = {
  artistName: string;
  contactEmail: string | null;
  websiteUrl: string | null;
  bookingLinkUrl: string | null;
  clientName: string | null;
  eventType: string | null;
  eventDateLabel: string | null;
  venue: string | null;
  guestCount: number | null;
  quote: Quote;
  quoteRef: string;
  issuedLabel: string;
  validUntilLabel: string;
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
  // line items
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 6 },
  thDesc: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: FAINT, letterSpacing: 1, textTransform: "uppercase" },
  thAmt: { width: 160, fontSize: 8, fontFamily: "Helvetica-Bold", color: FAINT, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" },
  trow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  tdDesc: { flex: 1, fontSize: 11, color: "#222" },
  tdSub: { fontSize: 9, color: MUTED, marginTop: 2 },
  tdAmt: { width: 160, fontSize: 11.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, alignItems: "baseline" },
  totalLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: FAINT, letterSpacing: 1, textTransform: "uppercase", marginRight: 14 },
  totalVal: { fontSize: 15, fontFamily: "Helvetica-Bold", color: ACCENT },
  note: { fontSize: 9, color: MUTED, lineHeight: 1.5, marginTop: 16 },
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

export function QuotationDocument({ data }: { data: QuotationData }) {
  const q = data.quote;
  const amountText = quoteHeadline(q);
  const details: { label: string; value: string }[] = [];
  if (data.clientName) details.push({ label: "Prepared for", value: data.clientName });
  if (data.eventType) details.push({ label: "Event", value: data.eventType });
  if (data.eventDateLabel) details.push({ label: "Date", value: data.eventDateLabel });
  if (data.venue) details.push({ label: "Venue", value: data.venue });
  if (data.guestCount) details.push({ label: "Guests", value: String(data.guestCount) });

  const contactLines = [
    data.contactEmail,
    data.websiteUrl,
    data.bookingLinkUrl && `Secure your date: ${data.bookingLinkUrl}`,
  ].filter(Boolean) as string[];

  return (
    <Document title={`Quotation — ${data.artistName}`} author={data.artistName}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <Text style={s.artist}>{data.artistName}</Text>
          <View>
            <Text style={s.docTitle}>Quotation</Text>
            <Text style={s.meta}>
              {data.quoteRef}
              {"\n"}Issued {data.issuedLabel}
            </Text>
          </View>
        </View>

        <View style={s.rule} />

        {details.length > 0 ? (
          <View style={{ marginBottom: 18 }}>
            <Text style={s.kicker}>Details</Text>
            <View style={s.detailGrid}>
              {details.map((d, i) => (
                <Detail key={i} label={d.label} value={d.value} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Line item */}
        <View style={s.thead}>
          <Text style={s.thDesc}>Description</Text>
          <Text style={s.thAmt}>{q.isEstimate ? "Estimate" : "Fee"}</Text>
        </View>
        <View style={s.trow}>
          <View style={{ flex: 1 }}>
            <Text style={s.tdDesc}>{q.label}</Text>
            {q.perNight ? <Text style={s.tdSub}>Per-night rate for a regular slot</Text> : null}
            {q.perHour ? <Text style={s.tdSub}>Per-hour rate for a regular slot</Text> : null}
            {q.coversHours ? (
              <Text style={s.tdSub}>Covers up to {q.coversHours} hours — longer runs quoted on request</Text>
            ) : null}
            {q.isEstimate ? <Text style={s.tdSub}>Estimate — final fee confirmed once details are locked in</Text> : null}
          </View>
          <Text style={s.tdAmt}>{amountText}</Text>
        </View>

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>{q.isEstimate ? "Estimated from" : "Total"}</Text>
          <Text style={s.totalVal}>{q.isEstimate ? formatMoney(q.minAmount, q.currency) : amountText}</Text>
        </View>

        <Text style={s.note}>
          This quotation is valid until {data.validUntilLabel}.
          {q.isEstimate
            ? " The figure above is a guide based on the details provided; the final fee is confirmed once the date, timings and specifics are agreed."
            : ""}
        </Text>

        {contactLines.length > 0 ? (
          <View style={s.footer} fixed>
            {contactLines.map((line, i) => (
              <Text key={i} style={s.footerLine}>{line}</Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderQuotationPdf(data: QuotationData): Promise<Buffer> {
  const buf = await renderToBuffer(<QuotationDocument data={data} />);
  return Buffer.from(buf);
}
