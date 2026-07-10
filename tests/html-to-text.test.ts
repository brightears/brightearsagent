import { describe, expect, it } from "vitest";
import { htmlToText } from "@/lib/inbound/html-to-text";

// 10.9: HTML-only inbound bodies are stripped ONCE in processInbound. The
// critical property: a form notification's labeled fields keep their
// field-per-line shape, because the fallback parser's prompt relies on it.

describe("htmlToText", () => {
  it("keeps labeled form fields one per line", () => {
    const html =
      "<div><p>Name: Jess Park</p><p>Email: jess@example.com</p><p>Event date: 09/14/2026</p></div>";
    expect(htmlToText(html)).toBe("Name: Jess Park\nEmail: jess@example.com\nEvent date: 09/14/2026");
  });

  it("drops script/style/head subtrees and comments entirely", () => {
    const html =
      "<head><title>x</title></head><style>.a{color:red}</style><script>alert(1)</script><!-- hi --><p>Hello there</p>";
    expect(htmlToText(html)).toBe("Hello there");
  });

  it("converts br/li and decodes entities", () => {
    const html = "Dates:<br><ul><li>Sept 14 &amp; 15</li><li>Budget &pound;?&nbsp;&mdash; ask</li></ul>";
    const text = htmlToText(html);
    expect(text).toContain("- Sept 14 & 15");
    expect(text).toContain("—");
    expect(text).not.toContain("&amp;");
  });

  it("decodes numeric entities and collapses blank-line runs", () => {
    expect(htmlToText("<p>&#72;i&#x21;</p><br><br><br><p>Bye</p>")).toBe("Hi!\n\nBye");
  });
});
