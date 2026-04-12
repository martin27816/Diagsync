import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportWorkspace } from "@/components/reports/report-workspace";
 
export default async function ReceptionistDispatchPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "RECEPTIONIST" && user.role !== "SUPER_ADMIN") redirect("/dashboard");
 
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Dispatch Center</h1>
        <p className="text-xs text-slate-400 mt-0.5">Handle released reports — print, download, or WhatsApp dispatch.</p>
      </div>
      <ReportWorkspace role={user.role} />
    </div>
  );
}