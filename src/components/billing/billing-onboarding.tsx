"use client";

import { useMemo, useState } from "react";
import { OrganizationPlan, OrganizationStatus, PaymentRequestStatus } from "@prisma/client";
import { BILLING_BANK_DETAILS, PLAN_MONTHLY_AMOUNT_NGN } from "@/lib/billing-access";
import { formatCurrency } from "@/lib/utils";

type BillingProps = {
  organization: {
    plan: OrganizationPlan;
    status: OrganizationStatus;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    subscriptionEndsAt: string | null;
  };
  access: {
    trialDaysLeft: number | null;
    isTrialWarning: boolean;
    billingLocked: boolean;
  };
  paymentRequests: Array<{
    id: string;
    requestedPlan: OrganizationPlan;
    amount: number;
    status: PaymentRequestStatus;
    transactionReference: string | null;
    createdAt: string;
  }>;
};

function formatShortDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type PlanCardProps = {
  name: string;
  subtitle: string;
  price: string;
  note: string;
  buttonText: string;
  onClick: () => void;
  disabled?: boolean;
};

function PlanCard({ name, subtitle, price, note, buttonText, onClick, disabled = false }: PlanCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</p>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{price}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
      >
        {buttonText}
      </button>
    </div>
  );
}

export function BillingOnboarding({ organization, access, paymentRequests }: BillingProps) {
  const [selectedPlan, setSelectedPlan] = useState<OrganizationPlan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"trial" | "payment" | null>(null);

  const canStartTrial = useMemo(() => {
    if (organization.status === "TRIAL_EXPIRED" || organization.status === "EXPIRED") return false;
    return !organization.trialStartedAt;
  }, [organization.status, organization.trialStartedAt]);
  const activePending = useMemo(
    () => paymentRequests.find((item) => item.status === "PENDING"),
    [paymentRequests]
  );

  async function handleStartTrial() {
    setError("");
    setMessage("");
    setBusy("trial");
    try {
      const res = await fetch("/api/billing/trial/start", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Could not start trial");
        return;
      }
      setMessage("Free trial started. Refreshing your billing status...");
      window.location.reload();
    } catch {
      setError("Network error. Could not start free trial.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePaymentSubmit(formData: FormData) {
    setError("");
    setMessage("");
    setBusy("payment");
    try {
      const res = await fetch("/api/billing/payment-requests", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Could not submit payment request");
        return;
      }
      setMessage("Payment submitted. Your account will be activated after verification.");
      setSelectedPlan(null);
      window.location.reload();
    } catch {
      setError("Network error. Could not submit payment request.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Choose Your DiagSync Plan</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick a plan to continue using your lab workspace. Your data remains safe even when billing is locked.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Current plan: {organization.plan}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Status: {organization.status}</span>
          {organization.trialEndsAt ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              Trial ends: {formatShortDate(organization.trialEndsAt)}
            </span>
          ) : null}
        </div>
        {access.trialDaysLeft !== null ? (
          <p className={`mt-3 text-sm font-medium ${access.isTrialWarning ? "text-amber-600" : "text-slate-700"}`}>
            Trial ends in {access.trialDaysLeft} day{access.trialDaysLeft === 1 ? "" : "s"}.
          </p>
        ) : null}
        {organization.status === "TRIAL_EXPIRED" || organization.status === "EXPIRED" ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Your free trial has ended. Choose a plan to continue.
          </p>
        ) : null}
        {organization.status === "PAYMENT_PENDING" ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Payment submitted. Your account will be activated after verification.
          </p>
        ) : null}
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PlanCard
          name="Free 2-week trial"
          subtitle="Free 2-week trial — full access, no payment needed"
          price="Free"
          note="Everything unlocked from day one. The only catch: all printed reports carry a DiagSync watermark."
          buttonText={canStartTrial ? (busy === "trial" ? "Starting..." : "Start Free Trial") : "Trial Ended"}
          disabled={!canStartTrial || busy !== null}
          onClick={() => {
            if (!canStartTrial || busy) return;
            void handleStartTrial();
          }}
        />
        <PlanCard
          name="Starter Pack"
          subtitle="Laboratory-focused plan"
          price={`${formatCurrency(PLAN_MONTHLY_AMOUNT_NGN.STARTER)} / month`}
          note="Up to 15 staff. No radiology, imaging uploads, custom letterhead, or web push."
          buttonText="Get Starter"
          onClick={() => setSelectedPlan("STARTER")}
        />
        <PlanCard
          name="Advanced Pack"
          subtitle="Full multi-department access"
          price={`${formatCurrency(PLAN_MONTHLY_AMOUNT_NGN.ADVANCED)} / month`}
          note="Unlimited staff. Includes radiology, cardiology, imaging uploads, branding, and web push."
          buttonText="Get Advanced"
          onClick={() => setSelectedPlan("ADVANCED")}
        />
      </div>

      {selectedPlan ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Manual Payment Instructions</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-800">Selected Plan</p>
              <p className="mt-1 text-slate-700">{selectedPlan}</p>
              <p className="text-slate-700">{formatCurrency(PLAN_MONTHLY_AMOUNT_NGN[selectedPlan])} / month</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-800">Bank Details</p>
              <p className="mt-1 text-slate-700">Bank: {BILLING_BANK_DETAILS.bankName}</p>
              <p className="text-slate-700">Account Number: {BILLING_BANK_DETAILS.accountNumber}</p>
              <p className="text-slate-700">Account Name: {BILLING_BANK_DETAILS.accountName}</p>
            </div>
          </div>

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              data.set("requestedPlan", selectedPlan);
              void handlePaymentSubmit(data);
            }}
          >
            <input type="hidden" name="requestedPlan" value={selectedPlan} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Transaction Reference</label>
              <input
                name="transactionReference"
                required
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-800"
                placeholder="Enter bank transfer reference"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Payment Proof (Optional)</label>
              <input name="proof" type="file" className="block w-full text-xs text-slate-600" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Message (Optional)</label>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800"
                placeholder="Any note for verification"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy === "payment"}
                className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy === "payment" ? "Submitting..." : "I have made payment"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Recent Payment Requests</h3>
        {paymentRequests.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No payment requests submitted yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-2 py-2">Plan</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentRequests.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-2 text-slate-700">{item.requestedPlan}</td>
                    <td className="px-2 py-2 text-slate-700">{formatCurrency(item.amount)}</td>
                    <td className="px-2 py-2 text-slate-600">{item.transactionReference ?? "-"}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          item.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.status === "REJECTED"
                            ? "bg-red-50 text-red-600"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-500">{formatShortDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activePending ? (
          <p className="mt-3 text-xs text-amber-700">
            Latest pending request: {activePending.requestedPlan} ({formatCurrency(activePending.amount)}).
          </p>
        ) : null}
      </div>
    </div>
  );
}
