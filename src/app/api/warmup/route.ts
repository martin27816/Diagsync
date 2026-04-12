import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: true });
    }
    const user = session.user as { id?: string; organizationId?: string };
    if (!user.id || !user.organizationId) {
      return NextResponse.json({ success: true });
    }

    await prisma.staff.findFirst({
      where: {
        id: user.id,
        organizationId: user.organizationId,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
