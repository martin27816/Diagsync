"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type LocationCard = {
  city: string;
  slug: string;
  count: number;
  avgScore: number;
  topLabName: string | null;
  topScore: number;
};

export function LabsDiscoveryClient({ locations }: { locations: LocationCard[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) => l.city.toLowerCase().includes(q));
  }, [locations, query]);

  const cityNarrative = (city: string, topLabName: string | null, avgScore: number) =>
    `${city} diagnostics spotlight led by ${topLabName ?? "top local labs"} with an average performance score of ${avgScore.toFixed(2)}.`;

  return (
    <>
      <div className="mt-8 mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <input
            aria-label="Search city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by city, e.g. Onitsha, Lagos, Abuja"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No cities match “{query}”.
          </div>
        ) : (
          filtered.map((location) => (
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
    </>
  );
}

