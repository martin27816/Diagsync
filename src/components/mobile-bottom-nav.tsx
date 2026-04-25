"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ClipboardList, FileText, Settings2 } from "lucide-react";
import { Role } from "@prisma/client";

type BottomNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navByRole: Record<Role, BottomNavItem[]> = {
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/dashboard/hrm", icon: LayoutDashboard },
    { label: "Patients", href: "/dashboard/receptionist/patients", icon: Users },
    { label: "Tasks", href: "/dashboard/hrm/operations", icon: ClipboardList },
    { label: "Reports", href: "/dashboard/hrm/release", icon: FileText },
    { label: "Settings", href: "/dashboard/hrm/settings", icon: Settings2 },
  ],
  HRM: [
    { label: "Dashboard", href: "/dashboard/hrm", icon: LayoutDashboard },
    { label: "Patients", href: "/dashboard/receptionist/patients", icon: Users },
    { label: "Tasks", href: "/dashboard/hrm/operations", icon: ClipboardList },
    { label: "Reports", href: "/dashboard/hrm/release", icon: FileText },
    { label: "Settings", href: "/dashboard/billing", icon: Settings2 },
  ],
  RECEPTIONIST: [
    { label: "Dashboard", href: "/dashboard/receptionist", icon: LayoutDashboard },
    { label: "Patients", href: "/dashboard/receptionist/patients", icon: Users },
    { label: "Tasks", href: "/dashboard/receptionist/consultation", icon: ClipboardList },
    { label: "Reports", href: "/dashboard/receptionist/release", icon: FileText },
    { label: "Settings", href: "/dashboard/billing", icon: Settings2 },
  ],
  LAB_SCIENTIST: [
    { label: "Dashboard", href: "/dashboard/lab-scientist", icon: LayoutDashboard },
    { label: "Patients", href: "/dashboard/lab-scientist/results", icon: Users },
    { label: "Tasks", href: "/dashboard/lab-scientist/queue", icon: ClipboardList },
    { label: "Reports", href: "/dashboard/lab-scientist/results", icon: FileText },
    { label: "Settings", href: "/dashboard/billing", icon: Settings2 },
  ],
  RADIOGRAPHER: [
    { label: "Dashboard", href: "/dashboard/radiographer", icon: LayoutDashboard },
    { label: "Patients", href: "/dashboard/radiographer/reports", icon: Users },
    { label: "Tasks", href: "/dashboard/radiographer/queue", icon: ClipboardList },
    { label: "Reports", href: "/dashboard/radiographer/reports", icon: FileText },
    { label: "Settings", href: "/dashboard/billing", icon: Settings2 },
  ],
  MD: [
    { label: "Dashboard", href: "/dashboard/md", icon: LayoutDashboard },
    { label: "Patients", href: "/dashboard/receptionist/patients", icon: Users },
    { label: "Tasks", href: "/dashboard/md/review", icon: ClipboardList },
    { label: "Reports", href: "/dashboard/md/reports", icon: FileText },
    { label: "Settings", href: "/dashboard/billing", icon: Settings2 },
  ],
  MEGA_ADMIN: [],
};

export function MobileBottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navByRole[role] ?? [];

  if (items.length === 0) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] ${
                  active ? "text-blue-600" : "text-slate-500"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
