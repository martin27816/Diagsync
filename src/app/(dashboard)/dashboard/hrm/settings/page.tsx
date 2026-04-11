import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LabSettingsForm } from "@/components/hrm/lab-settings-form";

export default async function LabSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard/hrm");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Laboratory Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage laboratory branding, logo, letterhead template, and report header/footer information.
        </p>
      </div>
      <LabSettingsForm />
    </div>
  );
}
