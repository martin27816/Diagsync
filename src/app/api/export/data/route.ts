import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvEscape(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    if (!["SUPER_ADMIN", "HRM", "MD", "RECEPTIONIST"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const rows = await prisma.labResult.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        createdAt: true,
        resultData: true,
        testOrder: {
          select: {
            test: { select: { name: true } },
            visit: {
              select: {
                patient: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

    const header = "patientName,testName,result,date";
    const body = rows.map((row) => {
      const patientName = row.testOrder.visit.patient.fullName;
      const testName = row.testOrder.test.name;
      const result = JSON.stringify(row.resultData);
      const date = row.createdAt.toISOString();
      return [patientName, testName, result, date].map(csvEscape).join(",");
    });

    const csv = [header, ...body].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="diagsync-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("[EXPORT_DATA_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
