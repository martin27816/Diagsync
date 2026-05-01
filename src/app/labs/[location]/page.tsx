import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLabsByLocation, locationToSlug, slugToLocation } from "@/lib/public-labs";

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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">City Rankings</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Best Labs in {locationLabel}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
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

        <section className="mt-8 space-y-4">
          {labs.map(({ org, ranking }, index) => (
            <article key={org.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                      #{index + 1}
                    </span>
                    <h2 className="text-xl font-semibold text-slate-900">{org.name}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {org.description?.trim()
                      ? org.description
                      : "This diagnostic lab is actively listed in city rankings. Public profile details are being enriched."}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {org.city ?? "Unknown City"}, {org.state ?? "Unknown State"}, {org.country}
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
      </section>
    </main>
  );
}
