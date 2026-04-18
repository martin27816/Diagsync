import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { StaffManagementTable } from "@/components/hrm/staff-management-table";

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      <StaffManagementTable
        staff={staff.map((row) => ({
          ...row,
          dateJoined: row.dateJoined.toISOString(),
        }))}
      />
    </div>
  );
}
