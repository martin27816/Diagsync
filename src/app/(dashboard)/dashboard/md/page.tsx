import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MdReviewBoard } from "@/components/md/md-review-board";

export default async function MDDashboard({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "MD") {
    redirect("/dashboard");
  }

  const raw = searchParams?.status ?? "pending";
  const initialStatus =
    raw === "approved" || raw === "rejected" || raw === "all" || raw === "pending"
      ? (raw as "pending" | "approved" | "rejected" | "all")
      : "pending";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Medical Review Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review submitted lab and radiology outputs, then approve, edit, or reject with reasons.
        </p>
      </div>
      <MdReviewBoard initialStatus={initialStatus} />
    </div>
  );
}
