import Link from "next/link";
import type { Metadata } from "next";
import { getPublicLabLocations } from "@/lib/public-labs";
import { LabsSiteFooter, LabsSiteHeader } from "@/components/public/labs-site-chrome";
import { LabsDiscoveryClient } from "@/components/public/labs-discovery-client";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://diagsync.vercel.app";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Diagnostic Laboratories in Nigeria | DiagSync";
  const description =
    "Explore diagnostic labs in Nigeria. Find medical laboratory options by city, compare services, and discover trusted healthcare testing providers.";

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/labs`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${siteUrl}/labs`,
      images: [{ url: `${siteUrl}/diagsync-logo.png` }],
    },
  };
}

export default async function LabsIndexPage() {
  const locations = await getPublicLabLocations();
  const featured = locations[0] ?? null;
  const quickCities = locations.slice(0, 8);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_35%,_#ffffff_100%)]">
      <LabsSiteHeader />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-800">
            Home
          </Link>{" "}
          <span className="mx-2">→</span>
          <span className="font-semibold text-slate-700">Labs</span>
        </nav>

        <div className="rounded-3xl border border-sky-100 bg-white/90 p-10 shadow-[0_20px_60px_-30px_rgba(2,132,199,0.45)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Verified on DiagSync</p>
          <h1 className="mt-5 text-4xl font-black leading-tight text-slate-900 sm:text-6xl">
            Find Diagnostic Laboratories Near You
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Discover diagnostic laboratories in Nigeria through a trusted medical labs directory designed for patients,
            healthcare providers, and laboratory owners.
          </p>
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Locations</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{locations.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Trust Signal</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">Verified Listings</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Coverage</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">Nigeria</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">Quick city links</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickCities.map((city) => (
              <Link
                key={city.slug}
                href={`/labs/${city.slug}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {city.city}
              </Link>
            ))}
          </div>
        </div>

        {featured ? (
          <article className="mt-8 rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Featured Lab City</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{featured.city}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {featured.topLabName ?? "Top local lab"} leads with a performance score of {featured.topScore.toFixed(2)}.
                </p>
              </div>
              <Link
                href={`/labs/${featured.slug}`}
                className="inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                View labs in {featured.city}
              </Link>
            </div>
          </article>
        ) : null}

        <LabsDiscoveryClient locations={locations} />

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Used By Laboratories</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Fast lab workflow</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Teams use DiagSync to streamline requests, sample handling, and result release across daily operations.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Digital results and reporting</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Medical laboratories can standardize reporting and improve turnaround visibility for clinicians.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Built for trust</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Public pages include verified identity signals so patients can choose credible diagnostic providers.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              List your lab
            </Link>
            <Link href="/register" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Claim your lab
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Diagnostic Laboratories In Nigeria: Why This Directory Matters</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
            <p>
              Diagnostic laboratories in Nigeria play a central role in modern healthcare testing. From routine blood
              panels to specialized pathology support, labs help clinicians make accurate decisions quickly. Patients
              also depend on accessible medical laboratories when managing chronic conditions, completing pre-surgery
              checks, or monitoring treatment outcomes. A reliable public directory helps people compare options in one
              place, especially when speed, proximity, and trust all matter at once.
            </p>
            <p>
              DiagSync was built as a practical medical labs directory with local relevance. Instead of presenting only
              basic contact cards, we structure each listing around useful public profile information: location,
              service visibility, and performance context. This makes it easier to find diagnostic laboratories in
              Nigeria by city, understand which facilities are active, and identify providers that communicate clearly
              with patients and referring professionals.
            </p>
            <p>
              For laboratory operators, this platform also creates a stronger digital footprint. Many patients search
              for "medical laboratory near me" or "diagnostic labs in [city]" before booking tests. A complete,
              trusted listing can improve discoverability and confidence at the same time. Labs that claim profiles can
              present richer details, maintain accurate location data, and stand out with stronger credibility signals.
            </p>
            <p>
              As healthcare testing demand grows across Nigeria, directories must do more than list names. They should
              support informed choices and highlight organizations committed to quality operations. DiagSync helps make
              that possible by connecting discovery with real laboratory workflows and trusted identity signals.
            </p>
          </div>
        </section>
      </section>
      <LabsSiteFooter />
    </main>
  );
}
