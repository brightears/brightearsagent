import { db } from "@/lib/db";
import { notifyBusiness } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import { videoEmbedUrl } from "@/lib/profile/video";

/**
 * EPK freshness monitor (P12.6). The one-pager is what every pitch links to
 * — a dead photo or a 404'd video quietly kills conversions, and "no live
 * video" is bookers' #1 deal-breaker. Weekly sweep (rides the report cron):
 * checks the ARTIST-OWNED links (video, photos, website, booking link) and
 * nags via notifyBusiness only when something is actually wrong.
 *
 * Honesty discipline for link-rot: only a hard 404/410 or a dead host
 * counts as BROKEN. 403/429/timeouts are bot walls and slow hosts — flagging
 * those would train the owner to ignore the nag. Social links are skipped
 * entirely (Instagram/Facebook always wall bots).
 */

export type LinkCheck = { url: string; broken: boolean };

export async function checkUrl(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<LinkCheck> {
  try {
    let res = await fetchFn(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    // Plenty of hosts refuse HEAD — retry once as GET before judging.
    if (res.status === 405 || res.status === 501) {
      res = await fetchFn(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(6000),
      });
    }
    return { url, broken: res.status === 404 || res.status === 410 };
  } catch (err) {
    // DNS failure = the host itself is gone → broken. Timeouts/aborts = unknown.
    const message = (err as Error & { cause?: { code?: string } })?.cause?.code ?? "";
    return { url, broken: message === "ENOTFOUND" };
  }
}

export type FreshnessReport = {
  businessId: string;
  brokenLinks: string[];
  /** Bookers' #1 deal-breaker: no playable video on the page. */
  missingVideo: boolean;
};

export async function checkEpkFreshness(
  business: {
    id: string;
    videoLinks: string[];
    photoUrls: string[];
    websiteUrl: string | null;
    bookingLinkUrl: string | null;
  },
  fetchFn: typeof fetch = fetch,
): Promise<FreshnessReport> {
  const urls = [
    ...business.videoLinks,
    ...business.photoUrls,
    business.websiteUrl,
    business.bookingLinkUrl,
  ].filter((u): u is string => !!u && /^https?:\/\//i.test(u));

  const checks = await Promise.all(urls.map((u) => checkUrl(u, fetchFn)));
  const missingVideo = !business.videoLinks.some((u) => videoEmbedUrl(u) !== null);

  return {
    businessId: business.id,
    brokenLinks: checks.filter((c) => c.broken).map((c) => c.url),
    missingVideo,
  };
}

/** Weekly sweep over EPK-enabled paying tenants; per-tenant failures isolated. */
export async function runEpkFreshnessSweep(
  fetchFn: typeof fetch = fetch,
): Promise<{ checked: number; nagged: number }> {
  const businesses = await db.business.findMany({
    where: { epkEnabled: true, plan: { not: "TRIAL" } },
  });

  let nagged = 0;
  for (const business of businesses) {
    try {
      const report = await checkEpkFreshness(business, fetchFn);
      if (report.brokenLinks.length === 0 && !report.missingVideo) continue;

      const problems = [
        ...(report.missingVideo
          ? [
              "No playable video on your page — bookers' #1 deal-breaker. Add one YouTube or Vimeo link in the Control room.",
            ]
          : []),
        ...report.brokenLinks.map((u) => `Broken link (page not found): ${u}`),
      ];
      await notifyBusiness(business, {
        title: "Your one-pager needs a touch-up",
        body: report.missingVideo
          ? "It has no playable video — the #1 thing bookers look for."
          : `${report.brokenLinks.length} link${report.brokenLinks.length === 1 ? " is" : "s are"} dead on your page.`,
        url: "/dashboard/settings#profile",
        emailBody: `Your one-pager is what every pitch links to — and this week's check found:\n\n${problems
          .map((p) => `- ${p}`)
          .join("\n")}\n\nTwo minutes in the Control room fixes it.`,
      });
      nagged++;
    } catch (err) {
      void reportError(err, { kind: "epk-freshness", businessId: business.id });
    }
  }
  return { checked: businesses.length, nagged };
}
