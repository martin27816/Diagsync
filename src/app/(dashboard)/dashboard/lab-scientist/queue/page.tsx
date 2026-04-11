import { auth } from "@/lib/auth";
import { LabQueueTable } from "@/components/lab/lab-queue-table";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function LabQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["LAB_SCIENTIST", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }

  const tasks = await prisma.routingTask.findMany({
    where: {
      organizationId: user.organizationId,
      department: "LABORATORY",
      ...(user.role === "LAB_SCIENTIST" ? { staffId: user.id } : {}),
    },
    include: {
      visit: {
        include: {
          patient: true,
        },
      },
      sample: true,
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });

  const allOrderIds = tasks.flatMap((t) => t.testOrderIds);
  const orders = allOrderIds.length
    ? await prisma.testOrder.findMany({
        where: {
          organizationId: user.organizationId,
          id: { in: allOrderIds },
        },
        include: { test: true },
      })
    : [];

  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const rows = tasks.map((task) => ({
    taskId: task.id,
    patientName: task.visit.patient.fullName,
    patientId: task.visit.patient.patientId,
    visitNumber: task.visit.visitNumber,
    tests: task.testOrderIds
      .map((id) => orderMap.get(id)?.test?.name)
      .filter((name): name is string => Boolean(name)),
    priority: task.priority,
    taskStatus: task.status,
    sampleStatus: task.sample?.status ?? "PENDING",
    assignedAt: task.createdAt,
    updatedAt: task.updatedAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start tests from here. Time and status update immediately after each action.
        </p>
      </div>
      <LabQueueTable rows={rows} />
    </div>
  );
}
