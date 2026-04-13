import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TestCatalogForm } from "@/components/hrm/test-catalog-form";
import { formatCurrency } from "@/lib/utils";

function turnaround(mins: number) {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export default async function TestCatalogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) redirect("/dashboard/hrm");

  // OPTIMISED: use _count instead of include: { resultFields: [...] }
  // The page only displays the field count, not the field data itself.
  // Before: fetched 500-1000+ field rows just to count them.
  // After: a single COUNT(*) per test in the same query — no extra rows.
  const [tests, categories] = await Promise.all([
    prisma.diagnosticTest.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      include: {
        category: { select: { name: true } },
        _count: { select: { resultFields: true } },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.testCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const labTests = tests.filter((t) => t.type === "LAB");
  const radioTests = tests.filter((t) => t.type === "RADIOLOGY");
  const totalFields = tests.reduce((sum, t) => sum + t._count.resultFields, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-slate-800">Test Catalog</h1>
        <p className="text-xs text-slate-400 mt-0.5">{tests.length} active tests in your organisation</p>
      </div>

      <TestCatalogForm categories={categories} />

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden">
        {[
          { label: "Total Tests", value: tests.length },
          { label: "Lab Tests", value: labTests.length },
          { label: "Radiology Tests", value: radioTests.length },
          { label: "Total Result Fields", value: totalFields },
        ].map((s) => (
          <div key={s.label} className="bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Lab Tests */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Laboratory Tests
          </span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-600">
            {labTests.length}
          </span>
        </div>
        {labTests.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-400">No lab tests.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Test Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Code</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Category</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Sample</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Turnaround</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Price</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Cost</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Fields</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {labTests.map((test) => (
                <tr key={test.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{test.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
                      {test.code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{test.category?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{test.sampleType ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{turnaround(test.turnaroundMinutes)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatCurrency(Number(test.price))}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatCurrency(Number((test as any).costPrice ?? 0))}</td>
                  <td className="px-4 py-2.5 text-slate-400">{test._count.resultFields}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Radiology Tests */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Radiology Tests
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
            {radioTests.length}
          </span>
        </div>
        {radioTests.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-400">No radiology tests.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Test Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Code</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Category</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Turnaround</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Price</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Cost</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Fields</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {radioTests.map((test) => (
                <tr key={test.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{test.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
                      {test.code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{test.category?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{turnaround(test.turnaroundMinutes)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatCurrency(Number(test.price))}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatCurrency(Number((test as any).costPrice ?? 0))}</td>
                  <td className="px-4 py-2.5 text-slate-400">{test._count.resultFields}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
