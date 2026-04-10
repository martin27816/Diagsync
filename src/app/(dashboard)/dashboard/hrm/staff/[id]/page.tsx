import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/index";
import { ROLE_LABELS, DEPARTMENT_LABELS, formatDate, formatDateTime } from "@/lib/utils";

export default async function StaffDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) redirect("/dashboard/hrm");

  const staff = await prisma.staff.findUnique({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      organization: { select: { name: true } },
      createdBy: { select: { fullName: true } },
      availabilityLogs: {
        orderBy: { changedAt: "desc" },
        take: 10,
      },
    },
  });

  if (!staff) notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityId: staff.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { actor: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/hrm/staff"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Staff
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {staff.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{staff.fullName}</h1>
              <p className="text-sm text-muted-foreground">{ROLE_LABELS[staff.role]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={staff.status === "ACTIVE" ? "success" : "destructive"}>
              {staff.status}
            </Badge>
            <Badge variant={staff.availabilityStatus === "AVAILABLE" ? "info" : "secondary"}>
              {staff.availabilityStatus === "AVAILABLE" ? "● Available" : "○ Away"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h2 className="font-semibold mb-4">Profile Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Full Name</p>
                <p className="font-medium">{staff.fullName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Gender</p>
                <p className="font-medium">{staff.gender ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Email</p>
                  <p className="font-medium">{staff.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Phone</p>
                  <p className="font-medium">{staff.phone}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Role</p>
                <p className="font-medium">{ROLE_LABELS[staff.role]}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Department</p>
                <p className="font-medium">{DEPARTMENT_LABELS[staff.department] ?? staff.department}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Default Shift</p>
                <p className="font-medium capitalize">{staff.defaultShift.toLowerCase()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Organization</p>
                <p className="font-medium">{staff.organization.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Date Joined</p>
                  <p className="font-medium">{formatDate(staff.dateJoined)}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Added By</p>
                <p className="font-medium">{staff.createdBy?.fullName ?? "System"}</p>
              </div>
            </div>
          </div>

          {/* Audit log */}
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h2 className="font-semibold mb-4">Activity History</h2>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity logged yet.</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {log.actor.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">{log.actor.fullName}</span>{" "}
                        <span className="text-muted-foreground">
                          {log.action.replaceAll("_", " ").toLowerCase()}
                        </span>
                      </p>
                      {log.notes && <p className="text-xs text-muted-foreground">{log.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Availability sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Availability Log
            </h2>
            {staff.availabilityLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes logged.</p>
            ) : (
              <div className="space-y-3">
                {staff.availabilityLogs.map((log) => (
                  <div key={log.id} className="text-sm border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={log.newStatus === "AVAILABLE" ? "success" : "secondary"}
                        className="text-xs"
                      >
                        {log.newStatus === "AVAILABLE" ? "Available" : "Away"}
                      </Badge>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{log.reason}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(log.changedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
