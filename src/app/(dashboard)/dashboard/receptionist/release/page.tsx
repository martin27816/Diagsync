import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportWorkspace } from "@/components/reports/report-workspace";

export default async function ReceptionistDispatchPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "RECEPTIONIST" && user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dispatch Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Handle released reports for print, download, and WhatsApp dispatch.
        </p>
      </div>
      <ReportWorkspace role={user.role} />
    </div>
  );
}

