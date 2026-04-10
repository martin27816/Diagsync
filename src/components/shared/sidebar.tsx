"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  ClipboardList,
  Bell,
  CreditCard,
  FlaskConical,
  Activity,
  FileText,
  UserCheck,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  user: {
    fullName: string;
    email: string;
    role: string;
    organizationName: string;
  };
}

const navByRole: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  RECEPTIONIST: [
    { href: "/dashboard/receptionist", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/receptionist/new-patient", label: "New Patient", icon: UserPlus },
    { href: "/dashboard/receptionist/patients", label: "All Patients", icon: Users },
    { href: "/dashboard/receptionist/billing", label: "Billing", icon: CreditCard },
    { href: "/dashboard/receptionist/notifications", label: "Notifications", icon: Bell },
  ],
  LAB_SCIENTIST: [
    { href: "/dashboard/lab-scientist", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/lab-scientist/assigned", label: "Assigned Tests", icon: FlaskConical },
    { href: "/dashboard/lab-scientist/drafts", label: "Draft Results", icon: FileText },
    { href: "/dashboard/lab-scientist/edit-requests", label: "Edit Requests", icon: ClipboardList },
    { href: "/dashboard/lab-scientist/notifications", label: "Notifications", icon: Bell },
  ],
  RADIOGRAPHER: [
    { href: "/dashboard/radiographer", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/radiographer/assigned", label: "Imaging Queue", icon: Activity },
    { href: "/dashboard/radiographer/drafts", label: "Draft Reports", icon: FileText },
    { href: "/dashboard/radiographer/edit-requests", label: "Edit Requests", icon: ClipboardList },
    { href: "/dashboard/radiographer/notifications", label: "Notifications", icon: Bell },
  ],
  MD: [
    { href: "/dashboard/md", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/md/review-queue", label: "Review Queue", icon: ClipboardList },
    { href: "/dashboard/md/corrections", label: "Corrections", icon: FileText },
    { href: "/dashboard/md/approved", label: "Approved Today", icon: UserCheck },
    { href: "/dashboard/md/notifications", label: "Notifications", icon: Bell },
  ],
  HRM: [
    { href: "/dashboard/hrm", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/hrm/staff", label: "Staff", icon: Users },
    { href: "/dashboard/hrm/operations", label: "Operations", icon: Activity },
    { href: "/dashboard/hrm/audit", label: "Audit Log", icon: ClipboardList },
    { href: "/dashboard/hrm/notifications", label: "Notifications", icon: Bell },
  ],
  SUPER_ADMIN: [
    { href: "/dashboard/hrm", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/hrm/staff", label: "Staff", icon: Users },
    { href: "/dashboard/receptionist/patients", label: "Patients", icon: Users },
    { href: "/dashboard/hrm/operations", label: "Operations", icon: Activity },
    { href: "/dashboard/hrm/audit", label: "Audit Log", icon: ClipboardList },
    { href: "/dashboard/hrm/notifications", label: "Notifications", icon: Bell },
  ],
};

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const navItems = navByRole[user.role] ?? navByRole["HRM"];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      {/* Logo / Org */}
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <Image src="/diagsync-logo.png" alt="Diagsync logo" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{user.organizationName}</p>
          <p className="text-xs text-muted-foreground">Diagsync</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard/hrm" && href !== "/dashboard/receptionist" && href !== "/dashboard/lab-scientist" && href !== "/dashboard/radiographer" && href !== "/dashboard/md" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
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
