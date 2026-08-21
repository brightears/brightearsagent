"use client";

// Pitch review on the Hunt card (Phase 10.3) — the founder-approved UX: "the
// system will post it and the artist can decide if or if not to engage."
// Client component because Edit needs an inline textarea and Draft needs a
// friendly error surface; all decisions still run through the tenant-scoped
// server actions in app/actions/venues.ts.

import { useState, useTransition } from "react";
import { Badge, buttonStyles } from "@/components/ui";
import {
  approveVenuePitch,
  authorizeVenuePitchCopy,
  discardVenuePitch,
  draftVenuePitch,
  editVenuePitch,
  recordManualVenuePitchSend,
  sendVenuePitch,
  skipVenuePitch,
} from "@/app/actions/venues";
import {
  VENUE_PITCH_DISCARD_REASONS,
  type VenuePitchDiscardReason,
} from "@/lib/feedback/owner-controls";
import { SKIP_REASONS, type SkipReason } from "@/lib/venues/feed";
import { useI18n } from "@/components/locale-provider";
import { languageTag } from "@/lib/i18n/config";

const THAI_DISCARD_REASONS: Record<VenuePitchDiscardReason, string> = {
  WRONG_DETAILS: "รายละเอียดไม่ถูกต้อง",
  WRONG_TONE: "สำนวนไม่เหมือนฉัน",
  TOO_GENERIC: "ข้อความกว้างเกินไป",
  WRONG_APPROACH: "ลองใช้มุมอื่น",
  HANDLE_MYSELF: "ฉันจะเขียนเอง",
};
const THAI_SKIP_REASONS: Record<SkipReason, string> = {
  WRONG_VIBE: "บรรยากาศไม่เหมาะ",
  TOO_FAR: "ไกลเกินไป",
  BELOW_FEE: "ค่าจ้างต่ำกว่าเรตของฉัน",
  NO_ENTERTAINMENT: "ไม่รับการแสดงประเภทของฉัน",
  STALE_OR_CLOSED: "ปิดแล้วหรือข้อมูลเก่า",
  NOT_INTERESTED: "ไม่สนใจ",
};

/** The slice of a VenuePitch row the review card renders. */
export type HuntPitch = {
  id: string;
  subject: string;
  body: string;
  status: "PENDING" | "APPROVED";
  jurisdictionMode: string; // "STANDARD" | "CONSENT" | "STRICT"
  language: string;
  editedSubject: string | null;
  editedBody: string | null;
  voiceSampleSavedAt: Date | string | null;
  /** 10.5: set once the pitch sent from the artist's own mailbox. */
  sentAt: Date | string | null;
};

