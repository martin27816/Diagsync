"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { formatCurrency } from "@/lib/utils";
import { enqueueOfflinePatient, listOfflinePatientItems, removeOfflinePatient, type OfflinePatientPayload } from "@/lib/offline-sync";

interface TestResult {
  id: string; name: string; code: string; type: "LAB" | "RADIOLOGY";
  department: string; sampleType?: string | null; category?: { name: string } | null;
}
interface CartItem extends TestResult { enteredPrice: string }
type Priority = "ROUTINE" | "URGENT" | "EMERGENCY";
type PaymentStatus = "PENDING" | "PAID" | "PARTIAL" | "WAIVED";
type Sex = "MALE" | "FEMALE" | "OTHER";

function toNumberPrice(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const inputCls = "h-8 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls = "block text-[11px] font-medium text-slate-500 mb-1";

export function NewPatientForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("MALE");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [referringDoctor, setReferringDoctor] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");
  const [priority, setPriority] = useState<Priority>("ROUTINE");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PENDING");
  const [amountPaid, setAmountPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [savedData, setSavedData] = useState<{ patientId: string; visitNumber: string } | null>(null);

  const searchTests = useCallback(async (query: string) => {
    if (query.length < 1) { setTestResults([]); setShowDropdown(false); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/tests?search=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success) {
        const cartIds = new Set(cart.map((c) => c.id));
        setTestResults((json.data as TestResult[]).filter((t) => !cartIds.has(t.id)));
        setShowDropdown(true);
      }
    } catch {} finally { setSearchLoading(false); }
  }, [cart]);

  useEffect(() => { const t = setTimeout(() => searchTests(testSearch), 300); return () => clearTimeout(t); }, [testSearch, searchTests]);

  useEffect(() => {
    function handler(e: MouseEvent) { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    sync(); window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  const subtotal = cart.reduce((s, t) => s + toNumberPrice(t.enteredPrice), 0);
  const discountAmount = parseFloat(discount) || 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const amountPaidNum = parseFloat(amountPaid) || 0;
  const balance = Math.max(0, totalAmount - amountPaidNum);

  useEffect(() => {
    if (totalAmount === 0) return;
    if (amountPaidNum >= totalAmount) setPaymentStatus("PAID");
    else if (amountPaidNum > 0) setPaymentStatus("PARTIAL");
    else setPaymentStatus("PENDING");
  }, [amountPaidNum, totalAmount]);

  function addToCart(test: TestResult) { setCart((prev) => [...prev, { ...test, enteredPrice: "" }]); setTestSearch(""); setTestResults([]); setShowDropdown(false); }
  function removeFromCart(id: string) { setCart((prev) => prev.filter((t) => t.id !== id)); }
  function updateCartPrice(id: string, value: string) { setCart((prev) => prev.map((item) => item.id === id ? { ...item, enteredPrice: value } : item)); }

  function buildPayload(): OfflinePatientPayload {
    return {
      fullName: fullName.trim(), age: parseInt(age), sex, phone: phone.trim(),
      email: email.trim() || undefined, address: address.trim() || undefined,
      dateOfBirth: dateOfBirth || undefined, referringDoctor: referringDoctor.trim() || undefined,
      clinicalNote: clinicalNote.trim() || undefined, priority, paymentStatus,
      amountPaid: amountPaidNum, discount: discountAmount,
      paymentMethod: paymentMethod || undefined, notes: visitNotes.trim() || undefined,
      testIds: cart.map((item) => item.id),
      testPrices: cart.map((item) => ({ testId: item.id, price: toNumberPrice(item.enteredPrice) })),
    };
  }

  const syncOfflinePatients = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = listOfflinePatientItems();
    if (pending.length === 0) return;
    setSyncingOffline(true);
    for (const item of pending) {
      try {
        const res = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.payload) });
        const json = await res.json();
        if (json.success) removeOfflinePatient(item.id);
      } catch { break; }
    }
    setSyncingOffline(false);
  }, []);

  useEffect(() => { if (isOnline) void syncOfflinePatients(); }, [isOnline, syncOfflinePatients]);

  async function handleSubmit() {
    setError("");
    if (!fullName.trim()) return setError("Patient full name is required.");
    if (!age || isNaN(parseInt(age))) return setError("Valid age is required.");
    if (!phone.trim()) return setError("Phone number is required.");
    if (cart.length === 0) return setError("Please add at least one test.");
    if (cart.some((item) => toNumberPrice(item.enteredPrice) <= 0)) return setError("Enter a valid price for each test.");
    const payload = buildPayload();
    if (!isOnline) {
      enqueueOfflinePatient(payload);
      setSavedData({ patientId: "OFFLINE-SAVED", visitNumber: `LOCAL-${Date.now().toString().slice(-6)}` });
      setSuccess(true); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Something went wrong"); return; }
      setSavedData({ patientId: json.data.patientId, visitNumber: json.data.visitNumber });
      setSuccess(true);
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  function resetForm() {
    setFullName(""); setAge(""); setPhone(""); setEmail(""); setAddress(""); setDateOfBirth("");
    setReferringDoctor(""); setClinicalNote(""); setPriority("ROUTINE"); setPaymentStatus("PENDING");
    setAmountPaid(""); setDiscount(""); setPaymentMethod(""); setVisitNotes(""); setCart([]);
  }

  const paymentBadge: Record<string, string> = {
    PAID: "bg-green-50 text-green-700", PARTIAL: "bg-amber-50 text-amber-700",
    PENDING: "bg-red-50 text-red-600", WAIVED: "bg-slate-100 text-slate-600",
  };

  // Success screen
  if (success && savedData) return (
    <div className="max-w-sm mx-auto rounded-lg border border-slate-200 bg-white p-6 text-center space-y-4">
      <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xl">✓</div>
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Patient Registered</h2>
        <p className="text-xs text-slate-400 mt-1">
          {savedData.patientId === "OFFLINE-SAVED" ? "Saved locally. Will sync when online." : "Tests routed to departments."}
        </p>
      </div>
      <div className="rounded border border-slate-100 bg-slate-50 p-3 text-left space-y-1.5">
        {[["Patient ID", savedData.patientId], ["Visit No.", savedData.visitNumber], ["Tests", cart.length], ["Total", formatCurrency(totalAmount)]].map(([k, v]) => (
          <div key={String(k)} className="flex justify-between text-xs">
            <span className="text-slate-500">{k}</span>
            <span className="font-mono font-medium text-slate-800">{v}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => { setSuccess(false); setSavedData(null); resetForm(); }} className="flex-1 rounded border border-slate-200 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors">Register Another</button>
        <button onClick={() => router.push("/dashboard/receptionist")} className="flex-1 rounded bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Online status */}
      <div className={`rounded border px-3 py-1.5 text-xs ${isOnline ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
        {isOnline ? (syncingOffline ? "Online — syncing offline registrations..." : "Online") : "Offline — registration will be saved locally."}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Left: patient + tests */}
        <div className="lg:col-span-2 space-y-4">

          {/* Patient details */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient Details</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Full Name *</label>
                <input placeholder="e.g. Musa Ibrahim" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Age *</label>
                <input type="number" min="0" max="150" placeholder="32" value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sex *</label>
                <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={labelCls}>Phone *</label>
                <input placeholder="+234..." value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email (optional)</label>
                <input type="email" placeholder="patient@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date of Birth (optional)</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Referring Doctor (optional)</label>
                <input placeholder="Dr. ..." value={referringDoctor} onChange={(e) => setReferringDoctor(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Address (optional)</label>
                <input placeholder="Home address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Clinical Note / Complaint (optional)</label>
                <textarea rows={2} placeholder="Brief clinical complaint..." value={clinicalNote} onChange={(e) => setClinicalNote(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          </div>

          {/* Tests */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tests Ordered</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Search */}
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    placeholder="Search tests by name or code (e.g. FBC, X-Ray)..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    onFocus={() => testSearch.length > 0 && setShowDropdown(true)}
                    className="h-8 w-full rounded border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {searchLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">Searching...</span>}
                </div>

                {showDropdown && testResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 rounded border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                    {testResults.map((test) => (
                      <button key={test.id} type="button" onClick={() => addToCart(test)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-xs hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0">
                        <div>
                          <p className="font-medium text-slate-800">{test.name}</p>
                          <p className="text-slate-400">{test.code} · {test.category?.name ?? test.department}{test.sampleType ? ` · ${test.sampleType}` : ""}</p>
                        </div>
                        <span className={`rounded px-1.5 py-0.5 font-medium text-[11px] ${test.type === "LAB" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                          {test.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && testSearch.length > 0 && testResults.length === 0 && !searchLoading && (
                  <div className="absolute z-50 w-full mt-1 rounded border border-slate-200 bg-white shadow-lg px-4 py-3 text-center text-xs text-slate-400">
                    No tests found for "{testSearch}"
                  </div>
                )}
              </div>

              {/* Cart */}
              {cart.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4 border border-dashed border-slate-200 rounded">No tests added yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left font-medium text-slate-400">Test</th>
                      <th className="pb-2 text-left font-medium text-slate-400">Type</th>
                      <th className="pb-2 text-left font-medium text-slate-400 w-28">Price (₦)</th>
                      <th className="pb-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 font-medium text-slate-800">{item.name} <span className="font-mono text-slate-400">{item.code}</span></td>
                        <td className="py-2">
                          <span className={`rounded px-1.5 py-0.5 font-medium ${item.type === "LAB" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{item.type}</span>
                        </td>
                        <td className="py-2">
                          <input type="number" min="0" placeholder="Price" value={item.enteredPrice} onChange={(e) => updateCartPrice(item.id, e.target.value)}
                            className="h-7 w-full rounded border border-slate-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </td>
                        <td className="py-2">
                          <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><X className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Visit notes */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visit Notes (optional)</span>
            </div>
            <div className="p-4">
              <textarea rows={2} placeholder="Any additional notes about this visit..." value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        </div>

        {/* Right: priority + billing + submit */}
        <div className="space-y-4">
          {/* Priority */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</span>
            </div>
            <div className="p-3 space-y-1.5">
              {(["ROUTINE", "URGENT", "EMERGENCY"] as Priority[]).map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`w-full flex items-center justify-between rounded border px-3 py-2 text-xs font-medium transition-colors ${
                    priority === p
                      ? p === "EMERGENCY" ? "border-red-300 bg-red-50 text-red-700" : p === "URGENT" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                  {priority === p && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Billing */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billing</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Line items */}
              {cart.length > 0 && (
                <div className="space-y-1">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-slate-500 truncate pr-2">{item.name}</span>
                      <span className="text-slate-700">{formatCurrency(toNumberPrice(item.enteredPrice))}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className={labelCls}>Discount (₦)</label>
                <input type="number" min="0" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} />
              </div>

              {/* Totals */}
              <div className="rounded border border-slate-100 bg-slate-50 p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount</span><span>−{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-200 pt-1.5">
                  <span>Total</span><span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <div>
                <label className={labelCls}>Amount Paid (₦)</label>
                <input type="number" min="0" placeholder="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="POS">POS / Card</SelectItem>
                    <SelectItem value="HMO">HMO / Insurance</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Payment Status</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${paymentBadge[paymentStatus]}`}>{paymentStatus}</span>
              </div>

              {balance > 0 && (
                <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
                  <span>Balance Due</span><span>{formatCurrency(balance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="space-y-2">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
            )}
            <button
              disabled={submitting || cart.length === 0}
              onClick={handleSubmit}
              className="w-full rounded bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Saving & Routing..." : `Save & Route to Lab${cart.length > 0 ? ` (${cart.length} test${cart.length !== 1 ? "s" : ""})` : ""}`}
            </button>
            <p className="text-center text-[11px] text-slate-400">Tests will be automatically routed to the correct department.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
