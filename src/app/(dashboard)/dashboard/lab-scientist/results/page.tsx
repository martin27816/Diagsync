// ── src/app/(dashboard)/dashboard/lab-scientist/results/page.tsx ──────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";

function formatResultData(data: unknown): string {
  if (data === null || data === undefined) return "—";
  if (typeof data !== "object") return String(data);
  const record = data as Record<string, unknown>;
  const pairs = Object.entries(record)
    .filter(([, v]) => v !== null && v !== undefined && `${v}`.trim() !== "")
    .map(([key, value]) => `${key}: ${String(value)}`);
  return pairs.length === 0 ? "—" : pairs.join(" · ");
}

export default async function LabResultsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["LAB_SCIENTIST", "SUPER_ADMIN"].includes(user.role)) redirect("/dashboard");

  const ROW_LIMIT = 700;
  const labResults = await prisma.labResult.findMany({
    where: {
      organizationId: user.organizationId,
      isSubmitted: true,
      ...(user.role === "LAB_SCIENTIST" ? { staffId: user.id } : {}),
    },
    take: ROW_LIMIT,
    select: {
      resultData: true,
      submittedAt: true,
      task: {
        select: {
          visit: {
            select: {
              id: true,
              visitNumber: true,
              patient: {
                select: {
                  fullName: true,
                  age: true,
                  patientId: true,
                },
              },
            },
          },
        },
      },
      testOrder: { select: { test: { select: { name: true } } } },
    },
    orderBy: { submittedAt: "desc" },
  });

  // Group by visit
  const groupedMap = new Map<string, {
    patientName: string; age: number; patientId: string;
    visitNumber: string; submittedAt: Date | null;
    tests: Array<{ testName: string; resultText: string }>;
  }>();

  for (const result of labResults) {
    const visit = result.task.visit;
    const patient = visit.patient;
    const key = visit.id;
    const testItem = { testName: result.testOrder.test.name, resultText: formatResultData(result.resultData) };
    const existing = groupedMap.get(key);
    if (existing) {
      existing.tests.push(testItem);
      if (result.submittedAt && (!existing.submittedAt || result.submittedAt > existing.submittedAt)) existing.submittedAt = result.submittedAt;
    } else {
      groupedMap.set(key, { patientName: patient.fullName, age: patient.age, patientId: patient.patientId, visitNumber: visit.visitNumber, submittedAt: result.submittedAt, tests: [testItem] });
    }
  }

  const rows = Array.from(groupedMap.values());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Submitted Results</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {rows.length} visit{rows.length !== 1 ? "s" : ""} with submitted lab results (latest {ROW_LIMIT} result entries)
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400">No submitted lab results yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Visit</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Tests & Results</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.visitNumber} className="hover:bg-slate-50 transition-colors align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{row.patientName}</p>
                    <p className="font-mono text-slate-400">{row.patientId} · {row.age}y</p>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-400">{row.visitNumber}</td>
                  <td className="px-4 py-2.5">
                    <div className="space-y-1">
                      {row.tests.map((t, idx) => (
                        <p key={`${t.testName}-${idx}`} className="text-slate-600">
                          <span className="font-medium text-slate-800">{t.testName}:</span>{" "}
                          <span className="text-slate-500">{t.resultText}</span>
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                    {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