/** "Draft pitch" with an inline error line (LLM hiccups deserve words, not silence). */
export function DraftPitchButton({ venueId }: { venueId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await draftVenuePitch(venueId);
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending ? t("dashboard.pitch.writing") : t("dashboard.pitch.draft")}
      </button>
      {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function VenuePitchReview({
  pitch,
  /** Jurisdiction note for the card — empty string when mode is STANDARD-no-note. */
  jurisdictionNote,
  /** Compliance close, precomputed server-side — appended on copy, never editable. */
  footer,
  /** 10.5: a sending mailbox is connected — gates "Send now" on STANDARD cards. */
  mailboxConnected = false,
  /** Physical sender identity is mandatory for every outreach handoff. */
  postalAddressReady = false,
}: {
  pitch: HuntPitch;
  jurisdictionNote: string;
  footer: string;
  mailboxConnected?: boolean;
  postalAddressReady?: boolean;
}) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyPrepared, setCopyPrepared] = useState(false);
  const [saveVoiceExample, setSaveVoiceExample] = useState(false);
  const [voiceExampleSaved, setVoiceExampleSaved] = useState(!!pitch.voiceSampleSavedAt);
  // Optimistic sent flag — the action also flips the venue to PITCHED (it then
  // leaves the hunt feed), but this gives instant feedback on the card.
  const [sentAt, setSentAt] = useState<Date | string | null>(pitch.sentAt);

  const [subject, setSubject] = useState(pitch.editedSubject ?? pitch.subject);
  const [body, setBody] = useState(pitch.editedBody ?? pitch.body);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftBody, setDraftBody] = useState(body);
  const hasDraftEdits =
    draftSubject.trim() !== subject.trim() || draftBody.trim() !== body.trim();

  // Consent-first jurisdictions and languages without complete deterministic
  // semantic validation are manual-review handoffs — never auto-send.
  const consentFirst = pitch.jurisdictionMode !== "STANDARD";
  const manualReviewLanguage = pitch.language.trim().toLowerCase() !== "en";
  const handoff = consentFirst || manualReviewLanguage;
  const canSend = !handoff && pitch.status === "APPROVED" && mailboxConnected && !sentAt;
  const sentLabel = sentAt
    ? new Date(sentAt).toLocaleString(languageTag(locale), {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const run = (action: () => Promise<{ ok: boolean } | { ok: false; error: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError("error" in result ? result.error : "Something went sideways — try again");
    });

  const copyPitch = async () => {
    if (!postalAddressReady) {
      return {
        ok: false as const,
        error: "Add your business mailing address in Settings before copying this pitch",
      };
    }
    // Copying is preparation, not proof of send or a compliance decision.
    // Re-check suppression immediately before facilitating the handoff.
    const result = await authorizeVenuePitchCopy(pitch.id);
    if (!result.ok) return result;
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}${footer}`);
    setCopied(true);
    setCopyPrepared(true);
    setTimeout(() => setCopied(false), 2000);
    return result;
  };

  return (
    <div className="mt-4 border-t border-ink-stage/10 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-stage/50">
          {t("dashboard.pitch.draft")}
        </p>
        {sentAt ? (
          <Badge tone="teal">{t("dashboard.pitch.sent")}</Badge>
        ) : (
          pitch.status === "APPROVED" && <Badge tone="cyan">{t("dashboard.pitch.ready")}</Badge>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <input
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            maxLength={120}
            aria-label={t("dashboard.pitch.subject")}
            className="w-full rounded-xl border border-ink-stage/15 bg-cream/60 px-3 py-1.5 text-sm font-bold text-ink-stage focus:outline-none focus:ring-2 focus:ring-brand-cyan"
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={8}
            maxLength={4000}
            aria-label={t("dashboard.pitch.body")}
            className="w-full rounded-xl border border-ink-stage/15 bg-cream/60 px-3 py-2 text-sm text-ink-stage focus:outline-none focus:ring-2 focus:ring-brand-cyan"
          />
          {hasDraftEdits && !voiceExampleSaved && (
            <div className="rounded-xl bg-cream/60 px-3 py-2.5">
              <label className="flex items-start gap-2 text-sm font-semibold text-ink-stage/80">
                <input
                  type="checkbox"
                  checked={saveVoiceExample}
                  onChange={(event) => setSaveVoiceExample(event.target.checked)}
                  disabled={pending}
                  className="mt-0.5 size-4 accent-brand-cyan"
                />
                {t("dashboard.pitch.saveVoice")}
              </label>
              <p className="ml-6 mt-1 text-xs text-ink-stage/50">
                {t("dashboard.pitch.saveVoiceHint")}
              </p>
            </div>
          )}
          {voiceExampleSaved && (
            <p className="text-xs font-semibold text-ink-stage/55">
              {t("dashboard.pitch.voiceSaved")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
              onClick={() =>
                run(async () => {
                  const result = await editVenuePitch(
                    pitch.id,
                    draftSubject,
                    draftBody,
                    saveVoiceExample,
                  );
                  if (result.ok) {
                    setSubject(draftSubject.trim());
                    setBody(draftBody.trim());
                    if (
                      "voiceExampleSaved" in result &&
                      result.voiceExampleSaved
                    ) {
                      setVoiceExampleSaved(true);
                    }
                    setSaveVoiceExample(false);
                    setEditing(false);
                  }
                  return result;
                })
              }
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              disabled={pending}
              className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm`}
              onClick={() => {
                setDraftSubject(subject);
                setDraftBody(body);
                setSaveVoiceExample(false);
                setEditing(false);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm font-bold text-ink-stage">{subject}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-stage/80">{body}</p>
        </>
      )}

      {jurisdictionNote && (
        <p className="mt-2.5 flex items-start gap-2 text-xs text-ink-stage/75">
          <span aria-hidden className="mt-1.5 size-1 flex-none bg-neon-orange" />
          {jurisdictionNote}
        </p>
      )}

      {sentAt && sentLabel && (
        <p className="mt-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
          {t("dashboard.pitch.sentAt", {
            date: sentLabel,
            method: handoff ? t("dashboard.pitch.byYou") : t("dashboard.pitch.fromMailbox"),
          })}
        </p>
      )}

      {!sentAt && pitch.status === "APPROVED" && (
        <p className="mt-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
          {handoff ? (
            !postalAddressReady ? (
              <>
                <a
                  href="/dashboard/settings#business-mailing-address"
                  className="text-brand-cyan hover:opacity-80"
                >
                  {t("dashboard.pitch.addAddress")}
                </a>{" "}
                {t("dashboard.pitch.beforeCopy")}
              </>
            ) : consentFirst ? (
              t("dashboard.pitch.lawful")
            ) : (
              t("dashboard.pitch.reviewEvery")
            )
          ) : mailboxConnected ? (
            t("dashboard.pitch.fromInbox")
          ) : (
            <>
              <a
                href="/dashboard/settings#connections"
                className="text-brand-cyan hover:opacity-80"
              >
                {t("dashboard.pitch.connect")}
              </a>{" "}
              {t("dashboard.pitch.toSend")}
            </>
          )}
        </p>
      )}

      {!editing && !sentAt && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {pitch.status === "PENDING" && (
            <>
              <button
                type="button"
                disabled={pending}
                className={`${buttonStyles.primary} min-h-11 w-full px-3.5 py-1.5 text-sm sm:min-h-0 sm:w-auto`}
                onClick={() => run(() => approveVenuePitch(pitch.id))}
              >
                {t("dashboard.pitch.approve")}
              </button>
              <button
                type="button"
                disabled={pending}
                className={`${buttonStyles.secondaryOnLight} min-h-11 flex-1 px-3.5 py-1.5 text-sm sm:min-h-0 sm:flex-none`}
                onClick={() => {
                  setDraftSubject(subject);
                  setDraftBody(body);
                  setEditing(true);
                }}
              >
                {t("common.edit")}
              </button>
            </>
          )}
          {/* Auto-send is English + STANDARD only. Consent-first and other
              language drafts remain review/copy handoffs. */}
          {canSend && (
            <button
              type="button"
              disabled={pending}
              className={`${buttonStyles.primary} min-h-11 w-full px-3.5 py-1.5 text-sm sm:min-h-0 sm:w-auto`}
              onClick={() =>
                run(async () => {
                  const result = await sendVenuePitch(pitch.id);
                  if (result.ok) setSentAt(new Date());
                  return result;
                })
              }
            >
              {pending ? t("dashboard.pitch.sending") : t("dashboard.pitch.send")}
            </button>
          )}
          {handoff && pitch.status === "APPROVED" && (
            <>
              <button
                type="button"
                disabled={pending || !postalAddressReady}
                className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-45`}
                onClick={() => run(copyPitch)}
              >
                {copied ? t("dashboard.pitch.copied") : t("dashboard.pitch.copy")}
              </button>
              {copyPrepared && (
                <button
                  type="button"
                  disabled={pending || !postalAddressReady}
                  className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
                  onClick={() =>
                    run(async () => {
                      const result = await recordManualVenuePitchSend(
                        pitch.id,
                        consentFirst,
                      );
                      if (result.ok) setSentAt(new Date());
                      return result;
                    })
                  }
                >
                  {consentFirst
                    ? t("dashboard.pitch.lawfulSent")
                    : t("dashboard.pitch.reviewedSent")}
                </button>
              )}
            </>
          )}
          <details className="relative">
            <summary
              className={`${buttonStyles.secondaryOnLight} inline-block cursor-pointer list-none px-3.5 py-1.5 text-sm [&::-webkit-details-marker]:hidden`}
              title={t("dashboard.pitch.discardTitle")}
            >
              {t("dashboard.pitch.discard")}
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
              <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
                {t("dashboard.pitch.fix")}
              </p>
              {(Object.keys(VENUE_PITCH_DISCARD_REASONS) as VenuePitchDiscardReason[]).map(
                (reason) => (
                  <button
                    key={reason}
                    type="button"
                    disabled={pending}
                    className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream disabled:opacity-50"
                    onClick={() => run(() => discardVenuePitch(pitch.id, reason))}
                  >
                    {locale === "th"
                      ? THAI_DISCARD_REASONS[reason]
                      : VENUE_PITCH_DISCARD_REASONS[reason]}
                  </button>
                ),
              )}
            </div>
          </details>
          <details className="relative">
            <summary
              className={`${buttonStyles.secondaryOnLight} inline-block cursor-pointer list-none px-3.5 py-1.5 text-sm [&::-webkit-details-marker]:hidden`}
              title={t("dashboard.pitch.notFitTitle")}
            >
              {t("dashboard.hunt.notFit")}
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
              <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
                {t("dashboard.hunt.whatMissed")}
              </p>
              {(Object.keys(SKIP_REASONS) as SkipReason[]).map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={pending}
                  className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream disabled:opacity-50"
                  onClick={() => run(() => skipVenuePitch(pitch.id, reason))}
                >
                  {locale === "th" ? THAI_SKIP_REASONS[reason] : SKIP_REASONS[reason]}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
