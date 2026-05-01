import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLabProfile, slugToLocation } from "@/lib/public-labs";
import { LabsSiteFooter, LabsSiteHeader } from "@/components/public/labs-site-chrome";

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
  const compact = (v: string) => v.replace(/\s+/g, " ").trim();
  const looksLikeScrapeBlob = (v: string) =>
    v.length > 180 ||
    /(home about us services gallery contact book now|all rights reserved|learn more|quick links|opening hours)/i.test(v);
  const safeAddress = lab.address && !looksLikeScrapeBlob(compact(lab.address)) ? compact(lab.address) : `${lab.city ?? "Unknown City"}, ${lab.state ?? "Unknown State"}, ${lab.country}`;
  const safePhone = lab.phone && !looksLikeScrapeBlob(compact(lab.phone)) && compact(lab.phone).length <= 40 ? compact(lab.phone) : null;
  const allImages = Array.isArray(lab.images) ? lab.images : [];
  const galleryImages = [
    ...(lab.logoUrl ? [lab.logoUrl] : []),
    ...allImages.filter((img) => img !== lab.logoUrl),
  ].slice(0, 24);
  const hasGallery = galleryImages.length > 0;
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
  const score = ranking?.finalScore ?? 0;
  const trustLevel = score >= 80 ? "Elite" : score >= 65 ? "Strong" : score >= 45 ? "Growing" : "Emerging";

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
      <LabsSiteHeader />
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

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-10">
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900">About</h2>
              <p className="mt-3 text-sm leading-8 text-slate-600">{aboutText}</p>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900">Services</h2>
              <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
                {services.map((service) => (
                  <li key={service}>• {service}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900">Highlights</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {highlights.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </section>
          </div>
          <aside className="space-y-4 lg:col-span-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Score Breakdown</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between"><span>Trust Tier</span><span className="font-semibold text-slate-900">{trustLevel}</span></div>
                <div className="flex items-center justify-between"><span>Final Score</span><span className="font-semibold text-slate-900">{score.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span>Verification</span><span className="font-semibold text-emerald-700">DiagSync Verified</span></div>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Contact & Access</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>{safeAddress}</p>
                {safePhone ? <p>{safePhone}</p> : null}
                {lab.website ? (
                  <a href={lab.website} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">
                    Visit Website
                  </a>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Why Patients Choose {lab.name}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {lab.name} serves individuals, families, and referring clinicians who need dependable diagnostic support.
            This profile combines public identity data with operational ranking signals, helping patients identify
            laboratories that are active, consistent, and performance-tracked.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Trust Tier</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{trustLevel}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Performance Score</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{score.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Public Profile</p>
              <p className="mt-2 text-xl font-bold text-slate-900">Verified</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Coverage Area</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{lab.city ?? "City"}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Service Scope & Diagnostic Focus</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-lg font-bold text-slate-900">Core Diagnostics</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• Hematology and routine blood investigations</li>
                <li>• Clinical chemistry and metabolic screening</li>
                <li>• Infection-focused and rapid support diagnostics</li>
                <li>• Diagnostic workflow support for outpatient care</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-lg font-bold text-slate-900">Operational Reliability</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• Monitored turnaround and completion efficiency</li>
                <li>• Active ranking participation in city-level listings</li>
                <li>• Structured profile enrichment and public trust signals</li>
                <li>• Transparent location and website identity mapping</li>
              </ul>
            </div>
          </div>
        </section>

        {hasGallery ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Gallery</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {galleryImages.map((img, index) => (
                <img
                  key={`${img}-${index}`}
                  src={img}
                  alt={`${lab.name} gallery image ${index + 1}`}
                  className="h-44 w-full rounded-lg border border-slate-200 bg-slate-50 object-cover"
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Public Lab FAQ</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">How is this lab ranked?</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Rankings are computed from operational metrics such as turnaround reliability, consistency, activity,
                and completion behavior over defined periods.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">Can profile information change over time?</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Yes. Profile content is updated as the lab maintains website presence, operational data, and public
                profile signals.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">Does this page include direct contact details?</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Where available, the profile includes location data, official website, and validated public identity
                fields for easier patient access.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
          <h2 className="text-2xl font-black">Explore More Labs in {lab.city ?? "This City"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-200">
            Compare top-performing labs in this location to find the best fit for your diagnostic needs. DiagSync
            rankings help patients and care teams make informed, trust-first choices.
          </p>
          <div className="mt-4">
            <a
              href={`/labs/${params.location}`}
              className="inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              View City Rankings
            </a>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Patient Information & Planning Guide</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">Before You Visit</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Confirm appointment expectations with the lab, prepare clinical notes when available, and verify
                location details for smoother arrival and faster processing.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">After Sample Collection</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Ask for expected completion timelines and result handoff channels. Operationally ranked labs often
                maintain stronger completion consistency and clearer release workflows.
              </p>
            </div>
          </div>
        </section>
      </section>
      <LabsSiteFooter />
    </main>
  );
}
