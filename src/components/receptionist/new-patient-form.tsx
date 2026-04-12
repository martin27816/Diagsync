"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Plus,
  FlaskConical,
  Scan,
  ShoppingCart,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/index";
import { Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";
import { cn, formatCurrency } from "@/lib/utils";
import { enqueueOfflinePatient, listOfflinePatientItems, removeOfflinePatient, type OfflinePatientPayload } from "@/lib/offline-sync";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  name: string;
  code: string;
  type: "LAB" | "RADIOLOGY";
  department: string;
  sampleType?: string | null;
  category?: { name: string } | null;
}

interface CartItem extends TestResult {
  enteredPrice: string;
}

type Priority = "ROUTINE" | "URGENT" | "EMERGENCY";
type PaymentStatus = "PENDING" | "PAID" | "PARTIAL" | "WAIVED";
type Sex = "MALE" | "FEMALE" | "OTHER";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    ROUTINE: "bg-secondary text-secondary-foreground",
    URGENT: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    EMERGENCY: "bg-red-100 text-red-800 border border-red-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[priority])}>
      {priority}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewPatientForm() {
  const router = useRouter();

  // Patient fields
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("MALE");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [referringDoctor, setReferringDoctor] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");

  // Visit fields
  const [priority, setPriority] = useState<Priority>("ROUTINE");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PENDING");
  const [amountPaid, setAmountPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [visitNotes, setVisitNotes] = useState("");

  // Test search & cart
  const [testSearch, setTestSearch] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [savedData, setSavedData] = useState<{ patientId: string; visitNumber: string } | null>(null);

  // ─── Test Search ────────────────────────────────────────────────────────────

  const searchTests = useCallback(async (query: string) => {
    if (query.length < 1) {
      setTestResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/tests?search=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success) {
        // Filter out already-added tests
        const cartIds = new Set(cart.map((c) => c.id));
        setTestResults((json.data as TestResult[]).filter((t) => !cartIds.has(t.id)));
        setShowDropdown(true);
      }
    } catch {
      // silent
    } finally {
      setSearchLoading(false);
    }
  }, [cart]);

  useEffect(() => {
    const t = setTimeout(() => searchTests(testSearch), 300);
    return () => clearTimeout(t);
  }, [testSearch, searchTests]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function addToCart(test: TestResult) {
    setCart((prev) => [...prev, { ...test, enteredPrice: "" }]);
    setTestSearch("");
    setTestResults([]);
    setShowDropdown(false);
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((t) => t.id !== id));
  }

  function updateCartPrice(id: string, value: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              enteredPrice: value,
            }
          : item
      )
    );
  }

  // ─── Billing Calculations ───────────────────────────────────────────────────

  const subtotal = cart.reduce((s, t) => s + toNumberPrice(t.enteredPrice), 0);
  const discountAmount = parseFloat(discount) || 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const amountPaidNum = parseFloat(amountPaid) || 0;
  const balance = Math.max(0, totalAmount - amountPaidNum);

  // Auto-set payment status based on amounts
  useEffect(() => {
    if (totalAmount === 0) return;
    if (amountPaidNum >= totalAmount) setPaymentStatus("PAID");
    else if (amountPaidNum > 0) setPaymentStatus("PARTIAL");
    else setPaymentStatus("PENDING");
  }, [amountPaidNum, totalAmount]);

  useEffect(() => {
    const syncStatus = () => setIsOnline(navigator.onLine);
    syncStatus();
    window.addEventListener("online", syncStatus);
    window.addEventListener("offline", syncStatus);
    return () => {
      window.removeEventListener("online", syncStatus);
      window.removeEventListener("offline", syncStatus);
    };
  }, []);

  function buildPatientPayload(): OfflinePatientPayload {
    return {
      fullName: fullName.trim(),
      age: parseInt(age),
      sex,
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      dateOfBirth: dateOfBirth || undefined,
      referringDoctor: referringDoctor.trim() || undefined,
      clinicalNote: clinicalNote.trim() || undefined,
      priority,
      paymentStatus,
      amountPaid: amountPaidNum,
      discount: discountAmount,
      paymentMethod: paymentMethod || undefined,
      notes: visitNotes.trim() || undefined,
      testIds: cart.map((item) => item.id),
      testPrices: cart.map((item) => ({ testId: item.id, price: toNumberPrice(item.enteredPrice) })),
    };
  }

  function saveRepeatSnapshot(payload: OfflinePatientPayload) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "diag_sync_last_patient_snapshot",
      JSON.stringify({
        payload,
        cart,
      })
    );
  }

  function preloadRepeatPatient() {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("diag_sync_last_patient_snapshot");
    if (!raw) {
      setError("No previous patient data found.");
      return;
    }
    try {
      const data = JSON.parse(raw) as { payload: OfflinePatientPayload; cart?: CartItem[] };
      const payload = data.payload;
      setFullName(payload.fullName);
      setAge(String(payload.age));
      setSex(payload.sex);
      setPhone(payload.phone);
      setEmail(payload.email ?? "");
      setAddress(payload.address ?? "");
      setDateOfBirth(payload.dateOfBirth ?? "");
      setReferringDoctor(payload.referringDoctor ?? "");
      setClinicalNote(payload.clinicalNote ?? "");
      setPriority(payload.priority);
      setPaymentStatus(payload.paymentStatus);
      setAmountPaid(String(payload.amountPaid));
      setDiscount(String(payload.discount));
      setPaymentMethod(payload.paymentMethod ?? "");
      setVisitNotes(payload.notes ?? "");
      if (Array.isArray(data.cart) && data.cart.length > 0) {
        setCart(data.cart);
      }
      setError("");
    } catch {
      setError("Previous patient data is invalid.");
    }
  }

  const syncOfflinePatients = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = listOfflinePatientItems();
    if (pending.length === 0) return;
    setSyncingOffline(true);
    for (const item of pending) {
      try {
        const res = await fetch("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        const json = await res.json();
        if (json.success) {
          removeOfflinePatient(item.id);
        }
      } catch {
        break;
      }
    }
    setSyncingOffline(false);
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    void syncOfflinePatients();
  }, [isOnline, syncOfflinePatients]);

  // ─── Submission ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError("");

    if (!fullName.trim()) return setError("Patient full name is required.");
    if (!age || isNaN(parseInt(age))) return setError("Valid age is required.");
    if (!phone.trim()) return setError("Phone number is required.");
    if (cart.length === 0) return setError("Please add at least one test.");
    if (cart.some((item) => toNumberPrice(item.enteredPrice) <= 0)) return setError("Enter a valid price for each selected test.");

    const payload = buildPatientPayload();
    if (!isOnline) {
      enqueueOfflinePatient(payload);
      saveRepeatSnapshot(payload);
      setSavedData({
        patientId: "OFFLINE-SAVED",
        visitNumber: `LOCAL-${Date.now().toString().slice(-6)}`,
      });
      setSuccess(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Something went wrong");
        return;
      }

      setSavedData({
        patientId: json.data.patientId,
        visitNumber: json.data.visitNumber,
      });
      saveRepeatSnapshot(payload);
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success Screen ─────────────────────────────────────────────────────────

  if (success && savedData) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-5 max-w-md mx-auto">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Patient Registered!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {savedData.patientId === "OFFLINE-SAVED"
              ? "You are offline. This registration is saved locally and will sync automatically."
              : "Tests have been routed to the relevant departments."}
          </p>
        </div>
        <div className="rounded-lg bg-muted p-4 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Patient ID</span>
            <span className="font-mono font-semibold">{savedData.patientId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Visit Number</span>
            <span className="font-mono font-semibold">{savedData.visitNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tests Ordered</span>
            <span className="font-semibold">{cart.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-semibold">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setSuccess(false);
              setSavedData(null);
              // Reset form
              setFullName(""); setAge(""); setPhone(""); setEmail("");
              setAddress(""); setDateOfBirth(""); setReferringDoctor("");
              setClinicalNote(""); setPriority("ROUTINE");
              setPaymentStatus("PENDING"); setAmountPaid("");
              setDiscount(""); setPaymentMethod(""); setVisitNotes("");
              setCart([]);
            }}
          >
            Register Another
          </Button>
          <Button className="flex-1" onClick={() => router.push("/dashboard/receptionist")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ─── Main Form ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className={`rounded border px-3 py-2 text-xs ${isOnline ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
        {isOnline ? (syncingOffline ? "Online - syncing offline registrations..." : "Online") : "Offline - patient registration will be saved locally."}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: Patient details + visit details */}
      <div className="lg:col-span-2 space-y-6">

        {/* Patient Details */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Patient Details
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="e.g. Musa Ibrahim"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                type="number"
                min="0"
                max="150"
                placeholder="e.g. 32"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sex *</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                placeholder="+234..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="patient@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of Birth (optional)</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refDoctor">Referring Doctor (optional)</Label>
              <Input
                id="refDoctor"
                placeholder="Dr. ..."
                value={referringDoctor}
                onChange={(e) => setReferringDoctor(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="address">Address (optional)</Label>
              <Input
                id="address"
                placeholder="Patient's home address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="clinicalNote">Clinical Note / Complaint (optional)</Label>
              <textarea
                id="clinicalNote"
                rows={2}
                placeholder="Brief clinical complaint or note..."
                value={clinicalNote}
                onChange={(e) => setClinicalNote(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
          </div>
        </section>

        {/* Test Search & Cart */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Tests Ordered
          </h2>

          {/* Search */}
          <div ref={searchRef} className="relative mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Input
                placeholder="Search tests by name or code (e.g. FBC, X-Ray)..."
                className="pl-9"
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                onFocus={() => testSearch.length > 0 && setShowDropdown(true)}
              />
            </div>

            {/* Dropdown */}
            {showDropdown && testResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
                {testResults.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => addToCart(test)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-xs font-bold",
                        test.type === "LAB" ? "bg-blue-500" : "bg-purple-500"
                      )}>
                        {test.type === "LAB" ? <FlaskConical className="h-3.5 w-3.5" /> : <Scan className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <p className="font-medium">{test.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {test.code} · {test.category?.name ?? test.department}
                          {test.sampleType && ` · ${test.sampleType}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">Set at billing</span>
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && testSearch.length > 0 && testResults.length === 0 && !searchLoading && (
              <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-lg p-4 text-center text-sm text-muted-foreground">
                No tests found for &ldquo;{testSearch}&rdquo;
              </div>
            )}
          </div>

          {/* Cart */}
          {cart.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <ShoppingCart className="h-6 w-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tests added yet. Search above to add tests.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3"
                >
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-xs",
                    item.type === "LAB" ? "bg-blue-500" : "bg-purple-500"
                  )}>
                    {item.type === "LAB" ? <FlaskConical className="h-3.5 w-3.5" /> : <Scan className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.code}</p>
                  </div>
                  <div className="w-28 shrink-0">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={item.enteredPrice}
                      onChange={(e) => updateCartPrice(item.id, e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Visit Notes */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Visit Notes (optional)
          </h2>
          <textarea
            rows={2}
            placeholder="Any additional notes about this visit..."
            value={visitNotes}
            onChange={(e) => setVisitNotes(e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </section>
      </div>

      {/* Right: Priority + Billing Summary + Submit */}
      <div className="space-y-4">
        <Button variant="outline" className="w-full" onClick={preloadRepeatPatient}>
          One-click repeat patient
        </Button>

        {/* Priority */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Priority
          </h2>
          <div className="space-y-2">
            {(["ROUTINE", "URGENT", "EMERGENCY"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-all",
                  priority === p
                    ? p === "EMERGENCY"
                      ? "border-red-500 bg-red-50 text-red-800"
                      : p === "URGENT"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-800"
                        : "border-primary bg-primary/5 text-primary"
                    : "hover:bg-muted/40"
                )}
              >
                <span>{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                {priority === p && (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Billing */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Billing
          </h2>

          {/* Line items */}
          <div className="space-y-1.5 text-sm mb-4">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="text-muted-foreground truncate pr-2">{item.name}</span>
                <span>{formatCurrency(toNumberPrice(item.enteredPrice))}</span>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="text-muted-foreground text-center py-2">No tests added</p>
            )}
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="discount">Discount (₦)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1.5 mt-1.5">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amountPaid">Amount Paid (₦)</Label>
              <Input
                id="amountPaid"
                type="number"
                min="0"
                placeholder="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="POS">POS / Card</SelectItem>
                  <SelectItem value="HMO">HMO / Insurance</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment status indicator */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={
                  paymentStatus === "PAID"
                    ? "success"
                    : paymentStatus === "PARTIAL"
                      ? "warning"
                      : "destructive"
                }
              >
                {paymentStatus}
              </Badge>
            </div>

            {balance > 0 && (
              <div className="flex items-center justify-between text-sm font-semibold text-orange-700">
                <span>Balance Due</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Submit */}
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            className="w-full h-11 text-base font-semibold"
            disabled={submitting || cart.length === 0}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving & Routing...
              </>
            ) : (
              <>
                Save & Route to Lab
                {cart.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                    {cart.length} test{cart.length !== 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Tests will be automatically routed to the correct department.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

function toNumberPrice(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
