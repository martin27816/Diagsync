import Link from "next/link";
import type { Metadata } from "next";
import { getPublicLabLocations } from "@/lib/public-labs";
import { LabsSiteFooter, LabsSiteHeader } from "@/components/public/labs-site-chrome";

export const dynamic = "force-dynamic";
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Best Diagnostic Labs by City | DiagSync",
  description:
    "Discover top-ranked medical diagnostic laboratories by city, based on turnaround speed, consistency, activity, and completion performance.",
};

export default async function LabsIndexPage() {
  const locations = await getPublicLabLocations();
  const featured = locations[0] ?? null;
  const cityNarrative = (city: string, topLabName: string | null, avgScore: number) =>
    `${city} diagnostics spotlight led by ${topLabName ?? "top local labs"} with an average performance score of ${avgScore.toFixed(2)}.`;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_35%,_#ffffff_100%)]">
      <LabsSiteHeader />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-sky-100 bg-white/90 p-10 shadow-[0_20px_60px_-30px_rgba(2,132,199,0.45)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            <span className="rounded-full bg-sky-50 px-3 py-1">DiagSync Premium Directory</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Verified Ranking Signals</span>
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight text-slate-900 sm:text-6xl">
            Find Trusted Diagnostic Labs Near You
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Explore city-by-city laboratory rankings with stronger public profiles, performance badges, and trust
            indicators powered by DiagSync operational intelligence.
          </p>
          <div className="mt-8 mx-auto max-w-3xl">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <input
                aria-label="Search city"
                placeholder="Search by city, e.g. Onitsha, Lagos, Abuja"
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Locations</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{locations.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Refresh Rate</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">10 min</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ranking Scope</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">Nationwide</p>
            </div>
          </div>
        </div>

        {featured ? (
          <article className="mt-8 rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Featured Top Lab City</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{featured.city}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {featured.topLabName ?? "Top lab"} leading with score {featured.topScore.toFixed(2)}
                </p>
              </div>
              <Link
                href={`/labs/${featured.slug}`}
                className="inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                View Top Labs
              </Link>
            </div>
          </article>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {locations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No published lab rankings available yet.
            </div>
          ) : (
            locations.map((location) => (
              <Link
                key={location.slug}
                href={`/labs/${location.slug}`}
                className="group block rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-900">{location.city}</h2>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Avg {location.avgScore.toFixed(2)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {location.count} ranked {location.count === 1 ? "lab" : "labs"} in this city.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{cityNarrative(location.city, location.topLabName, location.avgScore)}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Operationally Ranked</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">Top Score {location.topScore.toFixed(2)}</span>
                </div>
                <p className="mt-3 text-xs text-slate-500">Top lab: {location.topLabName ?? "N/A"}</p>
                <div className="mt-5 inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition group-hover:bg-slate-50">
                  Explore {location.city}
                </div>
              </Link>
            ))
          )}
        </div>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">How DiagSync Rankings Work</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Our ranking engine combines operational discipline and outcome consistency metrics. Public pages are built
            to help patients and care teams discover labs that are actively monitored and performance-tracked.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Turnaround</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">On-time completion reliability</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Consistency</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Delay-rate stability across periods</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Activity</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Operational throughput signals</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Completion</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Assigned-to-finished test performance</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Editorial Note</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            DiagSync public listings are designed for trust-first decisions. If a lab profile appears brief today, the
            profile can expand as website data and operational metadata improve over time.
          </p>
        </section>
      </section>
      <LabsSiteFooter />
    </main>
  );
}
