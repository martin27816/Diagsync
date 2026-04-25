import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markConsultationPatientIn } from "@/lib/consultation-workflow";

export const dynamic = "force-dynamic";

export async function PATCH(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    const data = await markConsultationPatientIn(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      params.id
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "BILLING_LOCKED") {
        return NextResponse.json(
          { success: false, error: "Billing access required. Please choose or renew a plan." },
          { status: 403 }
        );
      }
      if (error.message === "FORBIDDEN_ROLE") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "QUEUE_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Queue patient not found" }, { status: 404 });
      }
      if (error.message === "ALREADY_CONSULTED") {
        return NextResponse.json({ success: false, error: "Patient already consulted" }, { status: 409 });
      }
      if (error.message === "QUEUE_CANCELLED") {
        return NextResponse.json({ success: false, error: "Queue entry is cancelled" }, { status: 409 });
      }
    }
    console.error("[CONSULTATIONS_IN_PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
