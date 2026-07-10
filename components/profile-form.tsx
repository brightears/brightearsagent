"use client";

// Artist-profile editor (Phase 10.1) — the ammunition the sales agent pitches
// with. One form, sectioned into white Cards with editorial Kickers (DESIGN.md
// v2.1 rule 2). Tag inputs are comma-separated text, split server-side (v1).
import { useActionState, useState } from "react";
import { updateArtistProfile } from "@/app/actions/profile";
import { Card, Kicker, buttonStyles } from "@/components/ui";
import { PhotoUploader } from "@/components/photo-uploader";

export type ArtistProfile = {
  headline: string | null;
  bio: string | null;
  genres: string[];
  eventTypes: string[];
  pitchLanguages: string[];
  videoLinks: string[];
  photoUrls: string[];
  socialLinks: string[];
  riderNotes: string | null;
  reviewQuotes: string[];
  notableVenues: string[];
  insured: boolean;
  travelPolicy: string | null;
  feeFloor: number | null;
  feeSweetSpot: number | null;
  gigTypes: string[];
  acceptsTravel: boolean;
  residencyRate: number | null;
  residencyRateUnit: string;
  oneOffHours: number | null;
  epkEnabled: boolean;
  currency: string;
};

// Form styling per docs/DESIGN.md v2 — cream-tinted inputs on white cards, cyan focus ring.
const inputCls =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-base sm:text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-stage/60 mb-1";
const hintCls = "mt-1 text-xs text-ink-stage/45";

const cents = (v: number | null) => (v === null ? "" : String(v / 100));

