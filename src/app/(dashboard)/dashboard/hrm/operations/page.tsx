import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { HrmOperationsBoard } from "@/components/hrm/hrm-operations-board";
 
export default async function HrmOperationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) redirect("/dashboard");
 
  const staffOptions = await prisma.staff.findMany({
    where: { organizationId: user.organizationId, status: "ACTIVE", availabilityStatus: "AVAILABLE" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, role: true, department: true },
  });
 
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Operations Monitor</h1>
        <p className="text-xs text-slate-400 mt-0.5">Track tasks, reassign workloads, and unblock delayed cases.</p>
      </div>
      <HrmOperationsBoard staffOptions={staffOptions} />
    </div>
  );
}