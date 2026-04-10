import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  UserPlus,
  Users,
  Clock,
  CreditCard,
  FlaskConical,
  ArrowRight,
} from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/index";

export default async function ReceptionistDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["RECEPTIONIST", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard/hrm");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [todayPatients, unpaidVisits, recentPatients, totalToday] = await prisma.$transaction([
    // Count registered today
    prisma.patient.count({
      where: {
        organizationId: user.organizationId,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    // Count unpaid visits today
    prisma.visit.count({
      where: {
        organizationId: user.organizationId,
        paymentStatus: { in: ["PENDING", "PARTIAL"] },
        registeredAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    // Recent patients
    prisma.patient.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        visits: {
          orderBy: { registeredAt: "desc" },
          take: 1,
          include: {
            testOrders: {
              include: { test: { select: { name: true, type: true } } },
            },
          },
        },
      },
    }),
    // Total patients in org
    prisma.patient.count({
      where: { organizationId: user.organizationId },
    }),
  ]);

  const priorityColor: Record<string, "destructive" | "warning" | "secondary"> = {
    EMERGENCY: "destructive",
    URGENT: "warning",
    ROUTINE: "secondary",
  };

  const paymentColor: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    PAID: "success",
    PARTIAL: "warning",
    PENDING: "destructive",
    WAIVED: "secondary",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reception Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {user.fullName}
          </p>
        </div>
        <Link
          href="/dashboard/receptionist/new-patient"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          New Patient
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard
          title="Registered Today"
          value={todayPatients}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatsCard
          title="Awaiting Payment"
          value={unpaidVisits}
          icon={CreditCard}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
        />
        <StatsCard
          title="Total Patients"
          value={totalToday}
          icon={FlaskConical}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatsCard
          title="Active Today"
          value={todayPatients}
          icon={Clock}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
      </div>

      {/* Recent Patients */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-base">Recent Registrations</h2>
          <Link
            href="/dashboard/receptionist/patients"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentPatients.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No patients registered yet today.</p>
            <Link
              href="/dashboard/receptionist/new-patient"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Register first patient <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {recentPatients.map((patient) => {
              const latestVisit = patient.visits[0];
              return (
                <div key={patient.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {patient.fullName.charAt(0)}
                  </div>

                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{patient.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {patient.patientId} · {patient.age}y · {patient.sex}
                    </p>
                  </div>

                  {/* Tests */}
                  <div className="hidden sm:flex flex-col items-end gap-1 min-w-0">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {latestVisit?.testOrders.slice(0, 2).map((order) => (
                        <span
                          key={order.id}
                          className="inline-block rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {order.test.name}
                        </span>
                      ))}
                      {(latestVisit?.testOrders.length ?? 0) > 2 && (
                        <span className="inline-block rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                          +{(latestVisit?.testOrders.length ?? 0) - 2} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    {latestVisit && (
                      <>
                        <Badge variant={priorityColor[latestVisit.priority] ?? "secondary"} className="text-xs">
                          {latestVisit.priority}
                        </Badge>
                        <Badge variant={paymentColor[latestVisit.paymentStatus] ?? "secondary"} className="text-xs">
                          {latestVisit.paymentStatus}
                        </Badge>
                      </>
                    )}
                  </div>

                  {/* Time */}
                  <p className="text-xs text-muted-foreground shrink-0 hidden lg:block">
                    {formatDateTime(patient.createdAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
