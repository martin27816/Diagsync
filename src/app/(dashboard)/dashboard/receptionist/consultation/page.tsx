import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ConsultationBoard } from "@/components/consultation/consultation-board";

export default async function ReceptionistConsultationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["RECEPTIONIST", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Consultation Queue</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Register walk-in consultation patients and mark them consulted when called in by MD.
        </p>
      </div>
      <ConsultationBoard role={user.role} />
    </div>
  );
}

