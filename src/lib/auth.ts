import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
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
          include: { organization: true },
        });

        if (!staff) return null;
        if (staff.status !== "ACTIVE") return null;

        const passwordMatch = await bcrypt.compare(password, staff.passwordHash);
        if (!passwordMatch) return null;

        return {
          id: staff.id,
          email: staff.email,
          name: staff.fullName,
          role: staff.role,
          organizationId: staff.organizationId,
          fullName: staff.fullName,
          department: staff.department,
        };
      },
    }),
  ],
});
