import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/utils";
import { Role } from "@prisma/client";

// ─────────────────────────────── DATA ────────────────────────────────

const workflow = [
  { step: "Patient Registered", owner: "Receptionist", desc: "Full demographics, DOB, referring doctor, clinical notes. Test cart built from catalog, discounts applied, payment logged. Priority assigned: ROUTINE, URGENT, or EMERGENCY." },
  { step: "Tests Auto-Routed", owner: "System", desc: "Orders grouped by department. Least-loaded AVAILABLE staff selected per department. Task created, test orders updated to ASSIGNED, task notification sent immediately." },
  { step: "Sample Collected", owner: "Lab Scientist", desc: "Sample tracked through PENDING → COLLECTED → RECEIVED → PROCESSING → DONE with timestamps at each stage." },
  { step: "Result Drafted", owner: "Lab / Radiographer", desc: "Structured result entry with AI insight box, normal-range flagging per field, custom field additions, offline draft autosave." },
  { step: "Submitted for MD Review", owner: "Lab / Radiographer", desc: "Result moves to MD queue. MD and HRM/Ops notified simultaneously. Full data snapshot preserved as an active version." },
  { step: "MD Reviews", owner: "Medical Doctor", desc: "Doctor approves, requests edits with highlighted correction fields and a reason, or rejects with mandatory reason. Guard rails prevent re-approving already-approved results." },
  { step: "Resubmission Cycle", owner: "Lab Scientist", desc: "Edit-requested result corrected and resubmitted. MD reviews again. Every correction creates a new version chained to the previous one." },
  { step: "Report Generated & Edited", owner: "MD / HRM", desc: "Branded PDF draft rendered with org letterhead, prescription field, comments, and all result data. MD can edit content, comments, prescription with version tracking." },
  { step: "Report Released & Dispatched", owner: "HRM / Operations", desc: "HRM releases the approved report. Dispatch via print (with/without letterhead toggle), PNG download via html2canvas, or WhatsApp via Web Share API. Every dispatch action logged." },
];

const orderStatuses = [
  { label: "Registered", color: "bg-slate-100 text-slate-600" },
  { label: "Assigned", color: "bg-blue-50 text-blue-700" },
  { label: "Opened", color: "bg-blue-100 text-blue-800" },
  { label: "Sample Pending", color: "bg-yellow-50 text-yellow-700" },
  { label: "Sample Collected", color: "bg-amber-50 text-amber-700" },
  { label: "In Progress", color: "bg-orange-50 text-orange-700" },
  { label: "Result Drafted", color: "bg-purple-50 text-purple-700" },
  { label: "Submitted for Review", color: "bg-indigo-50 text-indigo-700" },
  { label: "Edit Requested", color: "bg-red-50 text-red-600" },
  { label: "Resubmitted", color: "bg-violet-50 text-violet-700" },
  { label: "Approved", color: "bg-teal-50 text-teal-700" },
  { label: "Released", color: "bg-green-50 text-green-700" },
  { label: "Cancelled", color: "bg-rose-50 text-rose-600" },
];

const roles = [
  {
    name: "Receptionist",
    dept: "RECEPTION",
    pill: "bg-blue-50 text-blue-700",
    points: [
      "Register patients with demographics, DOB, referring doctor, and clinical notes",
      "Build test cart from catalog with live price calculation and discounts",
      "Log payments — PAID, PARTIAL, PENDING, WAIVED — with ledger entries per payment",
      "Assign ROUTINE, URGENT, or EMERGENCY priority at registration",
      "Manage visit statuses: ACTIVE, COMPLETED, CANCELLED, NO_SHOW with reasons",
      "14-day rolling daily patient table with per-day revenue summaries",
      "Offline registration queue — syncs automatically when back online",
      "Dispatch released reports: print, download PNG, or send via WhatsApp",
      "Manage consultation walk-in queue entries",
    ],
  },
  {
    name: "Lab Scientist",
    dept: "LABORATORY",
    pill: "bg-amber-50 text-amber-700",
    points: [
      "Priority-sorted task queue — EMERGENCY always surfaces first",
      "Track sample: PENDING → COLLECTED → RECEIVED → PROCESSING → DONE",
      "AI insight box analyses entered values and surfaces condition flags in real time",
      "Normal-range HIGH / LOW badges per numeric field as values are typed",
      "Add custom fields ad hoc without modifying the test template",
      "Remove or restore default template fields per individual result",
      "Save digital signature image + name as a reusable preset (up to 20)",
      "Offline draft mode — results persisted locally, auto-synced on reconnect",
      "Receive and action MD edit requests with highlighted correction fields",
    ],
  },
  {
    name: "Radiographer",
    dept: "RADIOLOGY",
    pill: "bg-purple-50 text-purple-700",
    points: [
      "Priority-sorted imaging task queue",
      "Upload multiple imaging files via secure signed Cloudinary upload",
      "Record findings, impressions, and supplementary notes",
      "Compose and submit radiology report draft to MD review",
      "Handle edit requests from MD with version-tracked corrections",
      "Full submission and resubmission workflow with version chain",
    ],
  },
  {
    name: "Medical Doctor",
    dept: "MEDICAL_REVIEW",
    pill: "bg-teal-50 text-teal-700",
    points: [
      "Review queue of submitted lab and radiology results",
      "Approve with one action — triggers report draft generation",
      "Request edits with structured reason and optionally highlighted fields",
      "Reject results with mandatory rejection reason",
      "Edit report content, comments, and prescription in the report workspace",
      "View full parent-child version history for every edit and resubmission",
      "Guard rails prevent re-approving already-approved results",
    ],
  },
  {
    name: "HRM / Operations",
    dept: "HR_OPERATIONS",
    pill: "bg-indigo-50 text-indigo-700",
    points: [
      "Live workflow monitoring dashboard across all departments",
      "Release center — release approved reports for dispatch",
      "Print, download PNG, or WhatsApp reports with letterhead toggle",
      "Full immutable audit log with actor, role, action, entity, and IP address",
      "30-day revenue intelligence: ordered vs billed vs collected",
      "Unbilled and uncollected leakage detection",
      "Profit-by-test-line breakdown with gross margin %",
      "14-day daily profit chart and no-show/cancellation trend forecast",
      "Automatic delayed-task notifications when turnaround targets are exceeded",
    ],
  },
  {
    name: "Super Admin",
    dept: "ALL DEPTS",
    pill: "bg-slate-100 text-slate-700",
    points: [
      "Full access across all role dashboards",
      "Create, activate, deactivate, or suspend staff accounts",
      "Assign roles, departments, shifts (MORNING/AFTERNOON/NIGHT/FULL_DAY), and availability",
      "Build and manage the diagnostic test catalog with codes and categories",
      "Configure custom result fields per test: type, units, normal ranges, options",
      "Manage test categories: Haematology, Chemistry, Microbiology, Urinalysis, Imaging, Serology",
      "Upload org logo and letterhead for all PDF reports",
      "Set cost price per test to power HRM revenue intelligence",
    ],
  },
];

