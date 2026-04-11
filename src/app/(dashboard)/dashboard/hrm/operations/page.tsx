import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { HrmOperationsBoard } from "@/components/hrm/hrm-operations-board";

export default async function HrmOperationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) {
    redirect("/dashboard");
  }

  const staffOptions = await prisma.staff.findMany({
    where: {
      organizationId: user.organizationId,
      status: "ACTIVE",
      availabilityStatus: "AVAILABLE",
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      role: true,
      department: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations Monitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track all tasks, reassign workloads, and quickly unblock delayed cases.
        </p>
      </div>

      <HrmOperationsBoard staffOptions={staffOptions} />
    </div>
  );
}
