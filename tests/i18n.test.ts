import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  isLocale,
  languageTag,
  localeFromAcceptLanguage,
} from "@/lib/i18n/config";
import { translate, translator } from "@/lib/i18n/messages";
import { pitchLanguagesForCountry } from "@/lib/i18n/business-language";

describe("locale selection", () => {
  it("accepts only supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("th")).toBe(true);
    expect(isLocale("th-TH")).toBe(false);
    expect(isLocale("de")).toBe(false);
  });

  it("chooses Thai from weighted browser preferences", () => {
    expect(localeFromAcceptLanguage("en-US;q=0.5, th-TH;q=0.9")).toBe("th");
    expect(localeFromAcceptLanguage("th,en;q=0.8")).toBe("th");
  });

  it("falls back to English for missing or unsupported preferences", () => {
    expect(localeFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage("de-DE,fr;q=0.8")).toBe("en");
  });

  it("returns valid formatting tags", () => {
    expect(languageTag("en")).toBe("en-US");
    expect(languageTag("th")).toBe("th-TH");
  });
});

describe("translations", () => {
  it("serves English and Thai from the same stable key", () => {
    expect(translate("en", "nav.calendar")).toBe("Calendar");
    expect(translate("th", "nav.calendar")).toBe("ปฏิทิน");
  });

  it("builds a locale-bound translator", () => {
    expect(translator("th")("common.save")).toBe("บันทึก");
  });
});

describe("Thai business defaults", () => {
  it("adds Thai to a Thai business without removing existing languages", () => {
    expect(pitchLanguagesForCountry("TH", ["en"])).toEqual(["th", "en"]);
    expect(pitchLanguagesForCountry("th", ["th", "en"])).toEqual(["th", "en"]);
  });

  it("does not guess a language for other countries", () => {
    expect(pitchLanguagesForCountry("GB", ["en"])).toEqual(["en"]);
  });
});