export function ProfileForm({
  profile,
  uploadsEnabled,
}: {
  profile: ArtistProfile;
  uploadsEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) =>
      updateArtistProfile(formData),
    null,
  );
  // When uploads are on, photos are managed by the uploader and submitted via a
  // hidden field; otherwise the textarea (paste URLs) carries them.
  const [photoUrls, setPhotoUrls] = useState(profile.photoUrls);

  return (
    <form action={formAction} className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-5">
          <Kicker onLight>The basics</Kicker>
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="headline" className={labelCls}>
              Headline
            </label>
            <input
              id="headline"
              name="headline"
              maxLength={80}
              placeholder="High-energy act for rooms that want a full dance floor"
              defaultValue={profile.headline ?? ""}
              className={inputCls}
            />
            <p className={hintCls}>One line, under 80 characters — it&apos;s what a venue reads first.</p>
          </div>
          <div>
            <label htmlFor="bio" className={labelCls}>
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={5}
              placeholder="40-120 words, in your voice. Who you are, what a night with you sounds like, why rooms rebook you."
              defaultValue={profile.bio ?? ""}
              className={inputCls}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-5">
          <Kicker onLight>Your act</Kicker>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="genres" className={labelCls}>
              Genres &amp; vibe
            </label>
            <input
              id="genres"
              name="genres"
              placeholder="house, disco, open format, motown"
              defaultValue={profile.genres.join(", ")}
              className={inputCls}
            />
            <p className={hintCls}>Comma-separated, 5-10 tags. How the agent matches you to venues.</p>
          </div>
          <div>
            <label htmlFor="eventTypes" className={labelCls}>
              Event types
            </label>
            <input
              id="eventTypes"
              name="eventTypes"
              placeholder="weddings, corporate, club nights, private parties"
              defaultValue={profile.eventTypes.join(", ")}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pitchLanguages" className={labelCls}>
              Pitch languages
            </label>
            <input
              id="pitchLanguages"
              name="pitchLanguages"
              placeholder="en, th"
              defaultValue={profile.pitchLanguages.join(", ")}
              className={inputCls}
            />
            <p className={hintCls}>Language codes the agent may pitch in. Defaults to en.</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-5">
          <Kicker onLight>Proof</Kicker>
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="videoLinks" className={labelCls}>
              Performance videos
            </label>
            <textarea
              id="videoLinks"
              name="videoLinks"
              rows={2}
              placeholder={"https://youtube.com/watch?v=...\nhttps://vimeo.com/..."}
              defaultValue={profile.videoLinks.join("\n")}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
            />
            <p className={hintCls}>One YouTube or Vimeo link per line. The first one headlines your press kit.</p>
          </div>
          <div>
            <label htmlFor="photoUrls" className={labelCls}>
              Photos
            </label>
            {uploadsEnabled ? (
              <>
                <PhotoUploader
                  value={photoUrls}
                  onAdd={(u) => setPhotoUrls((p) => [...p, u])}
                  onRemove={(u) => setPhotoUrls((p) => p.filter((x) => x !== u))}
                />
                <input type="hidden" name="photoUrls" value={photoUrls.join("\n")} />
                <p className={hintCls}>A great action shot wins bookings — add a few, your best first.</p>
              </>
            ) : (
              <>
                <textarea
                  id="photoUrls"
                  name="photoUrls"
                  rows={4}
                  placeholder={"https://...jpg — one image URL per line"}
                  defaultValue={profile.photoUrls.join("\n")}
                  className={`${inputCls} font-mono text-xs leading-relaxed`}
                />
                <p className={hintCls}>
                  Paste direct image URLs (your site, Google Photos share, Dropbox) — at least 3. Uploads come later.
                </p>
              </>
            )}
          </div>
          <div>
            <label htmlFor="socialLinks" className={labelCls}>
              Social &amp; streaming links
            </label>
            <textarea
              id="socialLinks"
              name="socialLinks"
              rows={3}
              placeholder={"https://instagram.com/...\nhttps://soundcloud.com/...\nhttps://open.spotify.com/artist/..."}
              defaultValue={profile.socialLinks.join("\n")}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
            />
            <p className={hintCls}>
              Instagram, TikTok, X, SoundCloud, Mixcloud, Spotify, YouTube — one link per line. They show on your press kit.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reviewQuotes" className={labelCls}>
                Client quotes
              </label>
              <textarea
                id="reviewQuotes"
                name="reviewQuotes"
                rows={3}
                placeholder={"Best decision of our wedding.\nThe floor never emptied."}
                defaultValue={profile.reviewQuotes.join("\n")}
                className={inputCls}
              />
              <p className={hintCls}>1-3 short quotes, one per line.</p>
            </div>
            <div>
              <label htmlFor="notableVenues" className={labelCls}>
                Notable venues
              </label>
              <input
                id="notableVenues"
                name="notableVenues"
                placeholder="The Driskill, Hotel Van Zandt"
                defaultValue={profile.notableVenues.join(", ")}
                className={inputCls}
              />
              <p className={hintCls}>Bookers recognize rooms, not bios.</p>
              <label className="mt-4 flex items-center gap-2.5 text-sm text-ink-stage/80">
                <input
                  type="checkbox"
                  name="insured"
                  defaultChecked={profile.insured}
                  className="size-4 accent-brand-cyan"
                />
                We carry liability insurance
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2">
          <Kicker onLight>Rate &amp; reach</Kicker>
        </h3>
        <p className={`${hintCls} mb-5`}>
          The cities you&apos;re based in live in{" "}
          <a href="#hunt" className="font-semibold text-brand-cyan hover:opacity-80">
            Where you hunt
          </a>
          .
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <span className={labelCls}>What you take on</span>
            <div className="flex flex-wrap gap-2.5">
              <label className="flex items-center gap-2 rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage/80">
                <input
                  type="checkbox"
                  name="gigTypes"
                  value="one-off"
                  defaultChecked={profile.gigTypes.includes("one-off")}
                  className="size-4 accent-brand-cyan"
                />
                One-off gigs
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage/80">
                <input
                  type="checkbox"
                  name="gigTypes"
                  value="residency"
                  defaultChecked={profile.gigTypes.includes("residency")}
                  className="size-4 accent-brand-cyan"
                />
                Residencies (regular slots)
              </label>
            </div>
            <p className={hintCls}>
              Most artists do both — a one-off party and a regular weekly slot price differently.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="travelPolicy" className={labelCls}>
              Travel policy
            </label>
            <input
              id="travelPolicy"
              name="travelPolicy"
              placeholder="Within 100 miles included; beyond that, travel at cost."
              defaultValue={profile.travelPolicy ?? ""}
              className={inputCls}
            />
            <label className="mt-2.5 flex items-center gap-2.5 text-sm text-ink-stage/80">
              <input
                type="checkbox"
                name="acceptsTravel"
                defaultChecked={profile.acceptsTravel}
                className="size-4 accent-brand-cyan"
              />
              Open to travel beyond my home cities
            </label>
            <p className={hintCls}>
              When on, the agent surfaces strong rooms outside your service cities too.
            </p>
          </div>
          <div>
            <label htmlFor="feeFloor" className={labelCls}>
              One-off floor ({profile.currency})
            </label>
            <input
              id="feeFloor"
              name="feeFloor"
              inputMode="numeric"
              placeholder="1200"
              defaultValue={cents(profile.feeFloor)}
              className={inputCls}
            />
            <p className={hintCls}>The agent never pitches a one-off below this. Whole {profile.currency}.</p>
            <div className="mt-2">
              <label htmlFor="oneOffHours" className={labelCls}>
                Covers up to (hours)
              </label>
              <input
                id="oneOffHours"
                name="oneOffHours"
                inputMode="numeric"
                placeholder="4"
                defaultValue={profile.oneOffHours ?? ""}
                className={inputCls}
              />
              <p className={hintCls}>
                What the one-off price includes, e.g. 4 hours — quotes say it, so nobody argues later.
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="feeSweetSpot" className={labelCls}>
              Sweet spot ({profile.currency})
            </label>
            <input
              id="feeSweetSpot"
              name="feeSweetSpot"
              inputMode="numeric"
              placeholder="1800"
              defaultValue={cents(profile.feeSweetSpot)}
              className={inputCls}
            />
            <p className={hintCls}>The fee the agent aims for.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="residencyRate" className={labelCls}>
              Residency rate ({profile.currency})
            </label>
            <div className="flex gap-2">
              <input
                id="residencyRate"
                name="residencyRate"
                inputMode="numeric"
                placeholder="800"
                defaultValue={cents(profile.residencyRate)}
                className={`${inputCls} min-w-0 flex-1`}
              />
              <select
                name="residencyRateUnit"
                aria-label="Residency rate unit"
                defaultValue={profile.residencyRateUnit ?? "night"}
                className="flex-none rounded-xl border border-cream bg-cream/40 px-3 py-2 text-base sm:text-sm text-ink-stage focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors"
              >
                <option value="night">per night</option>
                <option value="hour">per hour</option>
              </select>
            </div>
            <p className={hintCls}>
              Your going rate for a regular slot — kept separate from the one-off floor. Pick the
              unit so a quote can never be read two ways.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="riderNotes" className={labelCls}>
              How you perform &amp; what you need
            </label>
            <textarea
              id="riderNotes"
              name="riderNotes"
              rows={4}
              placeholder={"How your set works and what the venue provides — space, power, sound, setup time, what you bring, what's included."}
              defaultValue={profile.riderNotes ?? ""}
              className={inputCls}
            />
            <p className={hintCls}>
              Your rider, in plain words. The agent uses it to answer setup questions in replies — and never invents one.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2.5 text-sm text-ink-stage/80">
              <input
                type="checkbox"
                name="epkEnabled"
                defaultChecked={profile.epkEnabled}
                className="size-4 accent-brand-cyan"
              />
              Keep my press kit page live
            </label>
            <p className={hintCls}>
              Your hosted one-page press kit — every pitch the agent sends links to it.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        {state?.ok && (
          <span className="rounded-full bg-brand-cyan-soft px-3 py-1 text-sm font-semibold text-ink-stage">
            Saved
          </span>
        )}
        {state && !state.ok && (
          <span className="text-sm font-medium text-red-400">{state.error}</span>
        )}
      </div>
    </form>
  );
}
