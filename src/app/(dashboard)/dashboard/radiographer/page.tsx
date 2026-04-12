import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RadiologyTaskBoard } from "@/components/radiology/radiology-task-board";
 
export default async function RadiographerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "RADIOGRAPHER" && user.role !== "SUPER_ADMIN") redirect("/dashboard");
 
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Radiology Dashboard</h1>
        <p className="text-xs text-slate-400 mt-0.5">Manage imaging tasks, upload files, and submit diagnostic reports.</p>
      </div>
      <RadiologyTaskBoard />
    </div>
  );
}