import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LabTaskBoard } from "@/components/lab/lab-task-board";

export default async function LabScientistDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "LAB_SCIENTIST" && user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Scientist Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Handle assigned lab tasks from sample collection to result submission.
        </p>
      </div>
      <LabTaskBoard />
    </div>
  );
}
