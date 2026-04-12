import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function RadiologyReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["RADIOGRAPHER", "SUPER_ADMIN"].includes(user.role)) redirect("/dashboard");

  const reports = await prisma.radiologyReport.findMany({
    where: {
      organizationId: user.organizationId,
      isSubmitted: true,
      ...(user.role === "RADIOGRAPHER" ? { staffId: user.id } : {}),
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

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {reports.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400">No submitted radiology reports yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Findings</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Impression</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Images</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Submitted</th>
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
                          <a key={img.id} href={img.fileUrl} target="_blank" rel="noreferrer"
                            className="block text-blue-600 hover:underline truncate max-w-[140px]">
                            {img.fileName}
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                    {report.submittedAt ? formatDateTime(report.submittedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}