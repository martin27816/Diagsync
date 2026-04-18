import { Role, Department, OrganizationStatus } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      organizationId: string | null;
      organizationStatus?: OrganizationStatus | null;
      fullName: string;
      department: Department;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    organizationId: string | null;
    organizationStatus?: OrganizationStatus | null;
    fullName: string;
    department: Department;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    organizationId: string | null;
    organizationStatus?: OrganizationStatus | null;
    fullName: string;
    department: Department;
  }
}
