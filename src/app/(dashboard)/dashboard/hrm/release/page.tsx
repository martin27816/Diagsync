import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportWorkspace } from "@/components/reports/report-workspace";

export default async function HrmReleasePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["HRM", "SUPER_ADMIN"].includes(user.role)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Release Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          HRM can preview, release, print, download, send reports, and add receptionist instructions.
        </p>
      </div>
      <ReportWorkspace role={user.role} />
    </div>
  );
}
