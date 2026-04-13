import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/utils";
import { Role } from "@prisma/client";

const workflow = [
  { step: "Patient Registered", desc: "Demographics, clinical notes, referring doctor captured" },
  { step: "Tests Auto-Routed", desc: "Orders split by type and assigned to available staff instantly" },
  { step: "Sample Collected", desc: "Lab scientist logs collection with timestamp and sample ID" },
  { step: "Results Drafted", desc: "Structured entry with field validation and normal-range flags" },
  { step: "Submitted for Review", desc: "Result moves to MD queue with full data snapshot" },
  { step: "MD Reviews & Approves", desc: "Doctor may approve, request edits, or reject with notes" },
  { step: "Report Released", desc: "Branded PDF dispatched — audit-logged instantly" },
];

const orderStatuses = [
  { key: "REGISTERED", label: "Registered", color: "bg-slate-100 text-slate-600" },
  { key: "ASSIGNED", label: "Assigned", color: "bg-blue-50 text-blue-700" },
  { key: "OPENED", label: "Opened", color: "bg-blue-100 text-blue-800" },
  { key: "SAMPLE_PENDING", label: "Sample Pending", color: "bg-amber-50 text-amber-700" },
  { key: "SAMPLE_COLLECTED", label: "Sample Collected", color: "bg-amber-100 text-amber-800" },
  { key: "IN_PROGRESS", label: "In Progress", color: "bg-orange-50 text-orange-700" },
  { key: "RESULT_DRAFTED", label: "Result Drafted", color: "bg-purple-50 text-purple-700" },
  { key: "SUBMITTED_FOR_REVIEW", label: "Submitted", color: "bg-indigo-50 text-indigo-700" },
  { key: "EDIT_REQUESTED", label: "Edit Requested", color: "bg-red-50 text-red-600" },
  { key: "RESUBMITTED", label: "Resubmitted", color: "bg-violet-50 text-violet-700" },
  { key: "APPROVED", label: "Approved", color: "bg-teal-50 text-teal-700" },
  { key: "RELEASED", label: "Released", color: "bg-green-50 text-green-700" },
  { key: "CANCELLED", label: "Cancelled", color: "bg-rose-50 text-rose-600" },
];

const features = [
  {
    title: "Automatic Task Routing",
    text: "Test orders are instantly split by department (Lab vs Radiology) and assigned to available staff the moment a patient is registered. No manual handoff, no missed assignments.",
  },
  {
    title: "Turnaround Time Tracking",
    text: "Every test has a configurable turnaround target in minutes. The system tracks elapsed time per stage and flags orders approaching or exceeding their target.",
  },
  {
    title: "Full Audit Trail",
    text: "Every action is logged with actor identity, role, department, and timestamp. Nothing goes untracked — from first registration to final release.",
  },
  {
    title: "Real-Time Notifications",
    text: "Staff receive live alerts for task assignments, result submissions, approval decisions, report releases, and more — 15+ distinct notification event types.",
  },
  {
    title: "Structured Result Templates",
    text: "Custom result fields per test — number, text, textarea, dropdown, checkbox. Each field can carry units, normal ranges, reference notes, and is required or optional.",
  },
  {
    title: "MD Edit Request Cycle",
    text: "Doctors can approve results, request specific edits, or reject with annotated notes. Lab scientists receive edit requests and resubmit — every version is preserved.",
  },
  {
    title: "Priority Triage",
    text: "Every patient visit is tagged ROUTINE, URGENT, or EMERGENCY. Priority propagates to staff queues so critical cases are always visible and never buried.",
  },
  {
    title: "Cloudinary Image Uploads",
    text: "Radiographers upload imaging files directly into the platform using secure signed Cloudinary uploads. Images attach to the order and flow through the review pipeline.",
  },
];

