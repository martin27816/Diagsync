import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = session.user as any;

  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let lastTopId: string | null = null;
      let lastUnread = -1;

      const write = (chunk: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
      };

      write(sse("ready", { ok: true }));

      const interval = setInterval(async () => {
        try {
          const [top, unreadCount] = await Promise.all([
            prisma.notification.findFirst({
              where: { organizationId: user.organizationId, userId: user.id },
              orderBy: { createdAt: "desc" },
              select: { id: true, createdAt: true },
            }),
            prisma.notification.count({
              where: { organizationId: user.organizationId, userId: user.id, isRead: false },
            }),
          ]);

          const topId = top?.id ?? null;
          if (topId !== lastTopId || unreadCount !== lastUnread) {
            lastTopId = topId;
            lastUnread = unreadCount;
            write(sse("notification", { unreadCount, topId }));
          } else {
            write(": heartbeat\n\n");
          }
        } catch {
          write(sse("error", { message: "stream_error" }));
        }
      }, 5000);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!closed) {
          closed = true;
          controller.close();
        }
      }, 1000 * 60 * 10);

      cleanup = () => {
        clearInterval(interval);
        clearTimeout(timeout);
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
