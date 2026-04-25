import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganizationFeature } from "@/lib/billing-service";

export const runtime = "nodejs";

function parseSubscription(body: any) {
  const sub = body?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const authKey = sub?.keys?.auth;
  if (!endpoint || !p256dh || !authKey) return null;
  return {
    endpoint: String(endpoint),
    p256dh: String(p256dh),
    auth: String(authKey),
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  try {
    await requireOrganizationFeature(user.organizationId, "web_push");
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === "FEATURE_NOT_AVAILABLE") {
      return NextResponse.json(
        { success: false, error: "Web push notifications are available on Trial or Advanced plan." },
        { status: 403 }
      );
    }
    throw error;
  }
  const body = await req.json().catch(() => null);
  const parsed = parseSubscription(body);
  if (!parsed) {
    return NextResponse.json(
      { success: false, error: "Invalid subscription payload" },
      { status: 400 }
    );
  }

  const userAgent = req.headers.get("user-agent") ?? null;
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.endpoint },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        endpoint: parsed.endpoint,
        p256dh: parsed.p256dh,
        auth: parsed.auth,
        userAgent,
        lastSeenAt: new Date(),
      },
      update: {
        organizationId: user.organizationId,
        userId: user.id,
        p256dh: parsed.p256dh,
        auth: parsed.auth,
        userAgent,
        lastSeenAt: new Date(),
      },
    });
  } catch (error: any) {
    const code = String(error?.code ?? "");
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json(
        { success: false, error: "Push storage not ready. Run Prisma migration/db push." },
        { status: 503 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  try {
    await requireOrganizationFeature(user.organizationId, "web_push");
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === "FEATURE_NOT_AVAILABLE") {
      return NextResponse.json(
        { success: false, error: "Web push notifications are available on Trial or Advanced plan." },
        { status: 403 }
      );
    }
    throw error;
  }
  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return NextResponse.json({ success: false, error: "Endpoint is required" }, { status: 400 });
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint,
        organizationId: user.organizationId,
        userId: user.id,
      },
    });
  } catch (error: any) {
    const code = String(error?.code ?? "");
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json(
        { success: false, error: "Push storage not ready. Run Prisma migration/db push." },
        { status: 503 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
