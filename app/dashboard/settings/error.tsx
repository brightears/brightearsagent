"use client";

// Friendly error boundary for the settings route (audit C3-NF). The billing
// server actions (startCheckout / openBillingPortal) throw on misconfiguration
// ("Billing not configured yet", "No subscription yet", a Stripe hiccup); without
// this a thrown action crashed to an unstyled Next error page mid-flow.
import { buttonStyles } from "@/components/ui";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 text-center">
        <h1 className="text-xl font-extrabold text-cream-bright">Something hit a snag</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-cream/70">
          {error.message || "We couldn't complete that just now."} Your account is unchanged — give
          it another try, or head back to your pipeline.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className={buttonStyles.primary}>
            Try again
          </button>
          <a href="/dashboard" className={buttonStyles.secondary}>
            Back to pipeline
          </a>
        </div>
      </div>
    </main>
  );
}
