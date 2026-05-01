import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLabsByLocation, locationToSlug, slugToLocation } from "@/lib/public-labs";
import { LabsSiteFooter, LabsSiteHeader } from "@/components/public/labs-site-chrome";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { location: string } }): Promise<Metadata> {
  const location = slugToLocation(params.location);
  return {
    title: `Best Labs in ${location} | DiagSync`,
    description: `Explore top diagnostic laboratories in ${location}.`,
  };
}

export default async function LabsByLocationPage({ params }: { params: { location: string } }) {
  const locationLabel = slugToLocation(params.location);
  const labs = await getPublicLabsByLocation(params.location);
  if (labs.length === 0) notFound();
  const top = labs[0];
  const avg =
    labs.reduce((sum, row) => sum + row.ranking.finalScore, 0) / Math.max(1, labs.length);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_40%,_#ffffff_100%)]">
      <LabsSiteHeader />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-[0_20px_60px_-30px_rgba(2,132,199,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">City Rankings</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 sm:text-5xl">Best Labs in {locationLabel}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Explore high-performing diagnostic laboratories in {locationLabel}. Ranking is based on turnaround
            performance, consistency, activity, and completion trends.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Labs Ranked</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{labs.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Average Score</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{avg.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Top Lab</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{top?.org.name ?? "N/A"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Top Score</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{top?.ranking.finalScore.toFixed(2) ?? "-"}</p>
            </div>
          </div>
        </div>

        {top ? (
          <article className="mt-8 rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Top Lab This Week</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{top.org.name}</h2>
            <p className="mt-1 text-sm text-slate-600">Final Score: {top.ranking.finalScore.toFixed(2)}</p>
          </article>
        ) : null}

        <section className="mt-8 space-y-5">
          {labs.map(({ org, ranking }, index) => (
            <article key={org.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                      #{index + 1}
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900">{org.name}</h2>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      Verified Lab
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={`${org.name} logo`} className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-contain p-1" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xl font-bold text-slate-700">
                        {org.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Location</p>
                      <p className="text-sm text-slate-700">
                        {org.city ?? "Unknown City"}, {org.state ?? "Unknown State"}, {org.country}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {org.description?.trim()
                      ? org.description
                      : "This diagnostic lab is actively listed in city rankings. Public profile details are being enriched."}
                  </p>
                </div>

                <div className="w-full shrink-0 sm:w-56">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-blue-700">Final Score</p>
                    <p className="mt-1 text-2xl font-bold text-blue-900">{ranking.finalScore.toFixed(2)}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-slate-200 p-2">
                      <p className="text-slate-500">Turnaround</p>
                      <p className="font-semibold text-slate-800">{ranking.turnaroundScore.toFixed(1)}</p>
                    </div>
                    <div className="rounded border border-slate-200 p-2">
                      <p className="text-slate-500">Consistency</p>
                      <p className="font-semibold text-slate-800">{ranking.consistencyScore.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {org.website ? (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Website
                  </a>
                ) : null}
                <Link
                  href={`/labs/${locationToSlug(org.city ?? locationLabel)}/${org.slug}`}
                  className="inline-flex rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
                >
                  View Full Profile
                </Link>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Healthcare Context In {locationLabel}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            This city page helps visitors compare diagnostic labs with a structured lens. Profiles include identity,
            operating patterns, and ranking insights that can support practical healthcare decisions.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Directory Reliability</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Public pages update periodically with active ranking windows.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Profile Strength</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Labs with verified websites and richer media appear more complete.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Operational Signals</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Scores reflect weighted reliability factors, not ad placement.</p>
            </div>
          </div>
        </section>
      </section>
      <LabsSiteFooter />
    </main>
  );
}
