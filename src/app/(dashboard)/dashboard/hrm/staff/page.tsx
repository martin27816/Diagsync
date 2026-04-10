import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/index";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {staff.length} staff member{staff.length !== 1 ? "s" : ""} in your organization
          </p>
        </div>
        <Link href="/dashboard/hrm/staff/new">
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Staff
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        {staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No staff yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first staff member to get started.
            </p>
            <Link href="/dashboard/hrm/staff/new" className="mt-4">
              <Button>Add First Staff Member</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Availability</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {s.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{s.fullName}</p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[s.role]}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {DEPARTMENT_LABELS[s.department] ?? s.department}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === "ACTIVE" ? "success" : "destructive"}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.availabilityStatus === "AVAILABLE" ? "info" : "secondary"}>
                        {s.availabilityStatus === "AVAILABLE" ? "Available" : "Away"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(s.dateJoined)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/hrm/staff/${s.id}`}
                        className="text-primary text-xs hover:underline"
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
