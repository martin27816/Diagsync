"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/index";
import { ROLE_LABELS, DEPARTMENT_LABELS } from "@/lib/utils";
import { Role, Department, Shift } from "@prisma/client";

const schema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Phone number required"),
  role: z.nativeEnum(Role),
  department: z.nativeEnum(Department),
  gender: z.string().optional(),
  defaultShift: z.nativeEnum(Shift),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

const ROLES_FOR_FORM = Object.entries(ROLE_LABELS).filter(
  ([key]) => key !== "SUPER_ADMIN"
);

export function AddStaffForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { defaultShift: Shift.MORNING },
  });

  async function onSubmit(data: FormData) {
    setServerError("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        setServerError(json.error ?? "Something went wrong");
        return;
      }
      setSuccess(true);
      reset();
      setTimeout(() => router.push("/dashboard/hrm/staff"), 1500);
    } catch {
      setServerError("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Staff member created successfully! Redirecting...
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input id="fullName" placeholder="e.g. Jane Okafor" {...register("fullName")} />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email Address *</Label>
          <Input id="email" type="email" placeholder="jane@lab.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" placeholder="+234..." {...register("phone")} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        {/* Gender */}
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <Select onValueChange={(v) => setValue("gender", v)}>
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <Label>Role *</Label>
          <Select onValueChange={(v) => setValue("role", v as Role)}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES_FOR_FORM.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
        </div>

        {/* Department */}
        <div className="space-y-1.5">
          <Label>Department *</Label>
          <Select onValueChange={(v) => setValue("department", v as Department)}>
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DEPARTMENT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
        </div>

        {/* Default Shift */}
        <div className="space-y-1.5">
          <Label>Default Shift *</Label>
          <Select
            defaultValue={Shift.MORNING}
            onValueChange={(v) => setValue("defaultShift", v as Shift)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MORNING">Morning</SelectItem>
              <SelectItem value="AFTERNOON">Afternoon</SelectItem>
              <SelectItem value="NIGHT">Night</SelectItem>
              <SelectItem value="FULL_DAY">Full Day</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password">Password *</Label>
          <Input id="password" type="password" placeholder="Min 8 characters" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm Password *</Label>
          <Input id="confirmPassword" type="password" placeholder="Repeat password" {...register("confirmPassword")} />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Staff Member"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/hrm/staff")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
