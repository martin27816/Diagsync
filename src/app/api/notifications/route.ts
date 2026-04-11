import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") ?? "20");
    const cursor = searchParams.get("cursor") ?? undefined;

    const data = await listNotifications(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      { limit, cursor }
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[NOTIFICATIONS_LIST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
