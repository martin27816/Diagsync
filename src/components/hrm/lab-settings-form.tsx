"use client";

import { useEffect, useMemo, useState } from "react";
import { Country, State } from "country-state-city";

type OrgSettings = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contactInfo: string;
  logo: string;
  letterheadUrl: string;
  consultationTimeoutMinutes: string;
};

const inputCls = "h-8 w-full rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls = "block text-[11px] font-medium text-slate-500 mb-1";
const areaCls = "w-full rounded border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500";

const emptySettings: OrgSettings = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "Nigeria",
  contactInfo: "",
  logo: "",
  letterheadUrl: "",
  consultationTimeoutMinutes: "10",
};

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

export function LabSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<OrgSettings>(emptySettings);
  const [initialSettings, setInitialSettings] = useState<OrgSettings>(emptySettings);
  const [countryQuery, setCountryQuery] = useState("");
  const [stateQuery, setStateQuery] = useState("");
  const countries = Country.getAllCountries();
  const selectedCountry = countries.find((c) => c.name === settings.country) || null;
  const stateOptions = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [];
  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countryQuery.trim().toLowerCase())
  );
  const filteredStates = stateOptions.filter((s) =>
    s.name.toLowerCase().includes(stateQuery.trim().toLowerCase())
  );

  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [initialSettings, settings]
  );

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/organization/settings");
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load settings");
        return;
      }
      const next: OrgSettings = {
        name: json.data?.name ?? "",
        email: json.data?.email ?? "",
        phone: json.data?.phone ?? "",
        address: json.data?.address ?? "",
        city: json.data?.city ?? "",
        state: json.data?.state ?? "",
        country: json.data?.country ?? "Nigeria",
        contactInfo: json.data?.contactInfo ?? "",
        logo: json.data?.logo ?? "",
        letterheadUrl: json.data?.letterheadUrl ?? "",
        consultationTimeoutMinutes: String(json.data?.consultationTimeoutMinutes ?? 10),
      };
      setSettings(next);
      setInitialSettings(next);
    } catch {
      setError("Network error while loading settings");
    } finally {
      setLoading(false);
    }
  }

  async function uploadBranding(file: File, folder: string, kind: "logo" | "letterhead") {
    if (kind === "logo") setUploadingLogo(true);
    else setUploadingLetterhead(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const res = await fetch("/api/uploads/branding", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Branding upload failed");
        return;
      }
      const url = json.data?.fileUrl as string;
      if (!url) return;
      setSettings((prev) => ({
        ...prev,
        [kind === "logo" ? "logo" : "letterheadUrl"]: url,
      }));
    } catch {
      setError("Branding upload failed");
    } finally {
      if (kind === "logo") setUploadingLogo(false);
      else setUploadingLetterhead(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: settings.name.trim(),
        email: settings.email.trim(),
        phone: settings.phone.trim(),
        address: settings.address.trim(),
        city: settings.city.trim() || null,
        state: settings.state.trim() || null,
        country: settings.country.trim() || "Nigeria",
        contactInfo: settings.contactInfo.trim() || null,
        logo: settings.logo.trim() || null,
        letterheadUrl: settings.letterheadUrl.trim() || null,
        consultationTimeoutMinutes: Math.max(
          1,
          Math.min(120, Number.parseInt(settings.consultationTimeoutMinutes || "10", 10) || 10)
        ),
      };
      const res = await fetch("/api/organization/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Unable to save settings");
        return;
      }
      const next = {
        name: json.data?.name ?? payload.name,
        email: json.data?.email ?? payload.email,
        phone: json.data?.phone ?? payload.phone,
        address: json.data?.address ?? payload.address,
        city: json.data?.city ?? payload.city ?? "",
        state: json.data?.state ?? payload.state ?? "",
        country: json.data?.country ?? payload.country ?? "Nigeria",
        contactInfo: json.data?.contactInfo ?? payload.contactInfo ?? "",
        logo: json.data?.logo ?? payload.logo ?? "",
        letterheadUrl: json.data?.letterheadUrl ?? payload.letterheadUrl ?? "",
        consultationTimeoutMinutes: String(
          json.data?.consultationTimeoutMinutes ?? payload.consultationTimeoutMinutes
        ),
      };
      setSettings(next);
      setInitialSettings(next);
      setMessage("Settings updated successfully.");
    } catch {
      setError("Network error while saving settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-xs text-slate-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lab Branding & Report Setup</span>
      </div>

      <div className="p-4 space-y-4">
        {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}
        {message ? <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{message}</div> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Organization Name *</label>
            <input
              value={settings.name}
              onChange={(e) => setSettings((prev) => ({ ...prev, name: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Reene Medical Diagnostics"
            />
          </div>

          <div>
            <label className={labelCls}>Email *</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.value }))}
              className={inputCls}
              placeholder="info@lab.com"
            />
          </div>

          <div>
            <label className={labelCls}>Phone *</label>
            <input
              value={settings.phone}
              onChange={(e) => setSettings((prev) => ({ ...prev, phone: e.target.value }))}
              className={inputCls}
              placeholder="+234..."
            />
          </div>

          <div>
            <label className={labelCls}>Address *</label>
            <input
              value={settings.address}
              onChange={(e) => setSettings((prev) => ({ ...prev, address: e.target.value }))}
              className={inputCls}
              placeholder="Full lab address"
            />
          </div>

          <div>
            <label className={labelCls}>Consultation Timer (minutes)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.consultationTimeoutMinutes}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  consultationTimeoutMinutes: e.target.value,
                }))
              }
              className={inputCls}
              placeholder="10"
            />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input
              value={settings.city}
              onChange={(e) => setSettings((prev) => ({ ...prev, city: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Lagos"
            />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input
              value={stateQuery}
              onChange={(e) => setStateQuery(e.target.value)}
              className={`${inputCls} mb-1`}
              placeholder="Search state..."
              disabled={!selectedCountry || stateOptions.length === 0}
            />
            <select
              value={settings.state}
              onChange={(e) => setSettings((prev) => ({ ...prev, state: e.target.value }))}
              className={inputCls}
              disabled={!selectedCountry || stateOptions.length === 0}
            >
              <option value="">{selectedCountry ? "Select state" : "Select country first"}</option>
              {filteredStates.map((s) => (
                <option key={s.isoCode} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              className={`${inputCls} mb-1`}
              placeholder="Search country..."
            />
            <select
              value={settings.country}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  country: e.target.value,
                  state: "",
                }))
              }
              className={inputCls}
            >
              {filteredCountries.map((c) => (
                <option key={c.isoCode} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Contact Info (optional)</label>
            <textarea
              rows={2}
              value={settings.contactInfo}
              onChange={(e) => setSettings((prev) => ({ ...prev, contactInfo: e.target.value }))}
              className={areaCls}
              placeholder="Website, alternate phone, business hours, etc."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded border border-slate-100 p-3 space-y-2">
            <label className={labelCls}>Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await uploadBranding(file, "diagsync/branding/logo", "logo");
                e.target.value = "";
              }}
              className="text-xs"
            />
            {uploadingLogo ? <p className="text-[11px] text-slate-400">Uploading logo...</p> : null}
            {settings.logo ? (
              <div className="space-y-1">
                <img src={settings.logo} alt="Lab logo" className="h-16 w-auto rounded border border-slate-200 bg-white p-1" />
                <p className="text-[11px] text-slate-500">Uploaded: {getFriendlyFileName(settings.logo)}</p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">No logo uploaded.</p>
            )}
          </div>

          <div className="rounded border border-slate-100 p-3 space-y-2">
            <label className={labelCls}>Letterhead Template</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await uploadBranding(file, "diagsync/branding/letterhead", "letterhead");
                e.target.value = "";
              }}
              className="text-xs"
            />
            {uploadingLetterhead ? <p className="text-[11px] text-slate-400">Uploading letterhead...</p> : null}
            {settings.letterheadUrl ? (
              <div className="space-y-1">
                <img src={settings.letterheadUrl} alt="Lab letterhead" className="h-16 w-full rounded border border-slate-200 bg-white object-contain p-1" />
                <p className="text-[11px] text-slate-500">Uploaded: {getFriendlyFileName(settings.letterheadUrl)}</p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">No letterhead uploaded.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            onClick={() => void onSave()}
            disabled={saving || uploadingLogo || uploadingLetterhead || !hasChanges}
            className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button
            onClick={() => {
              setSettings(initialSettings);
              setError("");
              setMessage("");
            }}
            disabled={saving || !hasChanges}
            className="rounded border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
