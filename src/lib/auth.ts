import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== "production" ? "diagsync-local-dev-auth-secret" : undefined);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
        token.organizationStatus = (user as any).organizationStatus;
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
        (session.user as any).organizationStatus = token.organizationStatus;
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

        // OPTIMISED: select only required fields — removed `include: { organization: true }`
        // which was doing an unnecessary JOIN on every login. We only need organizationId (the FK),
        // not the full org record. The JWT stores the ID, not org details.
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
                status: true,
              },
            },
          },
        });

        if (!staff) return null;
        if (staff.status !== "ACTIVE") return null;
        if (staff.role !== "MEGA_ADMIN") {
          if (!staff.organizationId) return null;
          if (!staff.organization || staff.organization.status !== "ACTIVE") return null;
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
          organizationStatus: staff.organization?.status ?? null,
          fullName: staff.fullName,
          department: staff.department,
        };
      },
    }),
  ],
});
