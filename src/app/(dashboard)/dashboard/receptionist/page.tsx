import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/index";

export default async function ReceptionistDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["RECEPTIONIST", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard/hrm");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [todayPatients, unpaidVisits, recentPatients, totalPatients] =
    await prisma.$transaction([
      prisma.patient.count({
        where: {
          organizationId: user.organizationId,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.visit.count({
        where: {
          organizationId: user.organizationId,
          paymentStatus: { in: ["PENDING", "PARTIAL"] },
          registeredAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.patient.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          visits: {
            orderBy: { registeredAt: "desc" },
            take: 1,
            include: {
              testOrders: {
                include: { test: { select: { name: true, type: true } } },
              },
            },
          },
        },
      }),
      prisma.patient.count({ where: { organizationId: user.organizationId } }),
    ]);

  const priorityBadge: Record<string, string> = {
    EMERGENCY: "bg-red-100 text-red-700",
    URGENT: "bg-amber-100 text-amber-700",
    ROUTINE: "bg-slate-100 text-slate-600",
  };

  const paymentBadge: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    PENDING: "bg-red-100 text-red-700",
    WAIVED: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Reception</h1>
          <p className="text-xs text-slate-400 mt-0.5">{new Date().toDateString()}</p>
        </div>
        {/* Action buttons: stacked on smallest mobile, row from sm up */}
        <div className="flex flex-col gap-2 xs:flex-row xs:flex-wrap sm:flex-row sm:items-center sm:gap-2">
          <Link
            href="/dashboard/receptionist/consultation"
            className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors sm:py-1.5"
          >
            Consultation Queue
          </Link>
          <Link
            href="/dashboard/receptionist/new-patient"
            className="inline-flex items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors sm:py-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            New Patient
          </Link>
        </div>
      </div>

      {/* Stat strip — 2-col on mobile, 4-col on sm+ */}
      <div className="grid grid-cols-2 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden sm:grid-cols-4">
        {[
          { label: "Registered Today", value: todayPatients },
          { label: "Awaiting Payment", value: unpaidVisits, alert: unpaidVisits > 0 },
          { label: "Active Today", value: todayPatients },
          { label: "Total Patients", value: totalPatients },
        ].map((s) => (
          <div key={s.label} className="bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 leading-tight">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.alert ? "text-red-600" : "text-slate-800"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Patients table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent Registrations
          </span>
          <Link
            href="/dashboard/receptionist/patients"
            className="text-xs text-blue-600 hover:underline"
          >
            View all →
          </Link>
        </div>

        {recentPatients.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-slate-400">No patients registered yet.</p>
            <Link
              href="/dashboard/receptionist/new-patient"
              className="mt-2 inline-flex text-xs text-blue-600 hover:underline"
            >
              Register first patient →
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2 text-left font-medium text-slate-400">Patient</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-400">ID</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-400">Age / Sex</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-400">Tests</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-400">Priority</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-400">Payment</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-400">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPatients.map((patient) => {
                    const visit = patient.visits[0];
                    return (
                      <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{patient.fullName}</td>
                        <td className="px-4 py-2.5 text-slate-400 font-mono">{patient.patientId}</td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {patient.age}y · {patient.sex}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {visit?.testOrders.slice(0, 2).map((o) => (
                              <span
                                key={o.id}
                                className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700"
                              >
                                {o.test.name}
                              </span>
                            ))}
                            {(visit?.testOrders.length ?? 0) > 2 && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                                +{(visit?.testOrders.length ?? 0) - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {visit && (
                            <span
                              className={`rounded px-1.5 py-0.5 font-medium ${
                                priorityBadge[visit.priority] ?? "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {visit.priority}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {visit && (
                            <span
                              className={`rounded px-1.5 py-0.5 font-medium ${
                                paymentBadge[visit.paymentStatus] ?? "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {visit.paymentStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400 whitespace-nowrap">
                          {formatDateTime(patient.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list — visible only on mobile */}
            <div className="sm:hidden divide-y divide-slate-100">
              {recentPatients.map((patient) => {
                const visit = patient.visits[0];
                return (
                  <div key={patient.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-slate-800">{patient.fullName}</p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {patient.patientId} · {patient.age}y · {patient.sex}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatDateTime(patient.createdAt)}
                      </p>
                    </div>
                    {visit && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {visit.testOrders.slice(0, 2).map((o) => (
                          <span key={o.id} className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">
                            {o.test.name}
                          </span>
                        ))}
                        {visit.testOrders.length > 2 && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                            +{visit.testOrders.length - 2}
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            priorityBadge[visit.priority] ?? "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {visit.priority}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            paymentBadge[visit.paymentStatus] ?? "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {visit.paymentStatus}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}