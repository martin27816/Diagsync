import { NextResponse } from "next/server";
import { requireMegaAdminApi } from "@/lib/admin-auth";
import { getOrganizationDetail } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireMegaAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  const data = await getOrganizationDetail(params.id);
  if (!data) {
    return NextResponse.json({ success: false, error: "Lab not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
