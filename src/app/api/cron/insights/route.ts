import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLabInsights } from "@/lib/insights/generate-insights";

export const dynamic = "force-dynamic";

function isEndOfWeek(date: Date) {
  return date.getDay() === 0;
}

function isEndOfMonth(date: Date) {
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  return tomorrow.getMonth() !== date.getMonth();
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export async function GET() {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      return NextResponse.json(
        { success: false, error: "Use POST with Bearer token for cron execution." },
        { status: 405 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Cron secret not configured." },
      { status: 403 }
    );
  } catch (error) {
    console.error("[CRON_INSIGHTS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization") ?? "";
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const shouldRunWeekly = isEndOfWeek(now);
    const shouldRunMonthly = isEndOfMonth(now);
    if (!shouldRunWeekly && !shouldRunMonthly) {
      return NextResponse.json({
        success: true,
        message: "No insights due today",
        date: now.toISOString(),
      });
    }

    const organizations = await prisma.organization.findMany({
      select: { id: true },
    });

    const periodEnd = startOfDay(now);
    const monthlyStart = startOfMonth(now);
    const weeklyStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const reports: Array<{ organizationId: string; reportType: "WEEKLY" | "MONTHLY" }> = [];

    for (const org of organizations) {
      if (shouldRunWeekly) {
        await generateLabInsights(org.id, weeklyStart, periodEnd);
        reports.push({ organizationId: org.id, reportType: "WEEKLY" });
      }
      if (shouldRunMonthly) {
        await generateLabInsights(org.id, monthlyStart, periodEnd);
        reports.push({ organizationId: org.id, reportType: "MONTHLY" });
      }
    }

    return NextResponse.json({
      success: true,
      date: now.toISOString(),
      generated: reports.length,
      reports,
    });
  } catch (error) {
    console.error("[CRON_INSIGHTS_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
