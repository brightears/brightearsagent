// Artist profile editor (Phase 10.1) — what the sales agent pitches WITH.
// The strength meter + hunting license sit up top; the form below feeds them.
import { getCurrentBusiness } from "@/lib/tenant";
import { db } from "@/lib/db";
import { profileStrength } from "@/lib/profile/strength";
import { PageHeader } from "@/components/ui";
import { StickerChip } from "@/components/collage";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";

function StrengthMeter({
  percent,
  missing,
  canPitch,
  epkUrl,
}: {
  percent: number;
  missing: string[];
  canPitch: boolean;
  epkUrl: string;
}) {
  return (
    <div className="mb-6 rounded-3xl bg-ink-raised border border-cream/10 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-cream/70">
          Profile strength {percent}%
        </span>
        {canPitch ? (
          <StickerChip tone="magenta" rotate={-2}>
            Hunting license: active
          </StickerChip>
        ) : (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cream/40">
            Hunting license: not yet
          </span>
        )}
      </div>
      {/* Slim bar — ink-raised track, the show gradient at the lit end. */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-stage">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-magenta to-neon-orange transition-[width] duration-500"
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {missing.slice(0, 5).map((hint) => (
            <li key={hint} className="flex items-start gap-2 text-sm text-cream/55">
              <span aria-hidden className="mt-2 size-1 flex-none bg-neon-magenta" />
              {hint}
            </li>
          ))}
          {missing.length > 5 && (
            <li className="text-xs text-cream/35">…and {missing.length - 5} more once those land.</li>
          )}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-cream/55">
          Fully loaded. Every pitch goes out with the whole arsenal behind it.
        </p>
      )}
      <p className="mt-4 text-sm">
        <a
          href={epkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
        >
          View your press kit &rarr;
        </a>
      </p>
    </div>
  );
}

export default async function ProfilePage() {
  const business = await getCurrentBusiness();
  const [activePackages, gigs] = await Promise.all([
    db.package.count({ where: { businessId: business.id, active: true } }),
    db.gig.count({ where: { businessId: business.id } }),
  ]);

  const strength = profileStrength(business, { activePackages, gigs });

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <PageHeader
          title="Your ammunition"
          accent="ammunition"
          subtitle="The agent may hunt with a thin profile — it doesn't get to pitch until you give it something worth showing."
        />

        <StrengthMeter
          percent={strength.percent}
          missing={strength.missing}
          canPitch={strength.canPitch}
          epkUrl={`/epk/${business.slug}`}
        />

        <ProfileForm
          profile={{
            headline: business.headline,
            bio: business.bio,
            genres: business.genres,
            eventTypes: business.eventTypes,
            pitchLanguages: business.pitchLanguages,
            videoLinks: business.videoLinks,
            photoUrls: business.photoUrls,
            reviewQuotes: business.reviewQuotes,
            notableVenues: business.notableVenues,
            insured: business.insured,
            serviceCities: business.serviceCities,
            travelPolicy: business.travelPolicy,
            feeFloor: business.feeFloor,
            feeSweetSpot: business.feeSweetSpot,
            epkEnabled: business.epkEnabled,
            currency: business.currency,
          }}
        />
      </div>
    </main>
  );
}
