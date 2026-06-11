// Shared UI kit — brand-styled primitives + the app design system (docs/DESIGN.md).
// Every dashboard screen composes these; screens never re-invent the patterns.
import Image from "next/image";
import type { ReactNode } from "react";
import type { LeadStatus } from "@/app/generated/prisma/enums";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm border border-off-white ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "cyan",
}: {
  children: ReactNode;
  tone?: "cyan" | "teal" | "lavender" | "peach" | "gray";
}) {
  const tones: Record<string, string> = {
    cyan: "bg-brand-cyan-soft text-deep-teal",
    teal: "bg-deep-teal text-white",
    lavender: "bg-soft-lavender text-white",
    peach: "bg-warm-peach text-ink",
    gray: "bg-off-white text-ink/70",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export const buttonStyles = {
  primary:
    "rounded-xl bg-brand-cyan text-white font-semibold px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-40",
  secondary:
    "rounded-xl border border-deep-teal/30 text-deep-teal font-semibold px-4 py-2 hover:border-brand-cyan hover:text-brand-cyan transition-colors disabled:opacity-40",
  danger:
    "rounded-xl border border-red-300 text-red-600 font-semibold px-4 py-2 hover:bg-red-50 transition-colors disabled:opacity-40",
};

/** The only sanctioned logo rendering — deep-teal tile, sized variants. */
export function BrightEarsLogo({ size = 28 }: { size?: 20 | 28 | 32 | 44 | 56 }) {
  const radius = size >= 44 ? "rounded-xl" : size >= 28 ? "rounded-lg" : "rounded";
  const pad = size >= 44 ? "p-1.5" : size >= 28 ? "p-1" : "p-0.5";
  return (
    <Image
      src="/brand/logo.svg"
      alt="Bright Ears"
      width={size}
      height={size}
      className={`bg-deep-teal ${radius} ${pad}`}
    />
  );
}

/** Soft gradient header band every dashboard page opens with (docs/DESIGN.md). */
export function PageHeader({
  title,
  subtitle,
  action,
  stats,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  stats?: ReactNode;
}) {
  return (
    <header className="rounded-3xl bg-gradient-to-r from-brand-cyan-soft/40 via-soft-lavender/20 to-warm-peach/30 px-6 py-6 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-deep-teal">{title}</h1>
          {subtitle && <p className="text-sm text-ink/60 mt-1">{subtitle}</p>}
          {stats && <div className="flex flex-wrap gap-2 mt-3">{stats}</div>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}

/** Small stat chip for PageHeader metrics. */
export function StatPill({ children, tone = "white" }: { children: ReactNode; tone?: "white" | "teal" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
        tone === "teal" ? "bg-deep-teal text-white" : "bg-white/80 text-deep-teal"
      }`}
    >
      {children}
    </span>
  );
}

/** Friendly empty state — never render a bare dash (docs/DESIGN.md). */
export function EmptyState({
  emoji,
  title,
  hint,
  cta,
  compact = false,
}: {
  emoji: string;
  title: string;
  hint?: string;
  cta?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? "py-4" : "py-12"}`}>
      <div className={compact ? "text-2xl mb-1" : "text-4xl mb-2"} aria-hidden>
        {emoji}
      </div>
      <p className={`font-semibold text-ink/70 ${compact ? "text-xs" : "text-sm"}`}>{title}</p>
      {hint && <p className={`text-ink/45 mt-1 ${compact ? "text-[11px]" : "text-xs"}`}>{hint}</p>}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}

/** Single source of truth for lead-status labels + colors (used by pipeline columns, badges, detail pages). */
export const LEAD_STATUS_META: Record<
  LeadStatus,
  { label: string; accent: string; badgeTone: "cyan" | "teal" | "lavender" | "peach" | "gray" }
> = {
  NEW: { label: "New", accent: "bg-brand-cyan", badgeTone: "cyan" },
  SPAM: { label: "Spam", accent: "bg-off-white", badgeTone: "gray" },
  DRAFTED: { label: "Reply ready", accent: "bg-soft-lavender", badgeTone: "lavender" },
  REPLIED: { label: "Replied", accent: "bg-brand-cyan-soft", badgeTone: "cyan" },
  IN_SEQUENCE: { label: "Following up", accent: "bg-warm-peach", badgeTone: "peach" },
  ENGAGED: { label: "Talking", accent: "bg-soft-lavender", badgeTone: "lavender" },
  BOOKED: { label: "Booked 🎉", accent: "bg-deep-teal", badgeTone: "teal" },
  DEAD: { label: "Gone quiet", accent: "bg-off-white", badgeTone: "gray" },
};
