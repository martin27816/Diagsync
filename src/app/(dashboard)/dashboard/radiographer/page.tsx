import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RadiologyTaskBoard } from "@/components/radiology/radiology-task-board";

export default async function RadiographerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "RADIOGRAPHER" && user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Radiology Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage imaging tasks, upload files, and submit diagnostic reports.
        </p>
      </div>
      <RadiologyTaskBoard />
    </div>
  );
}
