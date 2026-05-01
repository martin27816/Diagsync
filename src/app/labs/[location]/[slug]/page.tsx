import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLabProfile, slugToLocation } from "@/lib/public-labs";

export async function generateMetadata({
  params,
}: {
  params: { location: string; slug: string };
}): Promise<Metadata> {
  const data = await getPublicLabProfile(params.location, params.slug);
  const location = slugToLocation(params.location);
  if (!data) {
    return { title: `Best Labs in ${location} | DiagSync` };
  }
  return {
    title: `${data.lab.name} | Labs in ${location} | DiagSync`,
    description: data.lab.description?.slice(0, 160) || `Lab profile for ${data.lab.name} in ${location}.`,
  };
}

export default async function LabProfilePage({
  params,
}: {
  params: { location: string; slug: string };
}) {
  const data = await getPublicLabProfile(params.location, params.slug);
  if (!data) notFound();
  const { lab, ranking } = data;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: lab.name,
    image: lab.logoUrl || undefined,
    description: lab.description || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: lab.address || undefined,
      addressLocality: lab.city || undefined,
      addressRegion: lab.state || undefined,
      addressCountry: lab.country || undefined,
    },
    url: lab.website || undefined,
    telephone: lab.phone || undefined,
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="text-2xl font-bold text-slate-900">{lab.name}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {lab.city ?? "Unknown City"}, {lab.state ?? "Unknown State"}, {lab.country}
      </p>

      {ranking ? (
        <div className="mt-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
          Ranking Score: {ranking.finalScore.toFixed(2)}
        </div>
      ) : null}

      <section className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">About</h2>
        <p className="text-sm text-slate-600">
          {lab.description?.trim()
            ? lab.description
            : "Profile information is currently being updated. Please check back shortly."}
        </p>

        {lab.website ? (
          <p className="text-sm">
            <a href={lab.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              Visit Website
            </a>
          </p>
        ) : null}

        {lab.images && lab.images.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lab.images.slice(0, 4).map((img) => (
              <img key={img} src={img} alt={`${lab.name} image`} className="h-40 w-full rounded-md object-cover" />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
