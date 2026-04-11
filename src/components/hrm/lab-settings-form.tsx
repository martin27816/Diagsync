"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Settings = {
  name: string;
  email: string;
  phone: string;
  address: string;
  contactInfo?: string | null;
  logo?: string | null;
  letterheadUrl?: string | null;
};

export function LabSettingsForm() {
  const [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/organization/settings");
    const json = await res.json();
    if (!json.success) {
      setError(json.error ?? "Failed to load settings");
      setLoading(false);
      return;
    }
    setForm(json.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function uploadFile(file: File, folder: string, field: "logo" | "letterheadUrl") {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    const res = await fetch("/api/uploads/branding", { method: "POST", body });
    const json = await res.json();
    if (!json.success) {
      setError(json.error ?? "Upload failed");
      return;
    }
    setForm((prev) => (prev ? { ...prev, [field]: json.data.fileUrl } : prev));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/organization/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error ?? "Failed to save settings");
      setSaving(false);
      return;
    }
    setMessage("Settings updated");
    setSaving(false);
  }

  if (loading || !form) {
    return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      {error ? <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      {message ? <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Laboratory Name</span>
          <input className="h-10 w-full rounded-md border px-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Contact Email</span>
          <input className="h-10 w-full rounded-md border px-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Phone</span>
          <input className="h-10 w-full rounded-md border px-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Address</span>
          <input className="h-10 w-full rounded-md border px-3" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
      </div>

      <label className="space-y-1 text-sm block">
        <span>Additional Contact Info (optional)</span>
        <textarea className="w-full rounded-md border px-3 py-2" rows={3} value={form.contactInfo ?? ""} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Laboratory Logo</p>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void uploadFile(e.target.files[0], "diagsync/branding/logo", "logo")} />
          {form.logo ? <p className="break-all text-xs text-muted-foreground">{form.logo}</p> : <p className="text-xs text-muted-foreground">No logo uploaded</p>}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Letterhead Template</p>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void uploadFile(e.target.files[0], "diagsync/branding/letterhead", "letterheadUrl")} />
          {form.letterheadUrl ? <p className="break-all text-xs text-muted-foreground">{form.letterheadUrl}</p> : <p className="text-xs text-muted-foreground">No letterhead uploaded</p>}
        </div>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
