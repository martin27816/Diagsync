import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ConsultationBoard } from "@/components/consultation/consultation-board";

export default async function HrmConsultationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["HRM", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Consultation Monitor</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          View all consultation activity, filter by date range, and see full receptionist/doctor attribution.
        </p>
      </div>
      <ConsultationBoard role={user.role} />
    </div>
  );
}

