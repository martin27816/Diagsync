import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default async function HrmNotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (!["HRM", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }

  return <NotificationCenter />;
}
