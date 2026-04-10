import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/index";
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const where: any = {
    organizationId: user.organizationId,
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { patientId: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(todayOnly && {
      createdAt: { gte: todayStart, lte: todayEnd },
    }),
  };

  const [patients, total] = await prisma.$transaction([
    prisma.patient.findMany({
      where,
      include: {
        visits: {
          orderBy: { registeredAt: "desc" },
          take: 1,
          include: {
            testOrders: {
              include: { test: { select: { name: true, type: true, department: true } } },
            },
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

  const priorityColor: Record<string, string> = {
    EMERGENCY: "destructive",
    URGENT: "warning",
    ROUTINE: "secondary",
  };

  const paymentColor: Record<string, string> = {
    PAID: "success",
    PARTIAL: "warning",
    PENDING: "destructive",
    WAIVED: "secondary",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/receptionist"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-bold">All Patients</h1>
        </div>
        <Link
          href="/dashboard/receptionist/new-patient"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          New Patient
        </Link>
      </div>

      {/* Filter bar */}
      <form method="GET" className="flex flex-wrap items-center gap-3">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name, ID, phone..."
          className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="today"
            value="true"
            defaultChecked={todayOnly}
            className="rounded border"
          />
          Today only
        </label>
        <button
          type="submit"
          className="rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        Showing {patients.length} of {total} patient{total !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {patients.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>No patients found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Tests</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Payment</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {patients.map((patient) => {
                  const visit = patient.visits[0];
                  return (
                    <tr key={patient.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{patient.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {patient.age}y · {patient.sex}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{patient.patientId}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {visit?.testOrders.slice(0, 2).map((o) => (
                            <span key={o.id} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                              {o.test.name}
                            </span>
                          ))}
                          {(visit?.testOrders.length ?? 0) > 2 && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                              +{(visit?.testOrders.length ?? 0) - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell font-medium">
                        {visit ? formatCurrency(Number(visit.totalAmount)) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {visit && (
                          <Badge variant={priorityColor[visit.priority] as any}>{visit.priority}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {visit && (
                          <Badge variant={paymentColor[visit.paymentStatus] as any}>{visit.paymentStatus}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
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
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?search=${search}&today=${todayOnly}&page=${page - 1}`}
                className="rounded-md border px-3 py-1.5 hover:bg-muted transition-colors"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?search=${search}&today=${todayOnly}&page=${page + 1}`}
                className="rounded-md border px-3 py-1.5 hover:bg-muted transition-colors"
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
