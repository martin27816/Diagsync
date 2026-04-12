import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { formatDateTime, formatCurrency } from "@/lib/utils";

export default async function PatientsListPage({
  searchParams,
}: {
  searchParams: { search?: string; today?: string; page?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["RECEPTIONIST", "SUPER_ADMIN", "HRM", "MD"].includes(user.role)) {
    redirect("/dashboard/hrm");
  }

  const search = searchParams.search ?? "";
  const page = parseInt(searchParams.page ?? "1");
  const pageSize = 20;
  const todayOnly = searchParams.today === "true";

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const where: any = {
    organizationId: user.organizationId,
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { patientId: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(todayOnly && { createdAt: { gte: todayStart, lte: todayEnd } }),
  };

  const [patients, total] = await prisma.$transaction([
    prisma.patient.findMany({
      where,
      include: {
        visits: {
          orderBy: { registeredAt: "desc" },
          take: 1,
          include: {
            testOrders: { include: { test: { select: { name: true, type: true } } } },
          },
        },
        registeredBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patient.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const priorityStyle: Record<string, string> = {
    EMERGENCY: "bg-red-50 text-red-600",
    URGENT: "bg-amber-50 text-amber-700",
    ROUTINE: "bg-slate-100 text-slate-600",
  };
  const paymentStyle: Record<string, string> = {
    PAID: "bg-green-50 text-green-700",
    PARTIAL: "bg-amber-50 text-amber-700",
    PENDING: "bg-red-50 text-red-600",
    WAIVED: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Patients</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {total} patient{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link
          href="/dashboard/receptionist/new-patient"
          className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          New Patient
        </Link>
      </div>

      {/* Filter bar */}
      <form method="GET" className="flex flex-wrap items-center gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name, ID, phone..."
          className="h-8 w-56 rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            name="today"
            value="true"
            defaultChecked={todayOnly}
            className="rounded border-slate-300"
          />
          Today only
        </label>
        <button
          type="submit"
          className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Search
        </button>
        {(search || todayOnly) && (
          <a href="/dashboard/receptionist/patients" className="text-xs text-slate-400 hover:text-slate-600">
            Clear
          </a>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {patients.length} of {total} shown
        </span>
      </form>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {patients.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400">No patients found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Patient</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">ID</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Age/Sex</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Tests</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Amount</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Priority</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Payment</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((patient) => {
                  const visit = patient.visits[0];
                  return (
                    <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{patient.fullName}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-400">{patient.patientId}</td>
                      <td className="px-4 py-2.5 text-slate-500">{patient.age}y · {patient.sex}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {visit?.testOrders.slice(0, 2).map((o) => (
                            <span key={o.id} className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
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
                      <td className="px-4 py-2.5 font-medium text-slate-700">
                        {visit ? formatCurrency(Number(visit.totalAmount)) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {visit && (
                          <span className={`rounded px-1.5 py-0.5 font-medium ${priorityStyle[visit.priority] ?? "bg-slate-100 text-slate-500"}`}>
                            {visit.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {visit && (
                          <span className={`rounded px-1.5 py-0.5 font-medium ${paymentStyle[visit.paymentStatus] ?? "bg-slate-100 text-slate-500"}`}>
                            {visit.paymentStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                        {formatDateTime(patient.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?search=${search}&today=${todayOnly}&page=${page - 1}`}
                className="rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 transition-colors"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?search=${search}&today=${todayOnly}&page=${page + 1}`}
                className="rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}