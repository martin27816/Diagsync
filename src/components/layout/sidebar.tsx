"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  FlaskConical,
  Scan,
  Stethoscope,
  BarChart3,
  Bell,
  LogOut,
  ChevronRight,
  Activity,
  TestTube2,
} from "lucide-react";
import { cn, ROLE_LABELS } from "@/lib/utils";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navByRole: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    { label: "Overview", href: "/dashboard/hrm", icon: LayoutDashboard },
    { label: "Staff Management", href: "/dashboard/hrm/staff", icon: Users },
    { label: "Add Staff", href: "/dashboard/hrm/staff/new", icon: UserPlus },
    { label: "Test Catalog", href: "/dashboard/hrm/tests", icon: TestTube2 },
    { label: "Operations", href: "/dashboard/hrm/operations", icon: Activity },
    { label: "Audit Log", href: "/dashboard/hrm/audit", icon: ClipboardList },
    { label: "Analytics", href: "/dashboard/hrm/analytics", icon: BarChart3 },
  ],
  HRM: [
    { label: "Overview", href: "/dashboard/hrm", icon: LayoutDashboard },
    { label: "Staff Management", href: "/dashboard/hrm/staff", icon: Users },
    { label: "Add Staff", href: "/dashboard/hrm/staff/new", icon: UserPlus },
    { label: "Test Catalog", href: "/dashboard/hrm/tests", icon: TestTube2 },
    { label: "Operations", href: "/dashboard/hrm/operations", icon: Activity },
    { label: "Audit Log", href: "/dashboard/hrm/audit", icon: ClipboardList },
    { label: "Analytics", href: "/dashboard/hrm/analytics", icon: BarChart3 },
  ],
  RECEPTIONIST: [
    { label: "Dashboard", href: "/dashboard/receptionist", icon: LayoutDashboard },
    { label: "New Patient", href: "/dashboard/receptionist/new-patient", icon: UserPlus },
    { label: "Today's Patients", href: "/dashboard/receptionist/patients", icon: Users },
  ],
  LAB_SCIENTIST: [
    { label: "Dashboard", href: "/dashboard/lab-scientist", icon: LayoutDashboard },
    { label: "My Queue", href: "/dashboard/lab-scientist/queue", icon: ClipboardList },
    { label: "Results", href: "/dashboard/lab-scientist/results", icon: FlaskConical },
  ],
  RADIOGRAPHER: [
    { label: "Dashboard", href: "/dashboard/radiographer", icon: LayoutDashboard },
    { label: "Imaging Queue", href: "/dashboard/radiographer/queue", icon: Scan },
    { label: "Reports", href: "/dashboard/radiographer/reports", icon: ClipboardList },
  ],
  MD: [
    { label: "Dashboard", href: "/dashboard/md", icon: LayoutDashboard },
    { label: "Review Queue", href: "/dashboard/md/review", icon: Stethoscope },
    { label: "Approved", href: "/dashboard/md/approved", icon: ClipboardList },
  ],
};

interface SidebarProps {
  user: {
    fullName: string;
    email: string;
    role: Role;
    organizationName?: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const navItems = navByRole[user.role] ?? [];

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo / Org name */}
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            D
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">DiagOps</p>
            {user.organizationName && (
              <p className="truncate text-xs text-muted-foreground">{user.organizationName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {ROLE_LABELS[user.role]}
        </div>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="h-3 w-3" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Notifications link */}
      <div className="border-t px-3 py-2">
        <Link
          href="/notifications"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Bell className="h-4 w-4" />
          Notifications
        </Link>
      </div>

      {/* User info + logout */}
      <div className="border-t p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {user.fullName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}