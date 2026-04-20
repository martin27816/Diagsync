import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RadiologyQueueTable } from "@/components/radiology/radiology-queue-table";
import { redirect } from "next/navigation";

export default async function RadiologyQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["RADIOGRAPHER", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }

  const tasks = await prisma.routingTask.findMany({
    where: {
      organizationId: user.organizationId,
      department: "RADIOLOGY",
    },
    include: {
      visit: { include: { patient: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  const orderIds = tasks.flatMap((t) => t.testOrderIds);
  const orders = orderIds.length
    ? await prisma.testOrder.findMany({
        where: { organizationId: user.organizationId, id: { in: orderIds } },
        include: { test: true },
      })
    : [];

  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const rows = tasks.map((task) => ({
    taskId: task.id,
    patientName: task.visit.patient.fullName,
    patientId: task.visit.patient.patientId,
    visitNumber: task.visit.visitNumber,
    tests: task.testOrderIds.map((id) => orderMap.get(id)?.test.name).filter(Boolean) as string[],
    priority: task.priority,
    taskStatus: task.status,
    assignedAt: task.createdAt,
    updatedAt: task.updatedAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Radiology Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start assigned imaging tasks and track status with timestamps.
        </p>
      </div>
      <RadiologyQueueTable rows={rows} />
    </div>
  );
}
