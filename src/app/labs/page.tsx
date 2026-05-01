import Link from "next/link";
import type { Metadata } from "next";
import { getPublicLabLocations } from "@/lib/public-labs";

export const dynamic = "force-dynamic";
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Best Diagnostic Labs by City | DiagSync",
  description:
    "Discover top-ranked medical diagnostic laboratories by city, based on turnaround speed, consistency, activity, and completion performance.",
};

export default async function LabsIndexPage() {
  const locations = await getPublicLabLocations();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">DiagSync Directory</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
            Find The Best Diagnostic Labs By City
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Browse performance-ranked laboratories across cities. Rankings are updated regularly from operational
            indicators such as turnaround reliability, consistency, activity, and completion quality.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">Updated every 10 minutes</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">SEO-ready city pages</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">Top labs per location</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {locations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No published lab rankings available yet.
            </div>
          ) : (
            locations.map((location) => (
              <article
                key={location.slug}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{location.city}</h2>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Avg {location.avgScore.toFixed(2)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {location.count} ranked {location.count === 1 ? "lab" : "labs"} in this city.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Top lab: {location.topLabName ?? "N/A"} ({location.topScore.toFixed(2)})
                </p>
                <div className="mt-4">
                  <Link
                    href={`/labs/${location.slug}`}
                    className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition group-hover:bg-slate-50"
                  >
                    Explore {location.city}
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