const aiFeatures = [
  {
    title: "Real-Time Result Insight Box",
    badge: "AI",
    badgeColor: "bg-blue-600",
    desc: "As a lab scientist fills in result fields, `buildResultInsights()` analyses the current values and surfaces a live insight panel inside the result card — showing condition-relevant messages before the result is submitted. This runs entirely client-side with zero API latency.",
  },
  {
    title: "Field-Level Normal-Range Flagging",
    badge: "AI",
    badgeColor: "bg-blue-600",
    desc: "`evaluateReferenceFlag()` checks every numeric field against its configured normalMin and normalMax the moment a value is entered. HIGH or LOW badges appear at the field level instantly. Dropdown fields are validated against normalText. `formatReferenceDisplay()` shows the range inline.",
  },
  {
    title: "Patient History Trend Detection",
    badge: "INSIGHTS",
    badgeColor: "bg-purple-600",
    desc: "`analyzePatientInsights()` scans a patient's full result history to detect repeated testing patterns, frequent monthly testing (3+ times), first-visit flags, and directional trends in Hemoglobin, Glucose, and WBC values across historical records.",
  },
  {
    title: "No-Show & Cancellation Forecasting",
    badge: "FORECAST",
    badgeColor: "bg-teal-600",
    desc: "Computes rolling 7-day no-show/cancellation rates, compares last 7 days vs prior 7 days to get trend direction (up/down/flat), and predicts next week's no-shows using average daily registrations × rate. Confidence level: high (150+ visits), medium (60+), low (<60).",
  },
  {
    title: "Revenue Leakage Detection",
    badge: "ANALYTICS",
    badgeColor: "bg-amber-600",
    desc: "Tracks ordered value (default prices), billed value (actual prices), and collected value (payment ledger) over 30 days. Unbilled leakage = ordered minus billed. Uncollected leakage = billed minus collected. Completion leakage rate = % of orders not yet completed.",
  },
  {
    title: "Delayed Task Auto-Notification",
    badge: "OPS",
    badgeColor: "bg-red-600",
    desc: "`isTaskDelayed()` compares each active routing task's creation time against the maximum turnaround target of its tests. Overdue tasks fire TASK_DELAYED notifications to all HRM and Super Admin users via a single batched insert — with deduplication to prevent repeat alerts per task.",
  },
];

const testCategories = [
  { name: "Haematology", examples: "FBC, ESR, MCHC, Peripheral Blood Film, HbA1c, Reticulocyte Count, Sickling Test, Genotype, Blood Group, HB Electrophoresis, Cross Matching, Coombs Tests…" },
  { name: "Clinical Chemistry", examples: "LFT, RFT, Lipid Profile, CMP, Electrolytes, Uric Acid, Glucose, HbA1c, Creatinine, Urea, Albumin, Bilirubin, ALT, AST, ALP, Amylase, CK, CK-MB, Troponin T & I, NT-proBNP, CRP, Procalcitonin…" },
  { name: "Microbiology", examples: "Culture & Sensitivity, Malaria RDT, WIDAL Test, VDRL, GeneXpert, AFB, Swab M/C/S, Stool M/C/S, Blood Culture, H. pylori Ag, Cryptococcal Ag…" },
  { name: "Urinalysis", examples: "Urinalysis, Urine M/C/S, Microalbumin, ACR, HCG Urine, Urine Protein Electrophoresis…" },
  { name: "Serology / Immunology", examples: "HIV I & II, HBsAg, HBV 5 Panel, HBV DNA, HCV Ab, CD4/CD8 Count & %, Troponin, PSA, Free PSA, AFP, CEA, CA-125, Vitamin B12 & D, Ferritin, Testosterone, FSH, LH, Prolactin, DHEA-S, Cortisol, ANA, dsDNA…" },
  { name: "Imaging & Radiology", examples: "Chest X-Ray, Abdominal USS, Pelvic USS, Obstetric USS, CT Scan, MRI, Mammography, Thyroid USS, Echocardiography, Bone Scan…" },
];

