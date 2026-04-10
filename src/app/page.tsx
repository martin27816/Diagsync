import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/utils";
import { Role } from "@prisma/client";
import {
  Activity,
  BellRing,
  Clock3,
  ShieldCheck,
  Stethoscope,
  Users,
  Workflow,
} from "lucide-react";

const roles = [
  {
    name: "Receptionist",
    focus: "Fast intake, patient registration, billing status, and priority routing.",
  },
  {
    name: "Lab Scientist",
    focus: "Assigned queue, sample flow, dynamic result templates, and submission.",
  },
  {
    name: "Radiographer",
    focus: "Imaging queue, report drafts, findings, impressions, and dispatch to review.",
  },
  {
    name: "MD",
    focus: "Clinical review, approval, correction requests, and final sign-off.",
  },
  {
    name: "HRM / Operations",
    focus: "Live monitoring, audit trail, release center, and turnaround analytics.",
  },
];

const pillars = [
  {
    icon: Workflow,
    title: "Automatic Routing",
    text: "Test orders are split by department and assigned to available staff instantly.",
  },
  {
    icon: Clock3,
    title: "Turnaround Visibility",
    text: "Track every stage with timestamps from registration to result release.",
  },
  {
    icon: ShieldCheck,
    title: "Full Accountability",
    text: "Every key action is logged with actor, role, old/new values, and time.",
  },
  {
    icon: BellRing,
    title: "Real-Time Notifications",
    text: "Teams stay aligned with live updates across workflows and status changes.",
  },
];

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as any).role as Role;
    redirect(getDashboardPath(role));
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.28),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(250,204,21,0.16),transparent_35%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 sm:px-8 lg:px-10">
          <header className="mb-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/diagsync-logo.png" alt="Diagsync logo" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
              <div>
                <p className="text-lg font-semibold tracking-tight">Diagsync</p>
                <p className="text-xs text-slate-300/80">Diagnostic Workflow Operating System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-lg border border-slate-300/20 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800/70"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Register Lab
              </Link>
            </div>
          </header>

          <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
                <Activity className="h-3.5 w-3.5" />
                Built for multi-role diagnostic teams
              </p>
              <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                One platform for
                <span className="block bg-gradient-to-r from-emerald-300 via-sky-300 to-yellow-200 bg-clip-text text-transparent">
                  registration, testing, review, and release
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200/90">
                Diagsync helps labs run faster with role-based dashboards, auto-routing,
                audit trails, and measurable turnaround times from front desk intake to final
                report dispatch.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  Start Your Lab Setup
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-300/25 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/70"
                >
                  Sign In
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur">
              <p className="mb-4 text-sm font-semibold text-slate-200">Live Workflow Snapshot</p>
              <div className="space-y-3">
                {[
                  "Patient Registered",
                  "Tests Auto-Routed",
                  "Sample Collected",
                  "Result Submitted",
                  "MD Approved",
                  "Report Released",
                ].map((step, idx) => (
                  <div
                    key={step}
                    className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-950/70 px-4 py-2.5"
                  >
                    <span className="text-sm text-slate-200">{step}</span>
                    <span className="rounded-md bg-emerald-300/20 px-2 py-0.5 text-xs font-medium text-emerald-200">
                      Stage {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-16 sm:px-8 lg:px-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <item.icon className="mb-3 h-5 w-5 text-sky-300" />
              <h2 className="text-base font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-300/90">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 sm:px-8 lg:px-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-300" />
            <h3 className="text-xl font-bold">Role Dashboards</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => (
              <div
                key={role.name}
                className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-4"
              >
                <p className="text-sm font-semibold text-sky-200">{role.name}</p>
                <p className="mt-1 text-sm text-slate-300/90">{role.focus}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-5">
            <div className="flex items-start gap-3">
              <Stethoscope className="mt-0.5 h-5 w-5 text-emerald-200" />
              <div>
                <p className="font-semibold text-emerald-100">
                  Built for speed, traceability, and accountability
                </p>
                <p className="mt-1 text-sm text-emerald-50/90">
                  Every action is linked to a named user account, so management can monitor
                  workload, punctuality, delays, and productivity with confidence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

