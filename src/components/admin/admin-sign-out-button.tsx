"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface AdminSignOutButtonProps {
  className?: string;
}

export function AdminSignOutButton({ className }: AdminSignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2 text-sm text-red-200 transition-colors hover:bg-red-500/20 hover:text-red-100",
        className
      )}
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
