// Tiny shared UI kit — brand-styled primitives. Keep it boring and small.
import type { ReactNode } from "react";

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
