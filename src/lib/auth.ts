import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { verifyDeviceToken } from "@/lib/device-tokens";
import { requireOrganizationCoreAccess } from "@/lib/billing-service";

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== "production" ? "diagsync-local-dev-auth-secret" : undefined);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const deviceSwitchSchema = z.object({
  switchToken: z.string().min(20),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
        token.organizationPlan = (user as any).organizationPlan;
        token.organizationStatus = (user as any).organizationStatus;
        token.trialEndsAt = (user as any).trialEndsAt;
        token.fullName = (user as any).fullName;
        token.department = (user as any).department;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).organizationPlan = token.organizationPlan;
        (session.user as any).organizationStatus = token.organizationStatus;
        (session.user as any).trialEndsAt = token.trialEndsAt;
        (session.user as any).fullName = token.fullName;
        (session.user as any).department = token.department;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const staff = await prisma.staff.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            fullName: true,
            passwordHash: true,
            role: true,
            department: true,
            organizationId: true,
            status: true,
            organization: {
              select: {
                plan: true,
                status: true,
                trialEndsAt: true,
              },
            },
          },
        });

        if (!staff) return null;
        if (staff.status !== "ACTIVE") return null;
        if (staff.role !== "MEGA_ADMIN") {
          if (!staff.organizationId) return null;
          if (!staff.organization) return null;
        }

        const passwordMatch = await bcrypt.compare(password, staff.passwordHash);
        if (!passwordMatch) return null;

        await prisma.staff.update({
          where: { id: staff.id },
          data: { lastSeen: new Date() },
        });

        return {
          id: staff.id,
          email: staff.email,
          name: staff.fullName,
          role: staff.role,
          organizationId: staff.organizationId,
          organizationPlan: staff.organization?.plan ?? null,
          organizationStatus: staff.organization?.status ?? null,
          trialEndsAt: staff.organization?.trialEndsAt?.toISOString() ?? null,
          fullName: staff.fullName,
          department: staff.department,
        };
      },
    }),
    Credentials({
      id: "device-switch",
      name: "Device Switch",
      credentials: {
        switchToken: { label: "Switch Token", type: "text" },
      },
      async authorize(credentials) {
        const parsed = deviceSwitchSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const tokenPayload = verifyDeviceToken(parsed.data.switchToken, "quick_switch");
        if (!tokenPayload) return null;

        const staff = await prisma.staff.findUnique({
          where: { id: tokenPayload.staffId },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            department: true,
            organizationId: true,
            status: true,
            organization: {
              select: {
                plan: true,
                status: true,
                trialEndsAt: true,
              },
            },
            deviceLinks: {
              where: {
                device: {
                  deviceKey: tokenPayload.deviceKey,
                  organizationId: tokenPayload.organizationId,
                },
              },
              select: { id: true },
              take: 1,
            },
          },
        });

        if (!staff) return null;
        if (staff.status !== "ACTIVE") return null;
        if (staff.role === "MEGA_ADMIN") return null;
        if (!staff.organizationId || staff.organizationId !== tokenPayload.organizationId) return null;
        if (!staff.organization) return null;
        if (staff.deviceLinks.length === 0) return null;

        try {
          await requireOrganizationCoreAccess(staff.organizationId);
        } catch {
          return null;
        }

        await prisma.staff.update({
          where: { id: staff.id },
          data: { lastSeen: new Date() },
        });

        return {
          id: staff.id,
          email: staff.email,
          name: staff.fullName,
          role: staff.role,
          organizationId: staff.organizationId,
          organizationPlan: staff.organization.plan,
          organizationStatus: staff.organization.status,
          trialEndsAt: staff.organization.trialEndsAt?.toISOString() ?? null,
          fullName: staff.fullName,
          department: staff.department,
        };
      },
    }),
  ],
});
