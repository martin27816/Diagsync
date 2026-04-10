import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AddStaffForm } from "@/components/forms/add-staff-form";

export default async function AddStaffPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["SUPER_ADMIN", "HRM"].includes(user.role)) {
    redirect("/dashboard/hrm");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/dashboard/hrm/staff"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Staff
        </Link>
        <h1 className="text-2xl font-bold">Add Staff Member</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new account for a staff member in your organization.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <AddStaffForm />
      </div>
    </div>
  );
}
