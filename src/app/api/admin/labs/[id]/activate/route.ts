import { NextResponse } from "next/server";
import { requireMegaAdminApi } from "@/lib/admin-auth";
import { setOrganizationStatus } from "@/lib/admin-data";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireMegaAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  try {
    const updated = await setOrganizationStatus(params.id, "ACTIVE");
    return NextResponse.json({ success: true, data: updated, message: "Lab activated" });
  } catch {
    return NextResponse.json({ success: false, error: "Lab not found" }, { status: 404 });
  }
}
