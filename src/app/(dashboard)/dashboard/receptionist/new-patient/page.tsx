import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewPatientForm } from "@/components/receptionist/new-patient-form";

export default async function NewPatientPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;

  if (!["RECEPTIONIST", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard/hrm");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Register New Patient</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in patient details, search and add tests, then save to route to the lab.
        </p>
      </div>
      <NewPatientForm />
    </div>
  );
}