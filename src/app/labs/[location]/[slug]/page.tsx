import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLabProfile, slugToLocation } from "@/lib/public-labs";

export const dynamic = "force-dynamic";

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
  const allImages = Array.isArray(lab.images) ? lab.images : [];
  const buildingImage =
    allImages.find((img) => /building|front|facility|outside|branch/i.test(img)) ||
    allImages[0] ||
    null;
  const equipmentImage =
    allImages.find((img) => /equipment|machine|device|scanner|lab/i.test(img) && img !== buildingImage) ||
    allImages[1] ||
    null;
  const hasGallery = Boolean(lab.logoUrl || buildingImage || equipmentImage);
  const initials = lab.name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const aboutText =
    lab.description?.trim() ||
    "This diagnostic laboratory is listed on DiagSync with operational performance signals and location coverage.";
  const services = [
    "Clinical diagnostics",
    "Routine laboratory testing",
    "Operationally tracked turnaround performance",
  ];
  const highlights = [
    `City coverage: ${lab.city ?? "Unknown City"}, ${lab.state ?? "Unknown State"}`,
    ranking ? `Performance score: ${ranking.finalScore.toFixed(2)}` : "Performance score available in active ranking periods",
    lab.website ? "Official website verified" : "Website not yet published",
  ];

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_38%,_#ffffff_100%)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-[0_20px_60px_-30px_rgba(2,132,199,0.45)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              {lab.logoUrl ? (
                <img src={lab.logoUrl} alt={`${lab.name} logo`} className="h-24 w-24 rounded-2xl border border-slate-200 bg-white object-contain p-2" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-2xl font-black text-slate-700">
                  {initials}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{lab.name}</h1>
                <p className="mt-1 text-sm text-slate-600">
                  {lab.city ?? "Unknown City"}, {lab.state ?? "Unknown State"}, {lab.country}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Verified Lab Profile</span>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Public Directory</span>
                </div>
              </div>
            </div>
            {ranking ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
                <p className="text-xs uppercase tracking-wide text-blue-700">Ranking Score</p>
                <p className="mt-1 text-3xl font-black text-blue-900">{ranking.finalScore.toFixed(2)}</p>
              </div>
            ) : null}
          </div>
          {lab.website ? (
            <a href={lab.website} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Visit Official Website
            </a>
          ) : null}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">About</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{aboutText}</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Services</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {services.map((service) => (
                <li key={service}>• {service}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Highlights</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {highlights.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
        </div>

        {hasGallery ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Gallery</h2>
            <p className="mt-1 text-xs text-slate-500">Structured view: Logo, Building, Equipment</p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logo</p>
                {lab.logoUrl ? (
                  <img src={lab.logoUrl} alt={`${lab.name} logo`} className="mt-2 h-44 w-full rounded-lg bg-white object-contain p-2" />
                ) : (
                  <div className="mt-2 flex h-44 items-center justify-center rounded-lg bg-white text-3xl font-black text-slate-700">{initials}</div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Building</p>
                {buildingImage ? (
                  <img src={buildingImage} alt={`${lab.name} building`} className="mt-2 h-44 w-full rounded-lg object-cover" />
                ) : (
                  <div className="mt-2 flex h-44 items-center justify-center rounded-lg bg-white text-xs text-slate-400">No building image</div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipment</p>
                {equipmentImage ? (
                  <img src={equipmentImage} alt={`${lab.name} equipment`} className="mt-2 h-44 w-full rounded-lg object-cover" />
                ) : (
                  <div className="mt-2 flex h-44 items-center justify-center rounded-lg bg-white text-xs text-slate-400">No equipment image</div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
