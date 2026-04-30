"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";

type FieldType = "NUMBER" | "TEXT" | "TEXTAREA" | "DROPDOWN" | "CHECKBOX";

type FieldRow = {
  id: string;
  label: string;
  fieldKey: string;
  fieldType: FieldType;
  isRequired: boolean;
};

type DraftField = {
  label: string;
  fieldKey: string;
  fieldType: FieldType;
  options: string;
  isRequired: boolean;
};

function toFieldKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function RadiologyFieldManager({ testId }: { testId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [draft, setDraft] = useState<DraftField>({
    label: "",
    fieldKey: "",
    fieldType: "TEXT",
    options: "",
    isRequired: false,
  });

  async function loadFields() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/tests/${testId}`);
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { resultFields?: FieldRow[] };
      };
      if (!json.success) {
        setError(json.error ?? "Failed to load test fields.");
        return;
      }
      setFields((json.data?.resultFields ?? []) as FieldRow[]);
    } catch {
      setError("Network error while loading test fields.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && fields.length === 0) {
      await loadFields();
    }
  }

  async function removeField(fieldId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeFieldIds: [fieldId] }),
      });
      const json = (await res.json()) as { success: boolean; error?: string; data?: { resultFields?: FieldRow[] } };
      if (!json.success) {
        setError(json.error ?? "Failed to remove field.");
        return;
      }
      setFields((json.data?.resultFields ?? []) as FieldRow[]);
      router.refresh();
    } catch {
      setError("Network error while removing field.");
    } finally {
      setBusy(false);
    }
  }

  async function addField() {
    setError("");
    if (!draft.label.trim()) {
      setError("Field label is required.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addFields: [
            {
              label: draft.label.trim(),
              fieldKey: (draft.fieldKey.trim() || toFieldKey(draft.label)).trim(),
              fieldType: draft.fieldType,
              options: draft.options.trim() || undefined,
              isRequired: draft.isRequired,
            },
          ],
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string; data?: { resultFields?: FieldRow[] } };
      if (!json.success) {
        setError(json.error ?? "Failed to add field.");
        return;
      }
      setFields((json.data?.resultFields ?? []) as FieldRow[]);
      setDraft({ label: "", fieldKey: "", fieldType: "TEXT", options: "", isRequired: false });
      router.refresh();
    } catch {
      setError("Network error while adding field.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={() => void toggleOpen()} disabled={busy} className="h-7 text-[11px]">
        {open ? "Hide Fields" : "Manage Fields"}
      </Button>

      {open ? (
        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
          {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
          <div className="space-y-1">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-slate-700">{field.label}</p>
                  <p className="truncate text-[10px] text-slate-400">{field.fieldKey} · {field.fieldType}</p>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-red-600 hover:underline disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void removeField(field.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-5">
            <Input
              value={draft.label}
              onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Field label"
              className="h-7 text-[11px]"
            />
            <Input
              value={draft.fieldKey}
              onChange={(e) => setDraft((prev) => ({ ...prev, fieldKey: e.target.value }))}
              placeholder="field_key"
              className="h-7 text-[11px]"
            />
            <Select value={draft.fieldType} onValueChange={(v) => setDraft((prev) => ({ ...prev, fieldType: v as FieldType }))}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">TEXT</SelectItem>
                <SelectItem value="TEXTAREA">TEXTAREA</SelectItem>
                <SelectItem value="NUMBER">NUMBER</SelectItem>
                <SelectItem value="DROPDOWN">DROPDOWN</SelectItem>
                <SelectItem value="CHECKBOX">CHECKBOX</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={draft.options}
              onChange={(e) => setDraft((prev) => ({ ...prev, options: e.target.value }))}
              placeholder="Options (comma)"
              className="h-7 text-[11px]"
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={draft.isRequired}
                  onChange={(e) => setDraft((prev) => ({ ...prev, isRequired: e.target.checked }))}
                />
                Required
              </label>
              <Button type="button" onClick={() => void addField()} disabled={busy} className="h-7 text-[11px]">
                Add
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            Protected for radiology: `findings` and `impression` cannot be removed.
          </p>
        </div>
      ) : null}
    </div>
  );
}