const consultationStatuses = [
  { status: "WAITING", color: "bg-slate-100 text-slate-600", desc: "Patient in queue, awaiting call" },
  { status: "CALLED", color: "bg-blue-50 text-blue-700", desc: "Doctor called patient — calledAt and calledById logged" },
  { status: "CONSULTED", color: "bg-green-50 text-green-700", desc: "Consultation complete — consultedAt and consultedById logged" },
  { status: "CANCELLED", color: "bg-red-50 text-red-600", desc: "Queue entry cancelled before consultation" },
];

const reportFeatures = [
  { title: "Branded PDF with Letterhead", desc: "Upload your org's letterhead once. Every released report is rendered with it. A toggle in the print dialog lets staff switch between 'with' and 'without' letterhead." },
  { title: "PNG Download via html2canvas", desc: "Reports are captured as high-resolution PNG images using html2canvas at 2× scale. The filename is auto-generated from patient name + visit number + report type." },
  { title: "WhatsApp Dispatch", desc: "Report PNG captured and shared via navigator.share() with the file. Falls back to a wa.me link if the Web Share API is unavailable. Every send attempt — success or fail — is logged." },
  { title: "Prescription Field", desc: "Each report has an optional prescription field filled by the MD during review. It's tracked across version edits and appears prominently on the released report." },
  { title: "Version Chain with Parent Link", desc: "Every edit creates a new version record with a `parentId` pointing to the previous version. A full version tree is visible in the report workspace for both MD and HRM." },
  { title: "Public Share Token", desc: "Each diagnostic report has a unique `publicShareToken` — a one-time-generated UUID for patient-facing report access without authentication." },
];

const offlineFeatures = [
  { title: "Offline Patient Registration Queue", desc: "Full patient registration payloads (demographics, tests, payment, priority) are saved to localStorage. When the device reconnects, they sync to the server sequentially." },
  { title: "Offline Lab Draft Saves", desc: "Result drafts are persisted per task in localStorage as the scientist types. If connectivity drops, no data is lost. Upserts are keyed by taskId so only the latest draft is kept." },
  { title: "Online / Offline Banner", desc: "The lab task board listens to `navigator.onLine` events. When online status is restored, `syncOfflineDrafts()` runs automatically, submitting all pending drafts to the server." },
];

const signatureFeatures = [
  { title: "Signature Upload at Sign-Off", desc: "Lab scientists upload a signature image at result sign-off. The image is stored as a base64 data URL and embedded in the lab result data, then rendered on the PDF." },
  { title: "Saved Signature Presets", desc: "Signatures are saved as presets in localStorage keyed by scope ('reporting'). Up to 20 presets per user. `normalizePresetList()` deduplicates exact matches and drops typing fragment entries automatically." },
  { title: "Per-Task Sign-Off State", desc: "Each task maintains its own sign-off state: `signatureName` and `signatureImage`. Selecting a preset populates both fields. The sign-off is restored from saved result data on page reload." },
];

const hrmAnalytics = [
  { metric: "Ordered Value", desc: "Total default price of all tests ordered in 30-day window" },
  { metric: "Billed Value", desc: "Actual price charged after all overrides and discounts" },
  { metric: "Collected Value", desc: "Cash received from payment ledger (refunds deducted)" },
  { metric: "Unbilled Leakage", desc: "Ordered value minus billed — tests delivered below list price" },
  { metric: "Uncollected Leakage", desc: "Billed value minus collected — outstanding balances" },
  { metric: "Gross Margin %", desc: "Revenue minus cost price across top 12 test lines" },
  { metric: "Completion Leakage Rate", desc: "% of ordered tests not yet completed (pending payment realisation)" },
  { metric: "No-Show Forecast", desc: "Predicted no-shows next 7 days with trend direction and confidence level" },
];

const notificationEvents = [
  "Task Assigned", "Result Submitted", "Result Approved", "Result Rejected",
  "Result Edited", "Report Draft Updated", "Report Ready for Review",
  "Report Released", "Report Sent", "Report Printed", "Report Downloaded",
  "Report Send Failed", "Task Delayed", "Task Reassigned", "Task Overridden", "System Alert",
];

const proofStats = [
  { value: "13", label: "Order Statuses" },
  { value: "6", label: "Role Dashboards" },
  { value: "16", label: "Notification Types" },
  { value: "6", label: "Test Categories" },
  { value: "4", label: "Payment States" },
  { value: "3", label: "Priority Levels" },
  { value: "4", label: "Visit Statuses" },
  { value: "5", label: "Result Field Types" },
];

