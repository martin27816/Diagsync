"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import { Sidebar } from "@/components/layout/sidebar";
import { HeaderBar } from "@/components/layout/header-bar";
import { OfflineStatusBar } from "@/components/shared/offline-status-bar";
import { AppWarmup } from "@/components/shared/app-warmup";

type DashboardShellProps = {
  user: {
    fullName: string;
    email: string;
    role: Role;
    organizationName?: string;
  };
  staffId: string;
  staffName: string;
  role: Role;
  initialAvailability: boolean;
  showAvailabilityToggle?: boolean;
  children: React.ReactNode;
};

export function DashboardShell({
  user,
  staffId,
  staffName,
  role,
  initialAvailability,
  showAvailabilityToggle = true,
  children,
}: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <Sidebar user={user} className="hidden md:flex" />

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close navigation"
            onClick={() => setMobileSidebarOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <Sidebar
            user={user}
            className="relative z-10 flex h-[100dvh] w-[86vw] max-w-[320px] border-r border-slate-200 bg-white"
            onNavigate={() => setMobileSidebarOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppWarmup />
        <HeaderBar
          staffId={staffId}
          staffName={staffName}
          role={role}
          initialAvailability={initialAvailability}
          showAvailabilityToggle={showAvailabilityToggle}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />
        <OfflineStatusBar />
        <main className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
