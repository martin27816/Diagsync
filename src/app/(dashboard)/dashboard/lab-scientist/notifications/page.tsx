import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default async function LabNotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "LAB_SCIENTIST" && user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return <NotificationCenter />;
}
