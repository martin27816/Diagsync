import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/utils";
import { Role } from "@prisma/client";

const workflow = [
  "Patient Registered",
  "Tests Auto-Routed",
  "Sample Collected",
  "Result Submitted",
  "MD Approved",
  "Report Released",
];

const features = [
  {
    title: "Automatic Routing",
    text: "Test orders are split by department and assigned to available staff the moment a patient is registered.",
  },
  {
    title: "Turnaround Visibility",
    text: "Track every stage with timestamps — from front desk intake to final report dispatch.",
  },
  {
    title: "Full Audit Trail",
    text: "Every action is logged with actor, role, and timestamp. Nothing goes untracked.",
  },
  {
    title: "Real-Time Notifications",
    text: "Staff receive live updates across all workflow stages and status changes.",
  },
];

const roles = [
  {
    name: "Receptionist",
    text: "Patient registration, test ordering, billing, and priority assignment.",
  },
  {
    name: "Lab Scientist",
    text: "Assigned task queue, sample tracking, result entry, and submission.",
  },
  {
    name: "Radiographer",
    text: "Imaging queue, file uploads, findings, impressions, and report drafts.",
  },
  {
    name: "Medical Doctor",
    text: "Clinical review, approval, correction requests, and final sign-off.",
  },
  {
    name: "HRM / Operations",
    text: "Live monitoring, audit trail, release center, and analytics.",
  },
  {
    name: "Super Admin",
    text: "Full system access — staff management, test catalog, and org settings.",
  },
];

