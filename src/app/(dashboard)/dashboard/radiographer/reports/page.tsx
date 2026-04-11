import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function RadiologyReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["RADIOGRAPHER", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }

  const reports = await prisma.radiologyReport.findMany({
    where: {
      organizationId: user.organizationId,
      isSubmitted: true,
      ...(user.role === "RADIOGRAPHER" ? { staffId: user.id } : {}),
    },
    include: {
      task: {
        include: {
          visit: { include: { patient: true } },
          imagingFiles: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Submitted Radiology Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Completed imaging reports submitted for MD review.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No submitted radiology reports yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Patient</th>
                <th className="px-4 py-3 text-left font-semibold">Findings</th>
                <th className="px-4 py-3 text-left font-semibold">Impression</th>
                <th className="px-4 py-3 text-left font-semibold">Images</th>
                <th className="px-4 py-3 text-left font-semibold">Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{report.task.visit.patient.fullName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {report.task.visit.patient.patientId} · {report.task.visit.visitNumber}
                    </p>
                  </td>
                  <td className="px-4 py-3">{report.findings}</td>
                  <td className="px-4 py-3">{report.impression}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {report.task.imagingFiles.length === 0 ? (
                        <p className="text-muted-foreground">No files</p>
                      ) : (
                        report.task.imagingFiles.map((img) => (
                          <a
                            key={img.id}
                            href={img.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-primary hover:underline"
                          >
                            {img.fileName}
                          </a>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{report.submittedAt ? formatDateTime(report.submittedAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

