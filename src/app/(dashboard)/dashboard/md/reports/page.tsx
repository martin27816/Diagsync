import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportWorkspace } from "@/components/reports/report-workspace";
 
export default async function MdReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["MD", "SUPER_ADMIN"].includes(user.role)) redirect("/dashboard");
 
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Report Workspace</h1>
        <p className="text-xs text-slate-400 mt-0.5">Preview approved reports and apply clinical edits before HRM release.</p>
      </div>
      <ReportWorkspace role={user.role} />
    </div>
  );
}