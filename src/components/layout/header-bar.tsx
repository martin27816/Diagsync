"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/index";
import { Badge } from "@/components/ui/index";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface HeaderBarProps {
  staffId: string;
  staffName: string;
  role: string;
  initialAvailability: boolean;
  showAvailabilityToggle?: boolean;
}

export function HeaderBar({
  staffId,
  staffName,
  role,
  initialAvailability,
  showAvailabilityToggle = true,
}: HeaderBarProps) {
  const [isAvailable, setIsAvailable] = useState(initialAvailability);
  const [loading, setLoading] = useState(false);

  // Only operational roles have the availability toggle
  const operationalRoles = ["LAB_SCIENTIST", "RADIOGRAPHER", "MD", "RECEPTIONIST"];
  const showToggle = showAvailabilityToggle && operationalRoles.includes(role);

  async function handleAvailabilityToggle(checked: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/${staffId}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: checked ? "AVAILABLE" : "UNAVAILABLE",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAvailable(checked);
      }
    } catch (error) {
      console.error("Failed to update availability:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Good {getTimeOfDay()},{" "}
          <span className="text-foreground font-semibold">{staffName.split(" ")[0]}</span>
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Availability Toggle */}
        {showToggle && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge
              variant={isAvailable ? "success" : "secondary"}
              className={cn("text-xs", loading && "opacity-60")}
            >
              {isAvailable ? "● Available" : "○ Unavailable"}
            </Badge>
            <Switch
              checked={isAvailable}
              onCheckedChange={handleAvailabilityToggle}
              disabled={loading}
              aria-label="Toggle availability"
            />
          </div>
        )}

        <NotificationBell role={role} />
      </div>
    </header>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
