import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { ROLE_LABELS, DEPARTMENT_LABELS, formatDate } from "@/lib/utils";

export default async function StaffListPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) redirect("/dashboard/hrm");

  const staff = await prisma.staff.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      department: true,
      status: true,
      availabilityStatus: true,
      defaultShift: true,
      dateJoined: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Staff Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {staff.length} member{staff.length !== 1 ? "s" : ""} in your organisation
          </p>
        </div>
        <Link
          href="/dashboard/hrm/staff/new"
          className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add Staff
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {staff.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">No staff yet.</p>
            <Link
              href="/dashboard/hrm/staff/new"
              className="mt-2 inline-flex text-xs text-blue-600 hover:underline"
            >
              Add first staff member →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Department</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Shift</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Availability</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Joined</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.fullName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{s.email}</td>
                    <td className="px-4 py-2.5 text-slate-500">{ROLE_LABELS[s.role]}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {DEPARTMENT_LABELS[s.department] ?? s.department}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{s.defaultShift}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          s.status === "ACTIVE"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          s.availabilityStatus === "AVAILABLE"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {s.availabilityStatus === "AVAILABLE" ? "Available" : "Away"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {formatDate(s.dateJoined)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/hrm/staff/${s.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View →
                      </Link>
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