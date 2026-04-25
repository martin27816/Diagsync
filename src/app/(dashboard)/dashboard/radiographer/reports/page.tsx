import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

function dayKeyToRange(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map((v) => Number(v));
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

export default async function RadiologyReportsPage({
  searchParams,
}: {
  searchParams?: { search?: string; date?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["RADIOGRAPHER", "SUPER_ADMIN"].includes(user.role)) redirect("/dashboard");

  const search = (searchParams?.search ?? "").trim();
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.date ?? "")
    ? String(searchParams?.date)
    : "";
  const dateRange = selectedDate ? dayKeyToRange(selectedDate) : null;

  const reports = await prisma.radiologyReport.findMany({
    where: {
      organizationId: user.organizationId,
      isSubmitted: true,
      ...(user.role === "RADIOGRAPHER" ? { staffId: user.id } : {}),
      ...(search
        ? {
            task: {
              visit: {
                patient: {
                  OR: [
                    { fullName: { contains: search, mode: "insensitive" } },
                    { patientId: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
          }
        : {}),
      ...(dateRange
        ? {
            submittedAt: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          }
        : {}),
    },
    include: {
      task: { include: { visit: { include: { patient: true } }, imagingFiles: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Submitted Radiology Reports</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {reports.length} report{reports.length !== 1 ? "s" : ""} submitted for MD review
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="w-full sm:w-auto">
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Search patient</label>
          <input
            name="search"
            defaultValue={search}
            placeholder="Name or patient ID..."
            className="h-8 w-full sm:w-56 rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Go to date</label>
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Apply
        </button>
        <Link href="/dashboard/radiographer/reports" className="text-xs text-slate-400 hover:text-slate-600 pb-1">
          Reset
        </Link>
        <span className="w-full text-left text-xs text-slate-400 pb-1 sm:ml-auto sm:w-auto sm:text-right">
          {reports.length} report row{reports.length !== 1 ? "s" : ""} in view
        </span>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {reports.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400">No submitted radiology reports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">Patient</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">Findings</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">Impression</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">Images</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{report.task.visit.patient.fullName}</p>
                      <p className="font-mono text-slate-400">
                        {report.task.visit.patient.patientId} · {report.task.visit.visitNumber}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px]">{report.findings}</td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px]">{report.impression}</td>
                    <td className="px-4 py-2.5">
                      {report.task.imagingFiles.length === 0 ? (
                        <span className="text-slate-300">None</span>
                      ) : (
                        <div className="space-y-0.5">
                          {report.task.imagingFiles.map((img) => (
                            <a
                              key={img.id}
                              href={img.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-blue-600 hover:underline truncate max-w-[140px]"
                            >
                              {img.fileName}
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {report.submittedAt ? formatDateTime(report.submittedAt) : "-"}
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
