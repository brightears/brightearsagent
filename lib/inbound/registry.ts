import type { SourceParser } from "@/lib/inbound/types";
import { theKnotParser } from "@/lib/inbound/parsers/theknot";
import { weddingwireParser } from "@/lib/inbound/parsers/weddingwire";
import { barkParser } from "@/lib/inbound/parsers/bark";
import { gigsaladParser } from "@/lib/inbound/parsers/gigsalad";

// Deterministic source parsers, tried in order before the LLM fallback.
export const sourceParsers: SourceParser[] = [
  theKnotParser,
  weddingwireParser,
  barkParser,
  gigsaladParser,
];
