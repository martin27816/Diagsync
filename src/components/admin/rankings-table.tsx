"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RankingItem, RankingPeriod } from "@/lib/ranking/get-all-rankings";

type Props = {
  period: RankingPeriod;
  items: RankingItem[];
  topLab: RankingItem | null;
};

type SortKey =
  | "labName"
  | "city"
  | "finalScore"
  | "turnaroundScore"
  | "consistencyScore"
  | "activityScore"
  | "healthScore"
  | "completionScore";

export function RankingsTable({ period, items, topLab }: Props) {
  const [cityFilter, setCityFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("finalScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const cities = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.city))).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    if (cityFilter === "ALL") return items;
    return items.filter((item) => item.city === cityFilter);
  }, [items, cityFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === "labName" || nextKey === "city" ? "asc" : "desc");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500">Top Lab This Week</p>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{topLab?.labName ?? "No qualifying lab yet"}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {topLab ? `${topLab.city} • Final Score ${topLab.finalScore.toFixed(2)}` : "Rankings require at least 20 tests per lab."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="inline-flex rounded-lg border border-gray-200 p-1">
          <Link
            href={`/admin/rankings?period=weekly`}
            className={`rounded-md px-3 py-1.5 text-sm ${period === "weekly" ? "bg-blue-600 text-white" : "text-gray-600"}`}
          >
            Weekly
          </Link>
          <Link
            href={`/admin/rankings?period=monthly`}
            className={`rounded-md px-3 py-1.5 text-sm ${period === "monthly" ? "bg-blue-600 text-white" : "text-gray-600"}`}
          >
            Monthly
          </Link>
        </div>

        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All Cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("labName")}>Lab Name</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("city")}>City</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("finalScore")}>Final Score</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("turnaroundScore")}>Turnaround</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("consistencyScore")}>Consistency</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("activityScore")}>Activity</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("healthScore")}>Health</th>
              <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("completionScore")}>Completion</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  No rankings for the selected filter.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.organizationId} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.labName}</td>
                  <td className="px-4 py-3 text-gray-600">{row.city}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700">{row.finalScore.toFixed(2)}</td>
                  <td className="px-4 py-3">{row.turnaroundScore.toFixed(2)}</td>
                  <td className="px-4 py-3">{row.consistencyScore.toFixed(2)}</td>
                  <td className="px-4 py-3">{row.activityScore.toFixed(2)}</td>
                  <td className="px-4 py-3">{row.healthScore.toFixed(2)}</td>
                  <td className="px-4 py-3">{row.completionScore.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
