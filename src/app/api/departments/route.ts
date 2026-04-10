import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEPARTMENT_LABELS } from "@/lib/utils";

// GET /api/departments — returns all departments for dropdowns
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const departments = Object.entries(DEPARTMENT_LABELS).map(([value, label]) => ({
      value,
      label,
    }));

    return NextResponse.json({ success: true, data: departments });
  } catch (error) {
    console.error("[DEPARTMENTS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
