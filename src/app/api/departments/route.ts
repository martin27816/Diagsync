import { NextResponse } from "next/server";
import { DEPARTMENT_LABELS } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { requireOrganizationCoreAccess } from "@/lib/billing-service";
import { canUseRadiology } from "@/lib/billing-access";

export const dynamic = "force-dynamic";

// GET /api/departments - returns all departments for dropdowns
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { organization } = await requireOrganizationCoreAccess(user.organizationId);
    const showRadiology = canUseRadiology(organization);

    const departments = Object.entries(DEPARTMENT_LABELS)
      .filter(([value]) => (showRadiology ? true : value !== "RADIOLOGY"))
      .map(([value, label]) => ({
      value,
      label,
      }));

    return NextResponse.json({ success: true, data: departments });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
    console.error("[DEPARTMENTS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
