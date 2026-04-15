import { auth } from "@/lib/auth";
import { LabQueueTable } from "@/components/lab/lab-queue-table";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RoutingTaskStatus } from "@prisma/client";

type QueueFilter = "ACTIVE" | "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

export default async function LabQueuePage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["LAB_SCIENTIST", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }
  const statusFilter = (searchParams?.status ?? "ACTIVE").toUpperCase() as QueueFilter;
  const ROW_LIMIT = 300;
  const statusWhere =
    statusFilter === "ALL"
      ? {}
      : statusFilter === "ACTIVE"
      ? { status: { in: [RoutingTaskStatus.PENDING, RoutingTaskStatus.IN_PROGRESS] } }
      : statusFilter === "PENDING"
      ? { status: RoutingTaskStatus.PENDING }
      : statusFilter === "IN_PROGRESS"
      ? { status: RoutingTaskStatus.IN_PROGRESS }
      : { status: RoutingTaskStatus.COMPLETED };

  const tasks = await prisma.routingTask.findMany({
    where: {
      organizationId: user.organizationId,
      department: "LABORATORY",
      ...(user.role === "LAB_SCIENTIST" ? { staffId: user.id } : {}),
      ...statusWhere,
    },
    take: ROW_LIMIT,
    select: {
      id: true,
      priority: true,
      status: true,
      testOrderIds: true,
      createdAt: true,
      updatedAt: true,
      visit: {
        select: {
          visitNumber: true,
          patient: {
            select: {
              fullName: true,
              patientId: true,
            },
          },
        },
      },
      sample: { select: { status: true } },
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
        select: {
          id: true,
          test: { select: { name: true } },
        },
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
          Active queue first, with clear next actions to reduce clicks. Showing latest {ROW_LIMIT} rows.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { key: "ACTIVE", label: "Active queue" },
          { key: "ALL", label: "All" },
          { key: "PENDING", label: "Pending" },
          { key: "IN_PROGRESS", label: "In progress" },
          { key: "COMPLETED", label: "Completed" },
        ].map((item) => {
          const active = statusFilter === item.key;
          const href = item.key === "ACTIVE" ? "/dashboard/lab-scientist/queue" : `/dashboard/lab-scientist/queue?status=${item.key}`;
          return (
            <Link
              key={item.key}
              href={href}
              className={`rounded border px-3 py-1 text-xs transition-colors ${
                active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <LabQueueTable rows={rows} />
    </div>
  );
}
