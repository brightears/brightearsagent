// Pure decision: which PDFs get attached to a reply. Manual approve uses the
// owner's explicit checkbox choices; auto-send derives them from the artist's
// autonomy toggles AND the drafter's detected intent — so a quote only ever
// auto-attaches when the artist opted in AND the client actually asked.
export type AttachDecision = { pressKit: boolean; quote: boolean };

export function resolveAttachments(input: {
  autoAttach: boolean;
  // manual choices
  attachPressKit?: boolean;
  attachQuote?: boolean;
  // autonomy toggles
  autoAttachProfile: boolean;
  autoAttachQuote: boolean;
  // detected intent
  wantsProfile: boolean;
  wantsQuote: boolean;
}): AttachDecision {
  if (input.autoAttach) {
    return {
      pressKit: input.autoAttachProfile && input.wantsProfile,
      quote: input.autoAttachQuote && input.wantsQuote,
    };
  }
  return { pressKit: !!input.attachPressKit, quote: !!input.attachQuote };
}