const faqs = [
  { q: "How does auto-routing decide who gets a task?", a: "The routing engine queries all ACTIVE + AVAILABLE staff in the relevant department, counts each person's workload (test orders in ASSIGNED through RESUBMITTED states), and assigns to the lowest-count staff. Ties broken alphabetically." },
  { q: "Can an MD send a result back for corrections?", a: "Yes. The MD sends an edit request with a reason and optionally highlighted fields. The scientist makes corrections and resubmits. Every correction creates a new version chained via parentId. The MD reviews again from the resubmitted state." },
  { q: "What happens if the lab scientist loses internet mid-entry?", a: "Result drafts are saved to localStorage per task as the scientist types. If connectivity drops, data is preserved. When the device comes back online, `syncOfflineDrafts()` runs automatically and submits all pending drafts." },
  { q: "Does the AI flag abnormal results automatically?", a: "Yes. `evaluateReferenceFlag()` checks every numeric field against normalMin/normalMax as values are entered — showing HIGH/LOW badges at the field level instantly. `buildResultInsights()` also surfaces a condition insight panel above the fields." },
  { q: "What is the Consultation Queue and how does it differ from the diagnostic workflow?", a: "The consultation queue is a completely separate module for outpatient walk-in patients. No test orders are required. Receptionist adds a patient to WAITING; the doctor calls (CALLED), acknowledges, and marks CONSULTED. Each action is timestamped and attributed to the staff member." },
  { q: "Can we send reports via WhatsApp?", a: "Yes. The report is captured as a PNG using html2canvas and shared via navigator.share(). If the device supports file sharing, it opens the WhatsApp sheet. Otherwise it falls back to a wa.me link. Both success and failure are logged as report action events." },
  { q: "How does the system track profit per test?", a: "Each test has a sell price and a cost price. HRM's revenue intelligence computes revenue, cost, and profit per test line across all orders in 30 days. The top 12 most profitable test lines are ranked and shown in the analytics dashboard." },
  { q: "Can staff save and reuse their digital signature?", a: "Yes. Scientists upload a signature image and save it as a named preset. Up to 20 presets stored in localStorage, deduplicated by name + image. On any future task, they select from the preset library instead of re-uploading." },
  { q: "What does the public share token on reports do?", a: "Each diagnostic report has a unique publicShareToken generated on creation. It enables a patient-facing report URL without authentication — useful for sending a direct link or integrating with external portals." },
  { q: "How are delayed tasks handled?", a: "`isTaskDelayed()` compares each active routing task's creation time against the maximum turnaround target of its test orders. If overdue, a deduplicated TASK_DELAYED notification is batch-inserted for all HRM and Super Admin users." },
];

// ─────────────────────────────── PAGE ────────────────────────────────

