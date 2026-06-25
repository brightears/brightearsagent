import { describe, it, expect } from "vitest";
import React from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";

describe("pdf pipeline smoke", () => {
  it("renders a trivial PDF to a buffer that starts with %PDF", async () => {
    const buf = await renderToBuffer(
      <Document>
        <Page size="A4">
          <View>
            <Text>Hello press kit</Text>
          </View>
        </Page>
      </Document>,
    );
    expect(buf.length).toBeGreaterThan(500);
    expect(Buffer.from(buf.subarray(0, 5)).toString()).toBe("%PDF-");
  });
});
