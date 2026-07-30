const DAY = 24 * 3600 * 1000;

/**
 * The next sequence check is anchored to the successful send, not draft
 * creation. currentStep is one-based; after the final step we revisit in two
 * days to close the silent lead.
 */
export function nextRunAtAfterStep(
  stepsDays: number[],
  currentStep: number,
  sentAt: Date,
): Date {
  const followingStepIndex = currentStep;
  const gapDays =
    followingStepIndex < stepsDays.length
      ? Math.max(
          1,
          stepsDays[followingStepIndex] - stepsDays[Math.max(0, currentStep - 1)],
        )
      : 2;
  return new Date(sentAt.getTime() + gapDays * DAY);
}