export default async function HomePage() {
  const session = await auth();
  const role = (session?.user as any)?.role as Role | undefined;
  const dashboardPath = role ? getDashboardPath(role) : "/dashboard";
  const isLoggedIn = Boolean(session?.user);

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <style dangerouslySetInnerHTML={{ __html: `
        .rv{opacity:0;transform:translateY(22px);transition:opacity .65s cubic-bezier(.22,1,.36,1),transform .65s cubic-bezier(.22,1,.36,1)}
        .rv.in{opacity:1;transform:translateY(0)}
        .rl{opacity:0;transform:translateX(-26px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}
        .rl.in{opacity:1;transform:translateX(0)}
        .rr{opacity:0;transform:translateX(26px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}
        .rr.in{opacity:1;transform:translateX(0)}
        .d1{transition-delay:55ms}.d2{transition-delay:115ms}.d3{transition-delay:175ms}
        .d4{transition-delay:235ms}.d5{transition-delay:295ms}.d6{transition-delay:355ms}
        .d7{transition-delay:415ms}.d8{transition-delay:475ms}
        .lift{transition:transform 230ms cubic-bezier(.34,1.56,.64,1),box-shadow 230ms ease}
        .lift:hover{transform:translateY(-4px);box-shadow:0 14px 36px rgba(15,23,42,.09)}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.72)}}
        .pulse{animation:pulse 2.1s ease-in-out infinite}
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .float{animation:floatY 4.8s ease-in-out infinite}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .ticker-inner{animation:ticker 30s linear infinite}
        .ticker-wrap:hover .ticker-inner{animation-play-state:paused}
        @keyframes chipPop{from{opacity:0;transform:scale(.78)}to{opacity:1;transform:scale(1)}}
        .chip-pop{animation:chipPop .38s cubic-bezier(.34,1.56,.64,1) both}
        @keyframes notifSlide{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        .notif-slide{animation:notifSlide .5s cubic-bezier(.22,1,.36,1) both}
        .gdiv{height:1px;background:linear-gradient(90deg,transparent,#e2e8f0 20%,#bfdbfe 50%,#e2e8f0 80%,transparent)}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.3)}50%{box-shadow:0 0 0 6px rgba(37,99,235,0)}}
        .ai-glow{animation:glowPulse 2.5s ease-in-out infinite}
      ` }} />

      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('DOMContentLoaded',function(){
          var els=document.querySelectorAll('.rv,.rl,.rr');
          var obs=new IntersectionObserver(function(entries){
            entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');obs.unobserve(e.target);}});
          },{threshold:0.1});
          els.forEach(function(el){obs.observe(el);});
        });
      ` }} />

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/92 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <Image src="/diagsync-logo.png" alt="Diagsync" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-none">Diagsync</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Diagnostic Workflow OS</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-5 text-xs text-slate-500">
            {["features","workflow","ai","roles","reports","faq"].map((s) => (
              <a key={s} href={`#${s}`} className="hover:text-slate-800 transition-colors capitalize">{s}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Link href={dashboardPath} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="rounded border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Sign In</Link>
                <Link href="/register" className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Register Lab</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-blue-50 opacity-50" />
          <div className="absolute bottom-0 -left-24 h-[360px] w-[360px] rounded-full bg-slate-50 opacity-70" />
        </div>
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="rv">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 pulse" />
              AI-powered · Multi-role · Offline-ready
            </span>
            <h1 className="text-4xl font-bold leading-[1.13] text-slate-900 sm:text-5xl">
              From front desk<br/>
              <span className="text-blue-600">to signed report</span><br/>
              in one system.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-500 max-w-lg">
              Diagsync is a complete diagnostic lab operating system — covering patient registration,
              intelligent routing, AI result flagging, consultation queues, MD approval cycles,
              revenue intelligence, and branded PDF dispatch with WhatsApp support.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isLoggedIn ? (
                <Link href={dashboardPath} className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">Go to Dashboard</Link>
              ) : (
                <>
                  <Link href="/register" className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">Set Up Your Lab</Link>
                  <Link href="/login" className="rounded-lg border border-slate-200 px-7 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Sign In</Link>
                </>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-400">6 role dashboards · AI insights · Consultation queue · Offline sync · WhatsApp dispatch</p>
          </div>

          {/* Hero live order card */}
          <div className="rr float">
            <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400 pulse" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Live Order · #ORD-3019</p>
                </div>
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-600">EMERGENCY</span>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Chukwuemeka Obi</p>
                    <p className="text-xs text-slate-400 mt-0.5">M · 52 yrs · Ref: Dr. Amaka Eze</p>
                  </div>
                  <span className="rounded bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">IN PROGRESS</span>
                </div>
                {/* AI insight box */}
                <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-blue-700 mb-1">AI Result Insight</p>
                  <p className="text-[11px] text-blue-600 leading-relaxed">Troponin I above normal range — possible cardiac injury. Haemoglobin trending downward across 3 visits. Repeated FBC testing (4× this month).</p>
                </div>
                <div className="space-y-2">
                  {[
                    { test: "Troponin I", dept: "LAB", status: "Result Drafted", color: "bg-purple-50 text-purple-700", flag: "HIGH" },
                    { test: "Full Blood Count", dept: "LAB", status: "Submitted", color: "bg-indigo-50 text-indigo-700", flag: null },
                    { test: "Chest X-Ray", dept: "RADIOLOGY", status: "Approved", color: "bg-teal-50 text-teal-700", flag: null },
                  ].map((item) => (
                    <div key={item.test} className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-slate-700">{item.test}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.dept}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.flag && <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.flag}</span>}
                        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${item.color}`}>{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-4 gap-2 text-center">
                  {[
                    { l: "Total", v: "₦32,000", c: "text-slate-800" },
                    { l: "Paid", v: "₦20,000", c: "text-green-600" },
                    { l: "Balance", v: "₦12,000", c: "text-amber-600" },
                    { l: "Status", v: "PARTIAL", c: "text-amber-700" },
                  ].map((b) => (
                    <div key={b.l}>
                      <p className="text-[10px] text-slate-400">{b.l}</p>
                      <p className={`text-xs font-bold mt-0.5 ${b.c}`}>{b.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NOTIFICATION TICKER ── */}
      <div className="border-y border-slate-100 bg-slate-50 py-2.5 overflow-hidden ticker-wrap">
        <div className="ticker-inner flex gap-8 whitespace-nowrap" style={{ width: "max-content" }}>
          {[...notificationEvents, ...notificationEvents].map((evt, i) => (
            <span key={i} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-1 w-1 rounded-full bg-blue-400" />
              {evt}
            </span>
          ))}
        </div>
      </div>

      {/* ── PROOF STATS ── */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {proofStats.map((s, i) => (
            <div key={s.label} className={`rv d${Math.min(i+1,8)} lift rounded-xl border border-slate-200 bg-white p-4 text-center`}>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── FEATURES ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 rv">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Complete Feature Set</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Every system your lab needs — built in, not bolted on</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">No spreadsheets. No verbal handoffs. No paper trails. Every workflow digitised and audited.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Intelligent Auto-Routing Engine", desc: "Patient registration triggers instant task creation per department. The least-loaded AVAILABLE staff member is selected algorithmically — considering real-time active workload counts across 8 order statuses." },
            { title: "AI Result Condition Detection", desc: "buildResultInsights() analyses entered values client-side and surfaces condition-relevant messages live. evaluateReferenceFlag() fires HIGH/LOW badges per numeric field the moment a value is typed." },
            { title: "Consultation Queue System", desc: "A standalone outpatient module separate from the diagnostic workflow. Tracks walk-in patients from WAITING through CALLED, CONSULTED, and CANCELLED with timestamps and full staff attribution." },
            { title: "Version Chain for All Edits", desc: "Every edit to a lab result, radiology report, or diagnostic report creates a new version in a parent-child chain (parentId). Active version is flagged. All previous versions are preserved and browsable." },
            { title: "Offline Draft Sync", desc: "Patient registrations and lab result drafts saved to localStorage survive connectivity loss. Auto-synced sequentially when the device comes back online — no user action required." },
            { title: "Digital Signature Presets", desc: "Lab scientists save signature images as named presets (up to 20). Normalised, deduplicated, and stored in localStorage. Sign-off is embedded in the result data and rendered on the PDF." },
            { title: "WhatsApp Report Dispatch", desc: "Reports captured as PNG via html2canvas at 2× scale and shared via navigator.share(). Falls back to a wa.me link if the Web Share API is unavailable. Every dispatch attempt logged." },
            { title: "Revenue Intelligence & Leakage", desc: "30-day rolling financials: ordered vs billed vs collected, unbilled leakage, uncollected leakage, completion leakage rate, gross margin %, profit by test line, 14-day daily chart." },
            { title: "No-Show Forecasting", desc: "Computes last-7-day vs prior-7-day no-show rates, trend direction, and predicts next week's no-shows. Confidence level: high (150+ visits), medium (60+), or low." },
            { title: "Price Override Tracking", desc: "Every test price override is attributed to the authorising staff member with a mandatory reason. The default price is preserved alongside the override for leakage tracking." },
            { title: "Delayed Task Notifications", desc: "isTaskDelayed() fires TASK_DELAYED notifications to HRM and Super Admin when any routing task exceeds its turnaround target. Batched and deduplicated to prevent alert spam." },
            { title: "Public Report Share Token", desc: "Each diagnostic report gets a unique public UUID token on creation — enabling patient-facing report access via a shareable URL without requiring authentication." },
          ].map((f, i) => (
            <div key={f.title} className={`rv d${Math.min((i%4)+1,4)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="mb-3 h-1 w-10 rounded-full bg-blue-600" />
              <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── AI FEATURES ── */}
      <section id="ai" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 rv">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Intelligence Layer</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">AI systems woven into the clinical workflow</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">Not external integrations. Core functions running in result entry, patient history, and operational monitoring.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {aiFeatures.map((f, i) => (
            <div key={f.title} className={`rv d${Math.min((i%3)+1,3)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="flex items-center justify-between mb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <div className="h-3 w-3 rounded-sm bg-blue-600" />
                </div>
                <span className={`ai-glow rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white ${f.badgeColor}`}>{f.badge}</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">{f.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* AI demo */}
        <div className="mt-8 rv rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Live result entry — AI flagging as values are typed</p>
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            {[
              { label: "Troponin I (ng/L)", value: "68.4", range: "Normal: 0–45", flag: "HIGH", bg: "border-red-200 bg-red-50" },
              { label: "Haemoglobin (g/dL)", value: "10.2", range: "Normal: 13.5–17.5", flag: "LOW", bg: "border-red-200 bg-red-50" },
              { label: "Glucose (mmol/L)", value: "5.1", range: "Normal: 3.9–5.6", flag: "NORMAL", bg: "border-green-200 bg-green-50" },
            ].map((f) => (
              <div key={f.label} className={`rounded-lg border p-3 ${f.bg}`}>
                <p className="text-[11px] font-medium text-slate-600 mb-1">{f.label}</p>
                <p className="text-lg font-bold text-slate-800">{f.value}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-slate-400">{f.range}</p>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${f.flag === "NORMAL" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{f.flag}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-blue-700 mb-0.5">AI Insight — buildResultInsights()</p>
            <p className="text-[11px] text-blue-600 leading-relaxed">Elevated Troponin I — possible acute myocardial injury, consider ECG and cardiology referral. Low Haemoglobin — anaemia workup recommended. Glucose within normal range.</p>
          </div>
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── WORKFLOW ── */}
      <section id="workflow" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 rv">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">End-to-End Workflow</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">9 stages. Every one owned, tracked, and logged.</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">Every stage has a clear owner, a timestamp, and an audit log entry. Nothing moves without being recorded.</p>
        </div>
        <div className="relative">
          <div className="absolute left-[22px] top-6 bottom-6 w-px bg-slate-200 hidden sm:block" />
          <div className="space-y-3">
            {workflow.map((item, idx) => (
              <div key={item.step} className={`rv d${Math.min((idx%5)+1,5)} lift flex items-start gap-5 rounded-xl border border-slate-200 bg-white p-5`}>
                <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold z-10">{idx + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-slate-800">{item.step}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">{item.owner}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 rv">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">All 13 order states in the state machine</p>
          <div className="flex flex-wrap gap-2">
            {orderStatuses.map((s, i) => (
              <span key={s.label} className={`chip-pop rounded-full px-3 py-1 text-xs font-semibold ${s.color}`} style={{ animationDelay: `${i * 55}ms` }}>{s.label}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── CONSULTATION QUEUE ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="rl">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Consultation Queue</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Outpatient walk-in management — completely separate from diagnostics</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              The consultation queue module manages walk-in outpatient visits independently of the diagnostic workflow. No test orders are needed. Receptionists add patients to the waiting list with name, age, contact, and a vitals note. The arrival time is recorded automatically.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Doctors pick up patients from the WAITING queue, call them, and record the consultation. Every action — who called, who acknowledged, who consulted — is attributed to the individual staff member with a precise timestamp.
            </p>
            <div className="mt-6 space-y-2">
              {consultationStatuses.map((s) => (
                <div key={s.status} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 lift">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold flex-shrink-0 ${s.color}`}>{s.status}</span>
                  <p className="text-xs text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rr">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Consultation Queue — Live</p>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { name: "Ngozi Adeyemi", age: 34, vitals: "BP: 140/90, Temp: 37.2°C", status: "WAITING", statusC: "bg-slate-100 text-slate-600", time: "09:15" },
                  { name: "Tunde Balogun", age: 58, vitals: "Fasting glucose: 11.2 mmol/L", status: "CALLED", statusC: "bg-blue-50 text-blue-700", time: "09:08" },
                  { name: "Aisha Mohammed", age: 27, vitals: "Complains of chest pain", status: "CONSULTED", statusC: "bg-green-50 text-green-700", time: "08:50" },
                ].map((p) => (
                  <div key={p.name} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-800">{p.name} · {p.age}yrs</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.statusC}`}>{p.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{p.vitals}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">Arrived: {p.time}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Staff attribution fields", items: ["createdById", "calledById", "acknowledgedById", "consultedById"] },
                { label: "Timestamp fields logged", items: ["arrivalAt", "calledAt", "acknowledgedAt", "consultedAt"] },
              ].map((g) => (
                <div key={g.label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{g.label}</p>
                  {g.items.map((item) => (
                    <p key={item} className="text-[11px] font-mono text-slate-600 mt-1">{item}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── ROLES ── */}
      <section id="roles" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 rv">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Role Dashboards</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Six purpose-built dashboards. Every capability where it belongs.</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">Each role dashboard is route-guarded at the middleware level. No cross-department data bleeds through.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r, i) => (
            <div key={r.name} className={`rv d${Math.min((i%3)+1,3)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-800">{r.name}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${r.pill}`}>{r.dept}</span>
              </div>
              <ul className="space-y-1.5">
                {r.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="mt-1.5 flex-shrink-0 h-1 w-1 rounded-full bg-blue-500" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── TEST CATALOG ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div className="rl">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Test Catalog</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">100+ pre-seeded tests across 6 categories</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Every test has a code, category, type, department, sell price, cost price, turnaround target, sample type, and a fully configured result template — seeded with accurate normal ranges and units so reporting starts immediately.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Super Admin can add new tests, edit fields, set cost prices, and configure all metadata from the admin panel. The catalog is per-organisation — unique codes enforced per org.
            </p>
            <div className="mt-6 space-y-2">
              {testCategories.map((c, i) => (
                <div key={c.name} className={`rv d${i+1} rounded-lg border border-slate-200 bg-white px-4 py-3 lift`}>
                  <p className="text-xs font-semibold text-slate-700">{c.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{c.examples}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rr">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Custom Result Field Types</p>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {[
                    { type: "NUMBER", desc: "Numeric with units, normalMin, normalMax, AI range flagging" },
                    { type: "TEXT", desc: "Short single-line finding or identifier field" },
                    { type: "TEXTAREA", desc: "Multi-line impression, narrative, or comments" },
                    { type: "DROPDOWN", desc: "Option list — Reactive/Non-Reactive, AA/AS/SS, A/B/AB/O etc." },
                    { type: "CHECKBOX", desc: "Boolean positive/negative or present/absent field" },
                  ].map((f) => (
                    <tr key={f.type} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap w-32">{f.type}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Runtime field flexibility</p>
              <ul className="space-y-1.5">
                {[
                  "Add custom fields to any result at runtime without changing the test template",
                  "Remove or restore default template fields per individual result",
                  "Field sort order configured in test setup, respected at entry",
                  "normalText and referenceNote shown inline during result entry",
                  "Sensitivity fields handled separately for microbiology workflows",
                  "Cost price set per test — powers HRM gross margin analytics",
                ].map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="mt-1.5 flex-shrink-0 h-1 w-1 rounded-full bg-blue-500" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── REPORTS ── */}
      <section id="reports" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 rv">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Report Engine</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Branded reports. Multiple dispatch methods. Full version history.</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">Every report rendered with your letterhead, tracks every edit in a version chain, and can be dispatched via print, PNG download, or WhatsApp — all logged.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportFeatures.map((f, i) => (
            <div key={f.title} className={`rv d${Math.min((i%3)+1,3)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <div className="mb-3 h-1 w-10 rounded-full bg-blue-600" />
              <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 rv">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Report dispatch methods</p>
            <div className="flex flex-wrap gap-2">
              {["Print (with letterhead)", "Print (without letterhead)", "PNG Download (html2canvas 2×)", "WhatsApp (Web Share API)", "WhatsApp link fallback", "wa.me URL fallback"].map((d) => (
                <span key={d} className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{d}</span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Action events logged per report</p>
            <div className="flex flex-wrap gap-2">
              {["Released", "Printed", "Downloaded", "Sent", "Send Failed", "Draft Updated", "Ready for Review"].map((a) => (
                <span key={a} className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{a}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── OFFLINE + SIGNATURE ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="rl">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Offline Support</span>
            <h2 className="mt-2 text-xl font-bold text-slate-900 mb-4">Works without internet. Syncs the moment it returns.</h2>
            <div className="space-y-3">
              {offlineFeatures.map((f, i) => (
                <div key={f.title} className={`rv d${i+1} lift rounded-lg border border-slate-200 bg-white p-4`}>
                  <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rr">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Digital Signatures</span>
            <h2 className="mt-2 text-xl font-bold text-slate-900 mb-4">Save once. Sign any result in one click.</h2>
            <div className="space-y-3">
              {signatureFeatures.map((f, i) => (
                <div key={f.title} className={`rv d${i+1} lift rounded-lg border border-slate-200 bg-white p-4`}>
                  <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── HRM ANALYTICS ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div className="rl">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Revenue Intelligence</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">A full financial operations dashboard for HRM</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              The revenue intelligence module computes a 30-day rolling financial picture across all visits — distinguishing ordered value, billed value, and collected value, then identifying exactly where revenue is leaking.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Cost prices are configured per test so gross margin is accurate. The top 12 most profitable test lines are ranked, a 14-day daily profit chart is computed, and a no-show/cancellation forecast is generated with confidence scoring.
            </p>
          </div>
          <div className="rr">
            <div className="grid gap-2 sm:grid-cols-2">
              {hrmAnalytics.map((a, i) => (
                <div key={a.metric} className={`rv d${Math.min((i%4)+1,4)} lift rounded-xl border border-slate-200 bg-white p-4`}>
                  <p className="text-xs font-semibold text-slate-700">{a.metric}</p>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── AUDIT TRAIL ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="rl">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Audit Log — Immutable</p>
                <span className="h-2 w-2 rounded-full bg-green-400 pulse" />
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { actor: "Dr. Adewale Okafor", role: "MD", action: "Approved result", target: "FBC · #ORD-3019", time: "10:14:08", ip: "192.168.1.12" },
                  { actor: "Ngozi Eze", role: "LAB_SCIENTIST", action: "Submitted result", target: "Troponin I · #ORD-3019", time: "10:09:41", ip: "192.168.1.4" },
                  { actor: "Chidi Musa", role: "RECEPTIONIST", action: "Registered patient", target: "Chukwuemeka Obi", time: "09:52:17", ip: "192.168.1.2" },
                  { actor: "Amaka Obi", role: "RADIOGRAPHER", action: "Uploaded imaging file", target: "Chest X-Ray · #ORD-3018", time: "09:48:33", ip: "192.168.1.8" },
                  { actor: "System", role: "AUTO_ROUTE", action: "Assigned task to Ngozi Eze", target: "Lab · #ORD-3019", time: "09:52:18", ip: "—" },
                  { actor: "Dr. Adewale Okafor", role: "MD", action: "Edit requested", target: "LFT · #ORD-3016", time: "09:39:04", ip: "192.168.1.12" },
                ].map((e) => (
                  <div key={e.time + e.action} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700 truncate">{e.actor}</p>
                      <p className="text-[11px] font-mono text-slate-400 whitespace-nowrap">{e.time}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{e.role}</span>
                      <p className="text-[11px] text-slate-500">{e.action} · <span className="text-slate-400">{e.target}</span></p>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-0.5">IP: {e.ip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rr">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Audit Trail</span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Every action. Every actor. IP address included.</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Every action in Diagsync fires an audit log entry with actor ID, role, action name, entity type, entity ID, old value (JSON), new value (JSON), changes (JSON), IP address, user agent, notes, and timestamp.
            </p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Logs are indexed by actor, action type, entity type, and timestamp for fast filtered queries. They are immutable — readable but never deletable.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Actor ID", "Role", "Action", "Entity type", "Entity ID", "Old value (JSON)", "New value (JSON)", "Changes (JSON)", "IP address", "User agent", "Notes", "Timestamp"].map((tag) => (
                <span key={tag} className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs text-blue-700 font-medium">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 rv">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">FAQ</span>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Technical answers from the codebase</h2>
          <p className="mt-2 text-sm text-slate-400">Real questions about real system behaviour — answered directly from implementation.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {faqs.map((faq, i) => (
            <div key={faq.q} className={`rv d${Math.min((i%4)+1,4)} lift rounded-xl border border-slate-200 bg-white p-5`}>
              <p className="text-sm font-semibold text-slate-800">{faq.q}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="gdiv mx-6" />

      {/* ── CTA ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="rv rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-10 py-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 pulse" />
            Ready to get started
          </span>
          <h2 className="text-2xl font-bold text-slate-900 max-w-2xl mx-auto leading-tight">
            Everything your diagnostic lab needs. One platform. Live today.
          </h2>
          <p className="mt-4 text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Register your organisation, invite staff, load your test catalog, and start routing patients the same day. No installation. No training week. Just a fully working lab system.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {isLoggedIn ? (
              <Link href={dashboardPath} className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">Go to Dashboard</Link>
            ) : (
              <>
                <Link href="/register" className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">Register Your Lab</Link>
                <Link href="/login" className="rounded-lg border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Sign In</Link>
              </>
            )}
          </div>
          <p className="mt-5 text-xs text-slate-400">6 roles · AI result flagging · Consultation queue · Offline sync · WhatsApp dispatch · Revenue intelligence · Full audit trail</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid gap-8 sm:grid-cols-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Image src="/diagsync-logo.png" alt="Diagsync" width={24} height={24} className="h-6 w-6 rounded object-cover" />
                <span className="text-sm font-semibold text-slate-700">Diagsync</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">Diagnostic Workflow Operating System. AI-powered. Offline-ready. Built for multi-role labs.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-3">System Modules</p>
              <div className="space-y-1.5">
                {["Lab Workflow", "Radiology Workflow", "Consultation Queue", "Report Engine", "Revenue Intelligence", "Audit Trail", "Offline Sync"].map((l) => (
                  <p key={l} className="text-xs text-slate-400">{l}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-3">Test Categories</p>
              <div className="space-y-1.5">
                {["Haematology", "Clinical Chemistry", "Microbiology", "Urinalysis", "Serology / Immunology", "Imaging & Radiology"].map((d) => (
                  <p key={d} className="text-xs text-slate-400">{d}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-3">Account</p>
              <div className="space-y-1.5">
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
            <p className="text-xs text-slate-400">Diagsync · Diagnostic Workflow Operating System</p>
            <p className="text-xs text-slate-400">All rights reserved</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
