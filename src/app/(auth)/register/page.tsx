"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/index";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/index";

const schema = z.object({
  orgName: z.string().min(2, "Organization name is required"),
  orgEmail: z.string().email("Valid email required"),
  orgPhone: z.string().min(7, "Phone number required"),
  orgAddress: z.string().min(5, "Address required"),
  orgContactInfo: z.string().optional(),
  orgLogo: z.string().url().optional().or(z.literal("")),
  orgLetterheadUrl: z.string().url().optional().or(z.literal("")),
  adminName: z.string().min(2, "Admin full name required"),
  adminEmail: z.string().email("Valid admin email required"),
  adminPhone: z.string().min(7, "Admin phone required"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.adminPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

function getFriendlyFileName(url: string) {
  if (!url) return "";
  try {
    const pathname = new URL(url).pathname;
    const value = pathname.split("/").pop() ?? "";
    return decodeURIComponent(value);
  } catch {
    const value = url.split("/").pop() ?? "";
    return decodeURIComponent(value);
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);

  const {
    register,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError("");
    try {
      const res = await fetch("/api/organizations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        setServerError(json.error ?? "Something went wrong");
        return;
      }
      setRegistered(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setServerError("Network error. Please try again.");
    }
  }

  async function uploadBranding(file: File, folder: string, setter: (v: boolean) => void) {
    setter(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const res = await fetch("/api/uploads/branding", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        setServerError(json.error ?? "Branding upload failed");
        return null;
      }
      return json.data.fileUrl as string;
    } catch {
      setServerError("Branding upload failed");
      return null;
    } finally {
      setter(false);
    }
  }

  if (registered) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Registration Successful!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your organization has been set up. Redirecting to login...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl shadow-lg">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">Register Your Lab</CardTitle>
        <CardDescription>Set up your organization and admin account</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <input type="hidden" {...register("orgLogo")} />
          <input type="hidden" {...register("orgLetterheadUrl")} />
          {serverError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {/* Organization Details */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Organization Details
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="orgName">Lab / Organization Name *</Label>
                <Input id="orgName" placeholder="e.g. Reene Medical Diagnostics" {...register("orgName")} />
                {errors.orgName && <p className="text-xs text-destructive">{errors.orgName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orgEmail">Lab Email *</Label>
                <Input id="orgEmail" type="email" placeholder="info@lab.com" {...register("orgEmail")} />
                {errors.orgEmail && <p className="text-xs text-destructive">{errors.orgEmail.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orgPhone">Lab Phone *</Label>
                <Input id="orgPhone" placeholder="+234..." {...register("orgPhone")} />
                {errors.orgPhone && <p className="text-xs text-destructive">{errors.orgPhone.message}</p>}
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="orgAddress">Lab Address *</Label>
                <Input id="orgAddress" placeholder="Full lab address" {...register("orgAddress")} />
                {errors.orgAddress && <p className="text-xs text-destructive">{errors.orgAddress.message}</p>}
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="orgContactInfo">Additional Contact Info (optional)</Label>
                <Input id="orgContactInfo" placeholder="Website, alternate phone, etc." {...register("orgContactInfo")} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Lab Logo (optional)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadBranding(file, "diagsync/branding/logo", setUploadingLogo);
                      if (url) setValue("orgLogo", url);
                    }}
                  />
                  {uploadingLogo ? <span className="text-xs text-muted-foreground">Uploading...</span> : null}
                </div>
                {watch("orgLogo") ? <p className="text-xs text-muted-foreground">Uploaded: {getFriendlyFileName(watch("orgLogo") ?? "")}</p> : null}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Letterhead Template (optional)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadBranding(file, "diagsync/branding/letterhead", setUploadingLetterhead);
                      if (url) setValue("orgLetterheadUrl", url);
                    }}
                  />
                  {uploadingLetterhead ? <span className="text-xs text-muted-foreground">Uploading...</span> : null}
                </div>
                {watch("orgLetterheadUrl") ? <p className="text-xs text-muted-foreground">Uploaded: {getFriendlyFileName(watch("orgLetterheadUrl") ?? "")}</p> : null}
              </div>
            </div>
          </div>

          {/* Admin Account */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Admin Account
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="adminName">Admin Full Name *</Label>
                <Input id="adminName" placeholder="e.g. Dr. Sarah Obi" {...register("adminName")} />
                {errors.adminName && <p className="text-xs text-destructive">{errors.adminName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminEmail">Admin Email *</Label>
                <Input id="adminEmail" type="email" placeholder="admin@lab.com" {...register("adminEmail")} />
                {errors.adminEmail && <p className="text-xs text-destructive">{errors.adminEmail.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminPhone">Admin Phone *</Label>
                <Input id="adminPhone" placeholder="+234..." {...register("adminPhone")} />
                {errors.adminPhone && <p className="text-xs text-destructive">{errors.adminPhone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminPassword">Password *</Label>
                <Input id="adminPassword" type="password" placeholder="Min 8 characters" {...register("adminPassword")} />
                {errors.adminPassword && <p className="text-xs text-destructive">{errors.adminPassword.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input id="confirmPassword" type="password" placeholder="Repeat password" {...register("confirmPassword")} />
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              "Register Organization"
            )}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
