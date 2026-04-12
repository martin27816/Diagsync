import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MdReviewBoard } from "@/components/md/md-review-board";
 
export default async function MDDashboard({ searchParams }: { searchParams?: { status?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "MD" && user.role !== "SUPER_ADMIN") redirect("/dashboard");
 
  const raw = searchParams?.status ?? "pending";
  const initialStatus = ["pending","approved","rejected","all"].includes(raw) ? raw as any : "pending";
 
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Medical Review</h1>
        <p className="text-xs text-slate-400 mt-0.5">Review submitted lab and radiology outputs. Approve, edit, or reject.</p>
      </div>
      <MdReviewBoard initialStatus={initialStatus} />
    </div>
  );
}