const roles = [
  {
    name: "Receptionist",
    dept: "RECEPTION",
    color: "bg-blue-50 text-blue-700",
    text: "Patient registration with full demographic capture, test ordering with a live cart, payment entry (PENDING / PAID / WAIVED / PARTIAL), priority assignment, and visit management.",
  },
  {
    name: "Lab Scientist",
    dept: "LABORATORY",
    color: "bg-amber-50 text-amber-700",
    text: "Assigned task queue sorted by priority, sample tracking through PENDING → COLLECTED → PROCESSING → DONE stages, structured result entry with field validation, submission, and edit-request handling.",
  },
  {
    name: "Radiographer",
    dept: "RADIOLOGY",
    color: "bg-purple-50 text-purple-700",
    text: "Imaging task queue, secure file uploads to Cloudinary, findings and impressions entry, report draft composition, and submission to MD review.",
  },
  {
    name: "Medical Doctor",
    dept: "MEDICAL_REVIEW",
    color: "bg-teal-50 text-teal-700",
    text: "Clinical review dashboard, approval with a single action, edit requests with structured notes sent back to the submitting scientist, resubmission review, and final sign-off before release.",
  },
  {
    name: "HRM / Operations",
    dept: "HR_OPERATIONS",
    color: "bg-indigo-50 text-indigo-700",
    text: "Live workflow monitoring across all departments, release center for dispatching approved reports, full audit event log, staff availability management, and operational analytics.",
  },
  {
    name: "Super Admin",
    dept: "ALL",
    color: "bg-slate-100 text-slate-700",
    text: "Full system access — staff creation and suspension, shift assignment, test catalog management with custom result fields, test categories, org settings, letterhead upload, and logo management.",
  },
];

const notificationEvents = [
  "Task Assigned", "Result Submitted", "Result Approved", "Result Rejected",
  "Result Edited", "Report Draft Updated", "Report Ready for Review",
  "Report Released", "Report Sent", "Report Printed", "Report Downloaded",
  "Report Send Failed", "Task Delayed", "Task Reassigned", "Task Overridden", "System Alert",
];

const payments = [
  { status: "PAID", color: "bg-green-50 text-green-700", desc: "Full payment received" },
  { status: "PARTIAL", color: "bg-amber-50 text-amber-700", desc: "Partial payment, balance pending" },
  { status: "PENDING", color: "bg-slate-100 text-slate-600", desc: "Payment not yet collected" },
  { status: "WAIVED", color: "bg-blue-50 text-blue-700", desc: "Fee waived by authorised staff" },
];

const reportFeatures = [
  {
    title: "Branded PDF Reports",
    text: "Every released report is rendered as a branded PDF carrying your organisation's logo and letterhead. Upload your letterhead once in org settings and it applies to all future reports.",
  },
  {
    title: "Lab & Radiology Reports",
    text: "Two distinct report types with purpose-built layouts. Lab reports surface structured field results with normal-range annotations. Radiology reports include imaging references, findings, and radiographer impressions.",
  },
  {
    title: "Draft → Released Lifecycle",
    text: "Reports move from DRAFT to RELEASED only after full MD approval. A report can never be released while an edit request is outstanding.",
  },
  {
    title: "Report Dispatch Tracking",
    text: "Every report action — sent, printed, downloaded, failed — is logged with timestamp and actor. HRM can view the complete dispatch history for any report.",
  },
];

const catalogFeatures = [
  {
    title: "Test Categories",
    text: "Group tests into categories (e.g. Haematology, Biochemistry, Imaging) for cleaner ordering at reception and faster filtering in staff queues.",
  },
  {
    title: "Per-Test Turnaround Targets",
    text: "Each test has its own turnaround target in minutes. The system uses this to calculate SLA health across your order pipeline.",
  },
  {
    title: "Sample Type Tagging",
    text: "Tag each lab test with the sample type required (blood, urine, swab, etc.). This information surfaces in the lab scientist's collection queue.",
  },
  {
    title: "Custom Result Fields",
    text: "Build result templates with any combination of field types — number with units and normal ranges, free text, dropdowns, multi-line notes, and checkboxes. Fully configurable per test.",
  },
];

const staffFeatures = [
  {
    title: "Shift Management",
    text: "Assign each staff member a default shift — MORNING, AFTERNOON, NIGHT, or FULL_DAY. Shift info is considered during task routing and queue display.",
  },
  {
    title: "Availability Status",
    text: "Staff can be toggled AVAILABLE or UNAVAILABLE. Unavailable staff are excluded from auto-routing, preventing tasks from landing in empty queues.",
  },
  {
    title: "Active / Suspended Accounts",
    text: "Super Admin can activate, deactivate, or suspend staff accounts. Suspended accounts cannot log in but their historical records are fully preserved.",
  },
  {
    title: "Role-Scoped Dashboards",
    text: "Every role gets a dashboard that shows exactly their responsibilities — nothing from other departments bleeds through.",
  },
];

const proofStats = [
  { label: "Order Status Stages", value: "13" },
  { label: "Role Dashboards", value: "6" },
  { label: "Notification Event Types", value: "16" },
  { label: "Audit Events Logged", value: "100%" },
  { label: "Payment States", value: "4" },
  { label: "Priority Levels", value: "3" },
  { label: "Report Types", value: "2" },
  { label: "Field Types Supported", value: "5" },
];

