import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicLabProfile, slugToLocation } from "@/lib/public-labs";
import { LabsSiteFooter, LabsSiteHeader } from "@/components/public/labs-site-chrome";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://diagsync.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: { location: string; slug: string };
}): Promise<Metadata> {
  const data = await getPublicLabProfile(params.location, params.slug);
  const location = slugToLocation(params.location);
  const labName = data?.lab.name ?? "Medical Laboratory";
  const title = `${labName} - Diagnostic Lab in ${location} | DiagSync`;
  const description = `Find diagnostic labs and medical laboratory services in ${location}. View ${labName} profile for healthcare testing details on DiagSync.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/labs/${params.location}/${params.slug}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${siteUrl}/labs/${params.location}/${params.slug}`,
      images: [{ url: `${siteUrl}/diagsync-logo.png` }],
    },
  };
}

export default async function LabProfilePage({
  params,
}: {
  params: { location: string; slug: string };
}) {
  const data = await getPublicLabProfile(params.location, params.slug);
  if (!data) notFound();

  const { lab } = data;
  const location = slugToLocation(params.location);
  const aboutText =
    lab.description?.trim() ||
    `${lab.name} is a diagnostic laboratory in ${location} offering medical testing services.`;

  const services = ["Blood tests", "Urine analysis", "Imaging (if applicable)", "Radiology (if applicable)"];
  const galleryImages = [lab.logoUrl, ...(Array.isArray(lab.images) ? lab.images : [])]
    .filter((v): v is string => Boolean(v))
    .slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: lab.name,
    description: aboutText,
    url: `${siteUrl}/labs/${params.location}/${params.slug}`,
    category: "Medical Laboratory",
    address: {
      "@type": "PostalAddress",
      addressLocality: lab.city || location,
      addressRegion: lab.state || undefined,
      addressCountry: lab.country || "Nigeria",
    },
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_38%,_#ffffff_100%)]">
      <LabsSiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-800">
            Home
          </Link>
          <span className="mx-2">→</span>
          <Link href="/labs" className="hover:text-slate-800">
            Labs
          </Link>
          <span className="mx-2">→</span>
          <Link href={`/labs/${params.location}`} className="hover:text-slate-800">
            {location}
          </Link>
          <span className="mx-2">→</span>
          <span className="font-semibold text-slate-700">{lab.name}</span>
        </nav>

        <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-[0_20px_60px_-30px_rgba(2,132,199,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{lab.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {lab.city ?? location}, {lab.state ?? "State"}, {lab.country ?? "Nigeria"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Verified Lab
                </span>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                  Powered by DiagSync
                </span>
              </div>
            </div>
            <Link
              href="/register"
              className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Own this lab? Claim your profile
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Lab Overview</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{aboutText}</p>
        </section>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-10">
          <div className="space-y-6 lg:col-span-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900">Services</h2>
              <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                {services.map((service) => (
                  <li key={service}>• {service}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900">This lab is listed on DiagSync</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                DiagSync helps laboratories manage patients, tests, and reports efficiently while maintaining trusted
                public visibility.
              </p>
            </section>
          </div>

          <aside className="space-y-4 lg:col-span-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Details</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="mt-1 font-medium">
                    {lab.city ?? location}, {lab.state ?? "State"}, {lab.country ?? "Nigeria"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Opening hours</p>
                  <p className="mt-1 font-medium">Mon - Sat, 8:00 AM - 6:00 PM</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Contact</p>
                  <p className="mt-1 font-medium">{lab.phone?.trim() || "Contact details available on request"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Diagnostic services available</p>
                  <p className="mt-1 font-medium">Clinical diagnostics and healthcare testing support</p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Lab Images</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(galleryImages.length ? galleryImages : ["/diagsync-logo.png", "/diagsync-logo.png", "/diagsync-logo.png"]).map(
              (img, index) => (
                <img
                  key={`${img}-${index}`}
                  src={img}
                  alt={`${lab.name} image ${index + 1}`}
                  loading="lazy"
                  className="h-52 w-full rounded-xl border border-slate-200 bg-slate-50 object-cover"
                />
              )
            )}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm">
          <h2 className="text-2xl font-black">Own this lab listing?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-200">
            Claim this profile to publish complete service details, contact channels, and stronger trust indicators
            for patients searching in {location}.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              Own this lab? Claim your profile
            </Link>
            <Link
              href={`/labs/${params.location}`}
              className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Back to {location} labs
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">About Diagnostic Laboratories In {location}</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              Diagnostic labs in {location} are an essential part of patient care, supporting clinicians with accurate
              healthcare testing and timely results. From everyday screening to targeted diagnostic requests, medical
              laboratory services help guide treatment plans and follow-up decisions. People searching for diagnostic
              labs in {location} often prioritize trust, convenience, and clarity, especially when time-sensitive care
              is involved.
            </p>
            <p>
              A complete lab profile helps patients make informed choices. When public information is easy to
              understand, visitors can compare service scope, location access, and provider credibility with confidence.
              This is why DiagSync structures each listing around practical details, including profile identity, city
              relevance, and service visibility. Our goal is to make local medical laboratory services easier to find
              and easier to trust.
            </p>
            <p>
              For lab operators, public visibility is increasingly important. Many patients discover healthcare testing
              providers through search engines before calling or visiting. A strong, up-to-date listing can improve
              conversion by showing clear information at the exact moment a patient is ready to act. Labs that claim
              profiles on DiagSync can present richer data, improve authority signals, and build credibility in their
              city market.
            </p>
            <p>
              As demand grows for high-quality healthcare testing, diagnostic laboratories in {location} that invest in
              transparent public profiles are better positioned to serve both patients and referring professionals.
              DiagSync supports that standard by connecting trusted listings with the workflows real laboratories use
              every day.
            </p>
          </div>
        </section>
      </section>
      <LabsSiteFooter />
    </main>
  );
}
