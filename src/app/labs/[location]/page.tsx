import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLabsByLocation, locationToSlug, slugToLocation } from "@/lib/public-labs";

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

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-slate-900">Best Labs in {locationLabel} | DiagSync</h1>
      <p className="mt-1 text-sm text-slate-500">Weekly ranking based on turnaround, consistency, activity, and completion.</p>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {labs.map(({ org, ranking }) => (
          <article key={org.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{org.name}</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                Score {ranking.finalScore.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {org.description?.trim() ? org.description : "Trusted diagnostic laboratory serving patients in this city."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {org.city ?? "Unknown City"}, {org.state ?? "Unknown State"}, {org.country}
            </p>
            <div className="mt-3">
              <Link
                href={`/labs/${locationToSlug(org.city ?? locationLabel)}/${org.slug}`}
                className="inline-flex rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                View Profile
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