const faqs = [
  {
    q: "Can we onboard one department first?",
    a: "Yes. You can start with reception and one diagnostic department, then expand to full multi-role flow without disrupting existing data.",
  },
  {
    q: "Can the MD send a result back for corrections?",
    a: "Yes. The MD can request edits with structured notes. The submitting scientist receives the request, makes corrections, and resubmits. Every version is preserved in the audit trail.",
  },
  {
    q: "How does the system handle urgent patients?",
    a: "Patients can be marked ROUTINE, URGENT, or EMERGENCY at registration. Priority propagates to every staff queue so critical cases are always surfaced first.",
  },
  {
    q: "Can we upload radiology images?",
    a: "Yes. Radiographers upload imaging files via secure signed Cloudinary uploads. Images attach to the order and are available throughout the review and release pipeline.",
  },
  {
    q: "Do we get branded PDF reports?",
    a: "Yes. Upload your organisation logo and letterhead once in settings. Every released report is rendered as a branded PDF with full patient, test, and result details.",
  },
  {
    q: "Can we customise result fields per test?",
    a: "Yes. Each test in your catalog can have its own result template — with any mix of number fields (with units and normal ranges), text fields, dropdowns, checkboxes, and multi-line notes.",
  },
  {
    q: "Is payment tracking built in?",
    a: "Yes. Each visit tracks total amount, amount paid, discount, payment method, and status (PAID / PARTIAL / PENDING / WAIVED). Partial payments show outstanding balances.",
  },
  {
    q: "Will staff only see their own tasks?",
    a: "Yes. Every role dashboard is scoped to the relevant department and responsibilities. Cross-department data never bleeds into another staff member's view.",
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
            /* ── Scroll-based reveal ── */
            .reveal {
              opacity: 0;
              transform: translateY(20px);
              transition: opacity 0.65s cubic-bezier(.22,1,.36,1), transform 0.65s cubic-bezier(.22,1,.36,1);
            }
            .reveal.visible {
              opacity: 1;
              transform: translateY(0);
            }
            .reveal-left {
              opacity: 0;
              transform: translateX(-24px);
              transition: opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1);
            }
            .reveal-left.visible { opacity: 1; transform: translateX(0); }
            .reveal-right {
              opacity: 0;
              transform: translateX(24px);
              transition: opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1);
            }
            .reveal-right.visible { opacity: 1; transform: translateX(0); }

            /* ── Stagger delays ── */
            .d1 { transition-delay: 60ms; }
            .d2 { transition-delay: 130ms; }
            .d3 { transition-delay: 200ms; }
            .d4 { transition-delay: 270ms; }
            .d5 { transition-delay: 340ms; }
            .d6 { transition-delay: 410ms; }
            .d7 { transition-delay: 480ms; }
            .d8 { transition-delay: 550ms; }

            /* ── Hover lift ── */
            .lift {
              transition: transform 240ms cubic-bezier(.34,1.56,.64,1), box-shadow 240ms ease;
            }
            .lift:hover {
              transform: translateY(-4px);
              box-shadow: 0 12px 32px rgba(15,23,42,0.08);
            }

            /* ── Float animation ── */
            @keyframes floatY {
              0%, 100% { transform: translateY(0px); }
              50%       { transform: translateY(-8px); }
            }
            .float { animation: floatY 4.5s ease-in-out infinite; }

            /* ── Pulse dot ── */
            @keyframes pulseDot {
              0%, 100% { opacity: 1; transform: scale(1); }
              50%       { opacity: 0.5; transform: scale(0.75); }
            }
            .pulse-dot { animation: pulseDot 2s ease-in-out infinite; }

            /* ── Shimmer / skeleton ── */
            @keyframes shimmer {
              0%   { background-position: -400px 0; }
              100% { background-position: 400px 0; }
            }
            .shimmer-bar {
              background: linear-gradient(90deg, #f0f0f0 25%, #e0e8ff 50%, #f0f0f0 75%);
              background-size: 800px 100%;
              animation: shimmer 2.2s infinite linear;
              border-radius: 4px;
            }

            /* ── Typewriter cursor ── */
            @keyframes blink { 50% { opacity: 0; } }
            .cursor { animation: blink 1s step-start infinite; }

            /* ── Ticker ── */
            @keyframes ticker {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .ticker-inner { animation: ticker 28s linear infinite; }
            .ticker-wrap:hover .ticker-inner { animation-play-state: paused; }

            /* ── Count-up ── */
            .count-target { font-variant-numeric: tabular-nums; }

            /* ── Status chip entrance ── */
            @keyframes chipIn {
              from { opacity: 0; transform: scale(0.85); }
              to   { opacity: 1; transform: scale(1); }
            }
            .chip-in { animation: chipIn 0.35s cubic-bezier(.34,1.56,.64,1) both; }

            /* ── Progress bar fill ── */
            @keyframes fillBar {
              from { width: 0%; }
            }
            .fill-bar { animation: fillBar 1.4s cubic-bezier(.22,1,.36,1) both; }

            /* ── Connector line draw ── */
            @keyframes drawLine {
              from { transform: scaleX(0); }
              to   { transform: scaleX(1); }
            }
            .draw-line {
              transform-origin: left;
              animation: drawLine 0.7s cubic-bezier(.22,1,.36,1) both;
            }

            /* ── Notification slide-in ── */
            @keyframes notifIn {
              from { opacity: 0; transform: translateX(20px); }
              to   { opacity: 1; transform: translateX(0); }
            }
            .notif-in { animation: notifIn 0.5s cubic-bezier(.22,1,.36,1) both; }

            /* ── Section divider gradient ── */
            .grad-divider {
              height: 1px;
              background: linear-gradient(90deg, transparent 0%, #e2e8f0 20%, #bfdbfe 50%, #e2e8f0 80%, transparent 100%);
            }

            /* ── Feature icon box ── */
            .icon-box {
              width: 36px; height: 36px;
              border-radius: 8px;
              display: flex; align-items: center; justify-content: center;
              flex-shrink: 0;
            }
          `,
        }}
      />

      {/* ──────────────────────────── Scroll observer ──────────────────────────── */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', function() {
              var els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
              var obs = new IntersectionObserver(function(entries) {
                entries.forEach(function(e) {
                  if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
                });
              }, { threshold: 0.12 });
              els.forEach(function(el) { obs.observe(el); });
            });
          `,
        }}
      />

      {/* ─────────────────────────────── NAV ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Image src="/diagsync-logo.png" alt="Diagsync" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-none">Diagsync</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Diagnostic Workflow OS</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-800 transition-colors">Features</a>
            <a href="#workflow" className="hover:text-slate-800 transition-colors">Workflow</a>
            <a href="#roles" className="hover:text-slate-800 transition-colors">Roles</a>
            <a href="#reports" className="hover:text-slate-800 transition-colors">Reports</a>
            <a href="#faq" className="hover:text-slate-800 transition-colors">FAQ</a>
          </nav>
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

      {/* ─────────────────────────────── HERO ─────────────────────────────── */}
      <section className="relative overflow-hidden mx-auto max-w-6xl px-6 py-20 lg:py-28">
        {/* background decoration */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-blue-50 opacity-60" />
          <div className="absolute bottom-0 -left-20 h-[320px] w-[320px] rounded-full bg-slate-50 opacity-80" />
        </div>

        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="reveal">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 pulse-dot" />
              Built for multi-role diagnostic labs
            </span>
            <h1 className="text-4xl font-bold leading-[1.15] text-slate-900 sm:text-5xl">
              From patient registration
              <br />
              <span className="text-blue-600">to signed report</span>
              <br />
              in one platform.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-500 max-w-lg">
              Diagsync gives every role in your diagnostic lab — receptionist, lab scientist,
              radiographer, MD, and operations — a focused dashboard with exactly the tools
              they need. Auto-routing, structured results, MD approval cycles, branded PDF
              reports, and complete audit trails out of the box.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isLoggedIn ? (
                <Link href={dashboardPath} className="rounded bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/register" className="rounded bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">
                    Set Up Your Lab
                  </Link>
                  <Link href="/login" className="rounded border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    Sign In
                  </Link>
                </>
              )}
            </div>
            <p className="mt-5 text-xs text-slate-400">No credit card required · Set up in minutes · All roles included</p>
          </div>

          {/* Hero visual — live-order card */}
          <div className="reveal-right float">
            <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400 pulse-dot" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Live Order · #ORD-2841</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">URGENT</span>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Adaeze Okonkwo</p>
                    <p className="text-xs text-slate-400 mt-0.5">F · 34 yrs · Ref: Dr. Emeka Eze</p>
                  </div>
                  <span className="rounded bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">IN PROGRESS</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { test: "Full Blood Count", dept: "LAB", status: "Result Drafted", color: "bg-purple-50 text-purple-700", time: "2m ago" },
                    { test: "Liver Function Test", dept: "LAB", status: "In Progress", color: "bg-orange-50 text-orange-700", time: "8m ago" },
                    { test: "Chest X-Ray", dept: "RADIOLOGY", status: "Submitted for Review", color: "bg-indigo-50 text-indigo-700", time: "15m ago" },
                  ].map((item) => (
                    <div key={item.test} className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-slate-700">{item.test}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.dept} · {item.time}</p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${item.color}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[11px] text-slate-400">Total</p><p className="text-sm font-bold text-slate-800">₦18,500</p></div>
                  <div><p className="text-[11px] text-slate-400">Paid</p><p className="text-sm font-bold text-green-600">₦15,000</p></div>
                  <div><p className="text-[11px] text-slate-400">Balance</p><p className="text-sm font-bold text-amber-600">₦3,500</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────── NOTIFICATION TICKER ─────────────────────── */}
      <div className="border-y border-slate-100 bg-slate-50 py-3 overflow-hidden ticker-wrap">
        <div className="ticker-inner flex gap-8 whitespace-nowrap" style={{ width: "max-content" }}>
          {[...notificationEvents, ...notificationEvents].map((evt, i) => (
            <span key={i} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-1 w-1 rounded-full bg-blue-400" />
              {evt}
            </span>
          ))}
        </div>
      </div>

      {/* ──────────────────────────── PROOF STATS ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {proofStats.map((s, i) => (
            <div key={s.label} className={`reveal d${Math.min(i + 1, 8)} lift rounded-xl border border-slate-200 bg-white p-4 text-center`}>
              <p className="text-2xl font-bold text-slate-900 count-target">{s.value}</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ─────────────────────────── FEATURES GRID ─────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 reveal">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Platform Features</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Everything your lab needs to run properly</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">No spreadsheets. No paper trails. No verbal handoffs. A clean digital workflow from the first patient to the last report.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div key={f.title} className={`reveal d${Math.min(i + 1, 8)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="icon-box bg-blue-50 mb-4">
                <div className="h-3.5 w-3.5 rounded-sm bg-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────── ORDER STATUS PIPELINE ─────────────────────── */}
      <section id="workflow" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-start">
          <div className="reveal-left">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Order Lifecycle</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">13 order statuses. Every state tracked.</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Every test order in Diagsync moves through a precisely defined state machine — from the moment it's registered at reception to the moment the report is released. There are no ambiguous handoffs. Every transition is logged with who did it, when, and why.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              The edit-request cycle is fully supported: if an MD requests corrections, the order moves to <strong className="font-semibold text-slate-700">EDIT_REQUESTED</strong>, the scientist corrects and resubmits to <strong className="font-semibold text-slate-700">RESUBMITTED</strong>, and the MD reviews again before approval.
            </p>
          </div>

          <div className="reveal-right">
            <div className="flex flex-wrap gap-2">
              {orderStatuses.map((s, i) => (
                <span
                  key={s.key}
                  className={`chip-in rounded-full px-3 py-1 text-xs font-semibold ${s.color}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ───────────────────── WORKFLOW STEPS (DETAILED) ─────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center reveal">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Step by Step</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">How a patient moves through your lab</h2>
          <p className="mt-2 text-sm text-slate-400">Every stage has an owner. Every action has a timestamp.</p>
        </div>
        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-5 top-6 bottom-6 w-px bg-slate-200 hidden sm:block" />
          <div className="space-y-3">
            {workflow.map((item, idx) => (
              <div key={item.step} className={`reveal d${Math.min(idx + 1, 8)} flex items-start gap-5 rounded-xl border border-slate-200 bg-white p-5 lift`}>
                <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold z-10">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{item.step}</p>
                    <span className={`text-[11px] font-semibold rounded px-2 py-0.5 ${
                      idx === workflow.length - 1 ? "bg-green-50 text-green-700" :
                      idx < 2 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      Stage {idx + 1}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── ROLE DASHBOARDS ──────────────────────────── */}
      <section id="roles" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 reveal">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Role Dashboards</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Six focused dashboards. One platform.</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">
            Each staff member sees only what they need. Every dashboard is purpose-built for the tasks, queues, and decisions that role handles every day.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r, i) => (
            <div key={r.name} className={`reveal d${Math.min(i + 1, 6)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-800">{r.name}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${r.color}`}>{r.dept}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── PAYMENT TRACKING ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="reveal-left">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Payment Management</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Full payment lifecycle at reception</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Receptionists capture the full payment picture at registration — total amount, discount, amount paid, payment method, and outstanding balance. Each visit has one of four payment statuses that update in real time as payments come in.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Partial payments show the outstanding balance clearly. Waived fees are logged with the authorising staff member. No visit leaves without a financial record.
            </p>
          </div>
          <div className="reveal-right grid grid-cols-2 gap-3">
            {payments.map((p, i) => (
              <div key={p.status} className={`lift rounded-xl border border-slate-200 bg-white p-4 d${i + 1}`}>
                <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold mb-3 ${p.color}`}>{p.status}</span>
                <p className="text-xs text-slate-500">{p.desc}</p>
              </div>
            ))}
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Per-visit billing summary</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Total", val: "₦24,000", c: "text-slate-800" },
                  { label: "Discount", val: "₦2,000", c: "text-blue-600" },
                  { label: "Paid", val: "₦18,000", c: "text-green-600" },
                  { label: "Balance", val: "₦4,000", c: "text-amber-600" },
                ].map((b) => (
                  <div key={b.label}>
                    <p className="text-[10px] text-slate-400">{b.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${b.c}`}>{b.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── REPORTS ──────────────────────────── */}
      <section id="reports" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 reveal">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Report Engine</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Branded PDF reports with full dispatch tracking</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">Lab and radiology reports rendered with your organisation's branding. Every dispatch action logged.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reportFeatures.map((f, i) => (
            <div key={f.title} className={`reveal d${Math.min(i + 1, 4)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="mb-3 h-1 w-10 rounded-full bg-blue-600" />
              <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>

        {/* Report dispatch badge strip */}
        <div className="mt-8 reveal rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Report action events logged</p>
          <div className="flex flex-wrap gap-2">
            {["Sent", "Printed", "Downloaded", "Send Failed", "Draft Updated", "Released", "Ready for Review"].map((a) => (
              <span key={a} className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs text-slate-600 font-medium">{a}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── TEST CATALOG ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div className="reveal-left">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Test Catalog</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">A fully configurable diagnostic test catalog</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Super Admins build and maintain the lab's complete test catalog. Every test has a code, type (Lab or Radiology), department, price, turnaround target, sample type, and a fully custom result template.
            </p>
            <div className="mt-6 space-y-3">
              {catalogFeatures.map((f, i) => (
                <div key={f.title} className={`reveal d${i + 1} rounded-lg border border-slate-200 bg-white p-4 lift`}>
                  <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Field type table */}
          <div className="reveal-right">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Custom Result Field Types</p>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {[
                    { type: "NUMBER", desc: "Numeric value with units, min/max normal range, and reference note" },
                    { type: "TEXT", desc: "Short single-line text input for findings or IDs" },
                    { type: "TEXTAREA", desc: "Multi-line text for impressions, comments, or narrative" },
                    { type: "DROPDOWN", desc: "Select from a predefined option list configured per test" },
                    { type: "CHECKBOX", desc: "Boolean present/absent or yes/no result field" },
                  ].map((f) => (
                    <tr key={f.type} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">{f.type}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-[11px] text-slate-400">Each field: required flag · sort order · units · normal range · reference note</p>
              </div>
            </div>

            {/* Turnaround preview */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Sample turnaround targets</p>
              <div className="space-y-3">
                {[
                  { name: "Full Blood Count", time: 45, max: 120 },
                  { name: "Liver Function Test", time: 90, max: 120 },
                  { name: "Chest X-Ray", time: 30, max: 60 },
                  { name: "Urinalysis", time: 20, max: 60 },
                ].map((t) => (
                  <div key={t.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-600">{t.name}</span>
                      <span className="text-xs text-slate-400">{t.time}min</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 fill-bar"
                        style={{ width: `${(t.time / t.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── STAFF MANAGEMENT ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 reveal">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Staff Management</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Complete staff lifecycle management</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">From onboarding to shift assignment to availability status — manage your entire team from a single admin panel.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {staffFeatures.map((f, i) => (
            <div key={f.title} className={`reveal d${Math.min(i + 1, 4)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="icon-box bg-blue-50 mb-4">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>

        {/* Shift / status strip */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="reveal rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Shift Types</p>
            <div className="flex flex-wrap gap-2">
              {["MORNING", "AFTERNOON", "NIGHT", "FULL_DAY"].map((s) => (
                <span key={s} className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">{s}</span>
              ))}
            </div>
          </div>
          <div className="reveal rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Account States</p>
            <div className="flex flex-wrap gap-2">
              {[
                { s: "ACTIVE", c: "bg-green-50 text-green-700" },
                { s: "INACTIVE", c: "bg-slate-100 text-slate-600" },
                { s: "SUSPENDED", c: "bg-red-50 text-red-600" },
              ].map((a) => (
                <span key={a.s} className={`rounded-full px-3 py-1 text-xs font-semibold ${a.c}`}>{a.s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── NOTIFICATIONS ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="reveal-left">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Notifications</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">16 real-time notification types. Zero missed updates.</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Every significant event in the workflow fires a targeted notification to the right staff member. Task assignments, result submissions, MD approvals or rejections, report releases, dispatch failures — all delivered in real time to the relevant role.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Staff never have to poll or ask for updates. When something needs their attention, they know immediately.
            </p>
          </div>

          {/* Notification mock */}
          <div className="reveal-right space-y-2">
            {[
              { icon: "✓", title: "Result Approved", body: "Chest X-Ray for Adaeze Okonkwo approved by Dr. Chidi", time: "just now", color: "bg-green-50 text-green-700" },
              { icon: "!", title: "Edit Requested", body: "FBC result for Emeka Nwosu — correction needed in WBC field", time: "2m ago", color: "bg-red-50 text-red-600" },
              { icon: "→", title: "Task Assigned", body: "Urinalysis · Patient #P-1042 assigned to you", time: "5m ago", color: "bg-blue-50 text-blue-700" },
              { icon: "↓", title: "Report Released", body: "LFT report for Ngozi Obi is now available for dispatch", time: "12m ago", color: "bg-teal-50 text-teal-700" },
            ].map((n, i) => (
              <div
                key={n.title}
                className="notif-in lift flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${n.color}`}>{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                    <p className="text-[11px] text-slate-400 whitespace-nowrap">{n.time}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── AUDIT TRAIL ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Audit log mock */}
          <div className="reveal-left">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Audit Log · Last 6 Events</p>
                <span className="h-2 w-2 rounded-full bg-green-400 pulse-dot" />
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { actor: "Dr. Chidi Okafor", role: "MD", action: "Approved result", target: "FBC · #ORD-2841", time: "09:42:11" },
                  { actor: "Chinyere Eze", role: "LAB_SCIENTIST", action: "Submitted result", target: "FBC · #ORD-2841", time: "09:38:04" },
                  { actor: "Adanna Musa", role: "RECEPTIONIST", action: "Registered patient", target: "Adaeze Okonkwo", time: "09:31:55" },
                  { actor: "Ikenna Obi", role: "RADIOGRAPHER", action: "Uploaded image", target: "Chest X-Ray · #ORD-2839", time: "09:28:17" },
                  { actor: "System", role: "AUTO_ROUTE", action: "Assigned task", target: "Urinalysis → Chinyere", time: "09:27:44" },
                  { actor: "Dr. Chidi Okafor", role: "MD", action: "Edit requested", target: "LFT · #ORD-2838", time: "09:21:03" },
                ].map((e) => (
                  <div key={`${e.time}-${e.action}`} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700 truncate">{e.actor}</p>
                      <p className="text-[11px] text-slate-400 whitespace-nowrap font-mono">{e.time}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{e.action} · <span className="text-slate-400">{e.target}</span></p>
                    <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{e.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="reveal-right">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Audit Trail</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Every action. Every actor. Every timestamp.</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Diagsync maintains a complete immutable audit log for every organisation. Nothing is ever deleted or modified without a trace. HRM and Super Admins can filter audit events by actor, role, department, action type, and date range.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Whether you need to investigate a delayed report, verify who released a result, or review how a payment was waived — the audit trail has the answer.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Actor identity", "Role logged", "Department", "Timestamp", "Target record", "Action type"].map((tag) => (
                <span key={tag} className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs text-blue-700 font-medium">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────── PRIORITY TRIAGE ──────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="reveal-left">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Priority System</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Critical patients never get buried in the queue</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Every patient visit is tagged with a priority level at registration. That priority propagates to every task in every department — lab, radiology, and MD queues all surface EMERGENCY and URGENT cases at the top, automatically.
            </p>
          </div>
          <div className="reveal-right grid grid-cols-3 gap-3">
            {[
              { level: "ROUTINE", color: "bg-slate-50 border-slate-200 text-slate-700", dot: "bg-slate-400", desc: "Standard clinical workload. Processed in order." },
              { level: "URGENT", color: "bg-amber-50 border-amber-200 text-amber-800", dot: "bg-amber-400", desc: "Elevated priority. Surfaces above routine tasks." },
              { level: "EMERGENCY", color: "bg-red-50 border-red-200 text-red-700", dot: "bg-red-500", desc: "Immediate attention required. Top of every queue." },
            ].map((p) => (
              <div key={p.level} className={`lift rounded-xl border p-4 ${p.color}`}>
                <div className={`h-3 w-3 rounded-full mb-3 pulse-dot ${p.dot}`} />
                <p className="text-xs font-bold mb-2">{p.level}</p>
                <p className="text-[11px] leading-relaxed opacity-80">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────── ORGANISATION SETTINGS ──────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center reveal">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Organisation Settings</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Your lab, your brand</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">Upload your logo, configure your letterhead, manage contact info, and customise org-level settings from a single admin panel.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Organisation Logo", text: "Uploaded via Cloudinary and displayed across all staff dashboards, report headers, and the org profile." },
            { title: "Letterhead Upload", text: "Upload a custom letterhead image. It's embedded in every released PDF report for a fully branded patient-facing document." },
            { title: "Contact Info & Address", text: "Org name, email, phone, and address are captured and surfaced on reports and patient receipts." },
          ].map((f, i) => (
            <div key={f.title} className={`reveal d${i + 1} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="mb-3 h-1 w-8 rounded-full bg-blue-600" />
              <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── FAQ ──────────────────────────── */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 reveal">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">FAQ</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Frequently asked questions</h2>
          <p className="mt-2 text-sm text-slate-400">Quick answers for teams moving from paper or spreadsheet workflows.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {faqs.map((faq, i) => (
            <div key={faq.q} className={`reveal d${Math.min((i % 4) + 1, 4)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <p className="text-sm font-semibold text-slate-800">{faq.q}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grad-divider mx-6" />

      {/* ──────────────────────────── CTA ──────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="reveal rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-10 py-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 pulse-dot" />
            Ready to get started
          </span>
          <h2 className="text-2xl font-bold text-slate-900 max-w-xl mx-auto leading-tight">
            Digitise your entire diagnostic workflow in one afternoon.
          </h2>
          <p className="mt-4 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Register your organisation, invite your staff, configure your test catalog, and start routing patients the same day. No installation. No training week. Just a working lab system.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {isLoggedIn ? (
              <Link href={dashboardPath} className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/register" className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">
                  Register Your Lab
                </Link>
                <Link href="/login" className="rounded-lg border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  Sign In
                </Link>
              </>
            )}
          </div>
          <p className="mt-5 text-xs text-slate-400">All 6 role dashboards · 13 order statuses · 16 notification types · Branded PDF reports</p>
        </div>
      </section>

      {/* ──────────────────────────── FOOTER ──────────────────────────── */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid gap-8 sm:grid-cols-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Image src="/diagsync-logo.png" alt="Diagsync" width={24} height={24} className="h-6 w-6 rounded object-cover" />
                <span className="text-sm font-semibold text-slate-700">Diagsync</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">Diagnostic Workflow Operating System. Built for multi-role labs.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-3">Platform</p>
              <div className="space-y-2">
                {["Features", "Workflow", "Role Dashboards", "Reports"].map((l) => (
                  <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '-')}`} className="block text-xs text-slate-400 hover:text-slate-600 transition-colors">{l}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-3">Departments</p>
              <div className="space-y-2">
                {["Reception", "Laboratory", "Radiology", "Medical Review", "HR & Operations"].map((d) => (
                  <p key={d} className="text-xs text-slate-400">{d}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-3">Account</p>
              <div className="space-y-2">
                {isLoggedIn ? (
                  <Link href={dashboardPath} className="block text-xs text-slate-400 hover:text-slate-600 transition-colors">Dashboard</Link>
                ) : (
                  <>
                    <Link href="/login" className="block text-xs text-slate-400 hover:text-slate-600 transition-colors">Sign In</Link>
                    <Link href="/register" className="block text-xs text-slate-400 hover:text-slate-600 transition-colors">Register Lab</Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6 flex items-center justify-between">
            <p className="text-xs text-slate-400">Diagsync · Diagnostic Workflow OS</p>
            <p className="text-xs text-slate-400">All rights reserved</p>
          </div>
        </div>
      </footer>
    </main>
  );
}