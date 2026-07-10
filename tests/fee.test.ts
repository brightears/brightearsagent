import { describe, expect, it } from "vitest";
import { formatMinor, parseFeeToMinor } from "@/lib/quote/fee";

// 11.1 fee capture: the input is owner-typed and OPTIONAL — anything
// unparseable degrades to "no value recorded", never an error.

describe("parseFeeToMinor", () => {
  it("parses plain, grouped, decimal, and symbol-prefixed amounts", () => {
    expect(parseFeeToMinor("1500")).toBe(150000);
    expect(parseFeeToMinor("1,500")).toBe(150000);
    expect(parseFeeToMinor("1500.50")).toBe(150050);
    expect(parseFeeToMinor("฿15,000")).toBe(1500000);
    expect(parseFeeToMinor("$1,500.00")).toBe(150000);
  });
  it("rejects blank, zero, negative-ish, and garbage", () => {
    expect(parseFeeToMinor("")).toBeNull();
    expect(parseFeeToMinor("   ")).toBeNull();
    expect(parseFeeToMinor("0")).toBeNull();
    expect(parseFeeToMinor("free")).toBeNull();
  });
});

describe("formatMinor", () => {
  it("drops decimals on whole amounts, keeps them otherwise", () => {
    expect(formatMinor(1500000, "THB")).toBe("THB 15,000");
    expect(formatMinor(150050, "USD")).toBe("USD 1,500.50");
  });
});
