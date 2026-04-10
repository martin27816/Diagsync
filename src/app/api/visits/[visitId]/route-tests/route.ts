import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assignTasksForVisit } from "@/lib/routing-engine";

export const dynamic = "force-dynamic";

// POST /api/visits/[visitId]/route-tests
// Triggers auto-routing for all REGISTERED test orders in the visit.
export async function POST(
  _req: NextRequest,
  { params }: { params: { visitId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (!["RECEPTIONIST", "HRM", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const assignments = await assignTasksForVisit(params.visitId, {
      organizationId: user.organizationId,
      actorId: user.id,
      actorRole: user.role,
    });

    return NextResponse.json({
      success: true,
      message:
        assignments.length > 0
          ? `Routed ${assignments.reduce((sum, item) => sum + item.testOrderIds.length, 0)} test order(s)`
          : "No unrouted test orders",
      data: assignments,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Visit not found") {
      return NextResponse.json({ success: false, error: "Visit not found" }, { status: 404 });
    }

    console.error("[ROUTE_TESTS]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
