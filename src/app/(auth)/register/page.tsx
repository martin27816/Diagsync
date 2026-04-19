"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

const schema = z.object({
  orgName: z.string().min(2, "Organisation name is required"),
  orgEmail: z.string().email("Valid email required"),
  orgPhone: z.string().min(7, "Phone number required"),
  orgAddress: z.string().min(5, "Address required"),
  orgContactInfo: z.string().optional(),
  // FIX: .or(z.literal("")) must come before .optional() so empty string is accepted
  orgLogo: z.string().url().or(z.literal("")).optional(),
  orgLetterheadUrl: z.string().url().or(z.literal("")).optional(),
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

const inputCls = "h-8 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls = "block text-[11px] font-medium text-slate-500 mb-1";
const errCls = "mt-0.5 text-[11px] text-red-500";

function getFriendlyFileName(url: string) {
  try { return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? ""); }
  catch { return decodeURIComponent(url.split("/").pop() ?? ""); }
}

function PasswordInput({
  placeholder,
  registration,
  error,
}: {
  placeholder: string;
  registration: ReturnType<ReturnType<typeof useForm<FormData>>["register"]>;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          {...registration}
          className={`${inputCls} pr-8`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-slate-600 focus:outline-none"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {error && <p className={errCls}>{error}</p>}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);

  const { register, setValue, watch, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError("");
    try {
      const res = await fetch("/api/organizations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      let json: { success: boolean; error?: string };
      try {
        json = await res.json();
      } catch {
        setServerError(`Server error (${res.status}). Please try again.`);
        return;
      }

      if (!json.success) {
        setServerError(json.error ?? "Something went wrong");
        return;
      }
      setRegistered(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      console.error("Registration error:", err);
      setServerError("Network error. Please try again.");
    }
  }

  async function uploadBranding(file: File, folder: string, setter: (v: boolean) => void) {
    setter(true);
    try {
      const form = new FormData();
      form.append("file", file); form.append("folder", folder);
      const res = await fetch("/api/uploads/branding", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) { setServerError(json.error ?? "Upload failed"); return null; }
      return json.data.fileUrl as string;
    } catch { setServerError("Upload failed"); return null; }
    finally { setter(false); }
  }

  if (registered) return (
    <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-xl">✓</div>
      <h2 className="text-sm font-semibold text-slate-800">Registration Successful</h2>
      <p className="mt-1 text-xs text-slate-400">Your organisation is set up. Redirecting to login...</p>
    </div>
  );

  return (
    <div className="w-full max-w-xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h1 className="text-base font-semibold text-slate-800">Register Your Lab</h1>
        <p className="text-xs text-slate-400 mt-0.5">Set up your organisation and admin account</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" {...register("orgLogo")} />
          <input type="hidden" {...register("orgLetterheadUrl")} />

          {serverError && (
            <div className="mx-4 mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{serverError}</div>
          )}

          {/* Organisation Details */}
          <div className="border-b border-slate-100 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Organisation Details</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Lab / Organisation Name *</label>
              <input placeholder="e.g. Reene Medical Diagnostics" {...register("orgName")} className={inputCls} />
              {errors.orgName && <p className={errCls}>{errors.orgName.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Lab Email *</label>
              <input type="email" placeholder="info@lab.com" {...register("orgEmail")} className={inputCls} />
              {errors.orgEmail && <p className={errCls}>{errors.orgEmail.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Lab Phone *</label>
              <input placeholder="+234..." {...register("orgPhone")} className={inputCls} />
              {errors.orgPhone && <p className={errCls}>{errors.orgPhone.message}</p>}
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Lab Address *</label>
              <input placeholder="Full lab address" {...register("orgAddress")} className={inputCls} />
              {errors.orgAddress && <p className={errCls}>{errors.orgAddress.message}</p>}
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Additional Contact Info (optional)</label>
              <input placeholder="Website, alternate phone, etc." {...register("orgContactInfo")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Lab Logo (optional)</label>
              <input type="file" accept="image/*" className="text-xs text-slate-600"
                onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const url = await uploadBranding(file, "diagsync/branding/logo", setUploadingLogo);
                  if (url) setValue("orgLogo", url);
                }} />
              {uploadingLogo && <p className="text-[11px] text-slate-400 mt-0.5">Uploading...</p>}
              {watch("orgLogo") && <p className="text-[11px] text-blue-600 mt-0.5 truncate">{getFriendlyFileName(watch("orgLogo") ?? "")}</p>}
            </div>
            <div>
              <label className={labelCls}>Letterhead Template (optional)</label>
              <input type="file" accept="image/*" className="text-xs text-slate-600"
                onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const url = await uploadBranding(file, "diagsync/branding/letterhead", setUploadingLetterhead);
                  if (url) setValue("orgLetterheadUrl", url);
                }} />
              {uploadingLetterhead && <p className="text-[11px] text-slate-400 mt-0.5">Uploading...</p>}
              {watch("orgLetterheadUrl") && <p className="text-[11px] text-blue-600 mt-0.5 truncate">{getFriendlyFileName(watch("orgLetterheadUrl") ?? "")}</p>}
            </div>
          </div>

          {/* Admin Account */}
          <div className="border-t border-b border-slate-100 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Admin Account</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Admin Full Name *</label>
              <input placeholder="e.g. Dr. Sarah Obi" {...register("adminName")} className={inputCls} />
              {errors.adminName && <p className={errCls}>{errors.adminName.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Admin Email *</label>
              <input type="email" placeholder="admin@lab.com" {...register("adminEmail")} className={inputCls} />
              {errors.adminEmail && <p className={errCls}>{errors.adminEmail.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Admin Phone *</label>
              <input placeholder="+234..." {...register("adminPhone")} className={inputCls} />
              {errors.adminPhone && <p className={errCls}>{errors.adminPhone.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Password *</label>
              <PasswordInput
                placeholder="Min 8 characters"
                registration={register("adminPassword")}
                error={errors.adminPassword?.message}
              />
            </div>
            <div>
              <label className={labelCls}>Confirm Password *</label>
              <PasswordInput
                placeholder="Repeat password"
                registration={register("confirmPassword")}
                error={errors.confirmPassword?.message}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 p-4">
            <button type="submit" disabled={isSubmitting}
              className="w-full rounded bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {isSubmitting ? "Registering..." : "Register Organisation"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              Already registered?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
