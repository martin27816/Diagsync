import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markNotificationAsRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    await markNotificationAsRead(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      params.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOTIFICATION_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Notification not found" }, { status: 404 });
      }
      if (error.message === "FORBIDDEN_NOTIFICATION") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }
    console.error("[NOTIFICATION_READ_ONE]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
