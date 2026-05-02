import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLabsByLocation, locationToSlug, slugToLocation } from "@/lib/public-labs";
import { LabsSiteFooter, LabsSiteHeader } from "@/components/public/labs-site-chrome";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://diagsync.vercel.app";

export async function generateMetadata({ params }: { params: { location: string } }): Promise<Metadata> {
  const location = slugToLocation(params.location);
  const title = `Diagnostic Laboratories in ${location} | Medical Labs Near You`;
  const description = `Find diagnostic labs and medical laboratory services in ${location}. Compare trusted providers for healthcare testing on DiagSync.`;
  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/labs/${params.location}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${siteUrl}/labs/${params.location}`,
      images: [{ url: `${siteUrl}/diagsync-logo.png` }],
    },
  };
}

export default async function LabsByLocationPage({ params }: { params: { location: string } }) {
  const locationLabel = slugToLocation(params.location);
  const labs = await getPublicLabsByLocation(params.location);
  if (labs.length === 0) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Diagnostic Laboratories in ${locationLabel}`,
    itemListElement: labs.map(({ org }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: org.name,
      url: `${siteUrl}/labs/${locationToSlug(org.city ?? locationLabel)}/${org.slug}`,
    })),
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_40%,_#ffffff_100%)]">
      <LabsSiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-800">
            Home
          </Link>
          <span className="mx-2">→</span>
          <Link href="/labs" className="hover:text-slate-800">
            Labs
          </Link>
          <span className="mx-2">→</span>
          <span className="font-semibold text-slate-700">{locationLabel}</span>
        </nav>

        <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-[0_20px_60px_-30px_rgba(2,132,199,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Verified on DiagSync</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 sm:text-5xl">
            Diagnostic Laboratories in {locationLabel}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Patients and care teams searching for labs in {locationLabel} often need fast, dependable, and accessible
            options. This city directory helps you compare diagnostic centres and medical testing providers in one
            trusted place. Each listing is structured for clarity with location details, service context, and profile
            trust signals, so you can identify medical laboratory services that match your healthcare testing needs.
            Whether you are looking for routine blood work, urine analysis, or broader diagnostic support, this page
            is designed to make discovery easier. If you run a lab in {locationLabel}, claiming your profile improves
            visibility and helps people find accurate details about your facility.
          </p>
        </div>

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
                  <p className="mt-2 text-sm text-slate-600">
                    {org.city ?? locationLabel}, {org.state ?? "State"}, {org.country}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {org.description?.trim()
                      ? org.description
                      : `${org.name} is a diagnostic laboratory in ${locationLabel} offering medical laboratory services and healthcare testing support.`}
                  </p>
                </div>

                <div className="w-full shrink-0 sm:w-64">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-blue-700">Performance score</p>
                    <p className="mt-1 text-2xl font-bold text-blue-900">{ranking.finalScore.toFixed(2)}</p>
                  </div>
                  <Link
                    href={`/labs/${locationToSlug(org.city ?? locationLabel)}/${org.slug}`}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    View Lab
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Finding The Best Diagnostic Lab In {locationLabel}</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              Choosing among diagnostic labs in {locationLabel} is easier when you compare more than a name and phone
              number. Patients usually want a medical laboratory that is easy to reach, clear in communication, and
              consistent in delivering healthcare testing results on time. This city page was built for that purpose,
              helping you review labs in {locationLabel} with stronger context and practical details.
            </p>
            <p>
              Quality diagnostic centres support every stage of care, from first diagnosis to long-term monitoring.
              Clinicians depend on accurate laboratory output, while families need confidence that testing is handled
              by trusted teams. By exploring this list, you can identify medical testing providers with verified public
              visibility and discover facilities that are actively maintaining profile information.
            </p>
            <p>
              If you manage a lab, this local directory also acts as a growth channel. People search for diagnostic
              laboratories in {locationLabel} every day, and a complete profile can improve both trust and conversion.
              Claiming your listing helps present your services clearly and positions your organization as part of a
              professional healthcare network. DiagSync exists to make that discovery process better for both patients
              and laboratories.
            </p>
          </div>
        </section>
      </section>
      <LabsSiteFooter />
    </main>
  );
}