export default async function HomePage() {
  const session = await auth();
  const role = (session?.user as any)?.role as Role | undefined;
  const dashboardPath = role ? getDashboardPath(role) : "/dashboard";
  const isLoggedIn = Boolean(session?.user);

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (prefers-reduced-motion: no-preference) {
              .reveal {
                opacity: 0;
                transform: translateY(14px);
                animation: fadeUp 700ms ease forwards;
              }
              .delay-1 { animation-delay: 100ms; }
              .delay-2 { animation-delay: 200ms; }
              .delay-3 { animation-delay: 300ms; }
              .delay-4 { animation-delay: 400ms; }
              .float-card {
                animation: floatY 4.2s ease-in-out infinite;
              }
              .hover-lift {
                transition: transform 250ms ease, box-shadow 250ms ease;
              }
              .hover-lift:hover {
                transform: translateY(-3px);
                box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
              }
            }
            @keyframes fadeUp {
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            @keyframes floatY {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
            }
          `,
        }}
      />

      {/* Nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 reveal">
          <div className="flex items-center gap-2.5">
            <Image src="/diagsync-logo.png" alt="Diagsync" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-none">Diagsync</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Diagnostic Workflow System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Link href={dashboardPath} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Sign In
                </Link>
                <Link href="/register" className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                  Register Lab
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="reveal delay-1">
            <span className="inline-block rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 mb-5">
              Built for multi-role diagnostic labs
            </span>
            <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              One platform for registration, testing, review, and release
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-500 max-w-lg">
              Diagsync gives every role in your lab — from receptionist to MD — a focused dashboard
              with the exact tools they need. Auto-routing, audit trails, and measurable turnaround
              times out of the box.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isLoggedIn ? (
                <Link href={dashboardPath} className="rounded bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/register" className="rounded bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                    Set Up Your Lab
                  </Link>
                  <Link href="/login" className="rounded border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Workflow preview */}
          <div className="reveal delay-2 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patient Workflow</p>
            </div>
            <div className="divide-y divide-slate-100">
              {workflow.map((step, idx) => (
                <div key={step} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-slate-700">{step}</span>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    idx === workflow.length - 1
                      ? "bg-green-50 text-green-700"
                      : idx < 2
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {idx === workflow.length - 1 ? "Complete" : `Stage ${idx + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Proof strip */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Workflow Stages", value: "12+" },
            { label: "Role Dashboards", value: "6" },
            { label: "Audit Events", value: "100%" },
            { label: "Realtime Alerts", value: "Instant" },
          ].map((item, idx) => (
            <div
              key={item.label}
              className={`rounded-lg border border-slate-200 bg-white p-4 hover-lift reveal delay-${Math.min(idx + 1, 4)}`}
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 text-center reveal">
          <h2 className="text-xl font-semibold text-slate-800">Everything your lab needs to run properly</h2>
          <p className="mt-2 text-sm text-slate-400">No spreadsheets. No paper trails. Just a clean digital workflow.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, idx) => (
            <div key={f.title} className={`rounded-lg border border-slate-200 bg-white p-5 hover-lift reveal delay-${Math.min(idx + 1, 4)}`}>
              <div className="mb-3 h-1.5 w-8 rounded bg-blue-600" />
              <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Expanded workflow details */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="reveal">
            <h2 className="text-xl font-semibold text-slate-800">How the workflow stays clean from day one</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Every patient movement is attached to time, role, and department. The system removes handoff ambiguity by
              showing clear state transitions across reception, testing, review, and release.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Instead of depending on memory or verbal updates, each stage is visible as it happens. This reduces
              missed tasks, duplicate work, and delayed reporting.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 reveal delay-1 hover-lift">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Operational outcomes</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" /> Faster triage and routing at reception</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" /> Better accountability during test processing</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" /> Cleaner clinical review handoff to MD</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" /> Safer release process with complete audit history</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Role dashboards */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-8 reveal">
          <h2 className="text-xl font-semibold text-slate-800">A dashboard for every role</h2>
          <p className="mt-1.5 text-sm text-slate-400">
            Each staff member sees only what they need — nothing more.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Role</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">What They Do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role) => (
                <tr key={role.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{role.name}</td>
                  <td className="px-5 py-3 text-slate-500">{role.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* FAQ */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-8 reveal">
          <h2 className="text-xl font-semibold text-slate-800">Frequently asked questions</h2>
          <p className="mt-1.5 text-sm text-slate-400">Quick answers for teams moving from paper or spreadsheet workflows.</p>
        </div>
        <div className="space-y-3">
          {[
            {
              q: "Can we start with one department first?",
              a: "Yes. You can onboard reception and one diagnostic team first, then expand to full multi-role flow.",
            },
            {
              q: "Does the system support strict result review before release?",
              a: "Yes. Results can move through draft, MD review, approval, and release with full traceability.",
            },
            {
              q: "Will staff only see what is relevant to their role?",
              a: "Yes. Each role dashboard is scoped so staff focus on their assigned tasks and actions.",
            },
          ].map((faq, idx) => (
            <div key={faq.q} className={`rounded-lg border border-slate-200 bg-white p-5 reveal delay-${Math.min(idx + 1, 4)} hover-lift`}>
              <p className="text-sm font-semibold text-slate-800">{faq.q}</p>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-8 py-12 reveal delay-1">
          <h2 className="text-xl font-semibold text-slate-800">Ready to digitise your lab?</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Register your organisation in minutes. Add staff, set up your test catalog,
            and start routing patients the same day.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {isLoggedIn ? (
              <Link href={dashboardPath} className="rounded bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/register" className="rounded bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                  Register Your Lab
                </Link>
                <Link href="/login" className="rounded border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Image src="/diagsync-logo.png" alt="Diagsync" width={24} height={24} className="h-6 w-6 rounded object-cover" />
            <span className="text-xs font-semibold text-slate-600">Diagsync</span>
          </div>
          <p className="text-xs text-slate-400">Diagnostic Workflow Operating System</p>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link href={dashboardPath} className="text-xs text-slate-400 hover:text-slate-600">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="text-xs text-slate-400 hover:text-slate-600">Sign In</Link>
                <Link href="/register" className="text-xs text-slate-400 hover:text-slate-600">Register</Link>
              </>
            )}
          </div>
        </div>
      </footer>

    </main>
  );
}
