import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { HeaderBar } from "@/components/layout/header-bar";
import { OfflineStatusBar } from "@/components/shared/offline-status-bar";
import { Role } from "@prisma/client";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  // Fetch fresh staff data including organization name
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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        user={{
          fullName: staff.fullName,
          email: staff.email,
          role: staff.role,
          organizationName: staff.organization.name,
        }}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar
          staffId={staff.id}
          staffName={staff.fullName}
          role={staff.role}
          initialAvailability={staff.availabilityStatus === "AVAILABLE"}
          showAvailabilityToggle={showAvailability}
        />
        <OfflineStatusBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
