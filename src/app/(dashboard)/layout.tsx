import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Role } from "@prisma/client";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  const staff = await prisma.staff.findUnique({
    where: { id: user.id },
    include: { organization: true },
  });

  if (!staff || staff.status !== "ACTIVE") {
    redirect("/login");
  }

  const operationalRoles: Role[] = ["LAB_SCIENTIST", "RADIOGRAPHER", "MD", "RECEPTIONIST"];
  const showAvailability = operationalRoles.includes(staff.role);

  return (
    <DashboardShell
      user={{
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
        organizationName: staff.organization.name,
      }}
      staffId={staff.id}
      staffName={staff.fullName}
      role={staff.role}
      initialAvailability={staff.availabilityStatus === "AVAILABLE"}
      showAvailabilityToggle={showAvailability}
    >
      {children}
    </DashboardShell>
  );
}
