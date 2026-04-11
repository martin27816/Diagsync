import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";

function formatResultData(data: unknown): string {
  if (data === null || data === undefined) return "-";
  if (typeof data !== "object") return String(data);

  const record = data as Record<string, unknown>;
  const pairs = Object.entries(record)
    .filter(([, value]) => value !== null && value !== undefined && `${value}`.trim() !== "")
    .map(([key, value]) => `${key}: ${String(value)}`);

  if (pairs.length === 0) return "-";
  return pairs.join(", ");
}

export default async function LabResultsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["LAB_SCIENTIST", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }

  const labResults = await prisma.labResult.findMany({
    where: {
      organizationId: user.organizationId,
      isSubmitted: true,
      ...(user.role === "LAB_SCIENTIST" ? { staffId: user.id } : {}),
    },
    include: {
      task: {
        include: {
          visit: {
            include: {
              patient: true,
            },
          },
        },
      },
      testOrder: {
        include: {
          test: true,
        },
      },
    },
    orderBy: {
      submittedAt: "desc",
    },
  });

  const groupedMap = new Map<
    string,
    {
      patientName: string;
      age: number;
      visitNumber: string;
      patientId: string;
      submittedAt: Date | null;
      tests: Array<{ testName: string; resultText: string }>;
    }
  >();

  for (const result of labResults) {
    const visit = result.task.visit;
    const patient = visit.patient;
    const key = visit.id;

    const existing = groupedMap.get(key);
    const testItem = {
      testName: result.testOrder.test.name,
      resultText: formatResultData(result.resultData),
    };

    if (existing) {
      existing.tests.push(testItem);
      if (result.submittedAt && (!existing.submittedAt || result.submittedAt > existing.submittedAt)) {
        existing.submittedAt = result.submittedAt;
      }
      continue;
    }

    groupedMap.set(key, {
      patientName: patient.fullName,
      age: patient.age,
      patientId: patient.patientId,
      visitNumber: visit.visitNumber,
      submittedAt: result.submittedAt,
      tests: [testItem],
    });
  }

  const rows = Array.from(groupedMap.values());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Submitted Results</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each row shows one patient visit and all tests submitted from the lab.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No submitted lab results yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Patient Name</th>
                <th className="px-4 py-3 text-left font-semibold">Age</th>
                <th className="px-4 py-3 text-left font-semibold">Patient ID</th>
                <th className="px-4 py-3 text-left font-semibold">Visit</th>
                <th className="px-4 py-3 text-left font-semibold">Tests & Results</th>
                <th className="px-4 py-3 text-left font-semibold">Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.visitNumber} className="border-t align-top">
                  <td className="px-4 py-3 font-medium">{row.patientName}</td>
                  <td className="px-4 py-3">{row.age}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.patientId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.visitNumber}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {row.tests.map((t, idx) => (
                        <p key={`${t.testName}-${idx}`}>
                          <span className="font-medium">{t.testName}:</span> {t.resultText}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.submittedAt ? formatDateTime(row.submittedAt) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
