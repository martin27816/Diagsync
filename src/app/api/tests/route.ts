import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TestType, Department } from "@prisma/client";

// GET /api/tests — list all active tests for the org
// Query params: ?search=fbc&type=LAB&department=LABORATORY
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") ?? "";
    const type = searchParams.get("type") as TestType | null;
    const department = searchParams.get("department") as Department | null;

    const tests = await prisma.diagnosticTest.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(type ? { type } : {}),
        ...(department ? { department } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        resultFields: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, data: tests });
  } catch (error) {
    console.error("[TESTS_GET]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}