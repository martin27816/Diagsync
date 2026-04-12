"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/index";

type FieldType = "NUMBER" | "TEXT" | "TEXTAREA" | "DROPDOWN" | "CHECKBOX";
type TestType = "LAB" | "RADIOLOGY";
type Department = "LABORATORY" | "RADIOLOGY";

type CategoryOption = {
  id: string;
  name: string;
};

type FieldDraft = {
  label: string;
  fieldKey: string;
  fieldType: FieldType;
  unit: string;
  normalMin: string;
  normalMax: string;
  options: string;
  isRequired: boolean;
};

const emptyField = (): FieldDraft => ({
  label: "",
  fieldKey: "",
  fieldType: "NUMBER",
  unit: "",
  normalMin: "",
  normalMax: "",
  options: "",
  isRequired: true,
});

function toFieldKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function TestCatalogForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<TestType>("LAB");
  const [department, setDepartment] = useState<Department>("LABORATORY");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [turnaroundMinutes, setTurnaroundMinutes] = useState("120");
  const [sampleType, setSampleType] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>([emptyField()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function setField(index: number, patch: Partial<FieldDraft>) {
    setFields((prev) =>
      prev.map((field, i) => {
        if (i !== index) return field;
        const next = { ...field, ...patch };
        if ("label" in patch && (!next.fieldKey || next.fieldKey === toFieldKey(field.label))) {
          next.fieldKey = toFieldKey(next.label);
        }
        return next;
      })
    );
  }

  function addField() {
    setFields((prev) => [...prev, emptyField()]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setName("");
    setCode("");
    setType("LAB");
    setDepartment("LABORATORY");
    setCategoryId("");
    setPrice("");
    setTurnaroundMinutes("120");
    setSampleType("");
    setDescription("");
    setFields([emptyField()]);
  }

  async function onSubmit() {
    setError("");
    setMessage("");
    if (!name.trim() || !code.trim()) {
      setError("Test name and code are required.");
      return;
    }
    if (fields.some((field) => !field.label.trim() || !field.fieldKey.trim())) {
      setError("Each field needs a label and key.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          type,
          department,
          categoryId: categoryId || undefined,
          price: price.trim() ? Number(price) : 0,
          turnaroundMinutes: Number(turnaroundMinutes),
          sampleType: sampleType.trim() || undefined,
          description: description.trim() || undefined,
          fields: fields.map((field) => ({
            label: field.label.trim(),
            fieldKey: field.fieldKey.trim(),
            fieldType: field.fieldType,
            unit: field.unit.trim() || undefined,
            normalMin: field.normalMin.trim() ? Number(field.normalMin) : undefined,
            normalMax: field.normalMax.trim() ? Number(field.normalMax) : undefined,
            options: field.options.trim() || undefined,
            isRequired: field.isRequired,
          })),
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        setError(json.error ?? "Failed to add test");
        return;
      }
      setMessage("Test added successfully.");
      resetForm();
      router.refresh();
    } catch {
      setError("Network error while adding test.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Add New Test</h2>
        <p className="text-xs text-slate-400">Define the test and its report fields, units, and normal ranges.</p>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}
      {message ? <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{message}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Test Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. D-Dimer" />
        </div>
        <div className="space-y-1">
          <Label>Code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. DDIMER" />
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Select
            value={type}
            onValueChange={(value) => {
              const next = value as TestType;
              setType(next);
              setDepartment(next === "LAB" ? "LABORATORY" : "RADIOLOGY");
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LAB">Lab</SelectItem>
              <SelectItem value="RADIOLOGY">Radiology</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Select value={department} onValueChange={(value) => setDepartment(value as Department)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LABORATORY">Laboratory</SelectItem>
              <SelectItem value="RADIOLOGY">Radiology</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Default Price (optional)</Label>
          <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label>Turnaround (mins)</Label>
          <Input type="number" min="1" value={turnaroundMinutes} onChange={(e) => setTurnaroundMinutes(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Sample Type (optional)</Label>
          <Input value={sampleType} onChange={(e) => setSampleType(e.target.value)} placeholder="Serum / Whole Blood" />
        </div>
        <div className="space-y-1 md:col-span-3">
          <Label>Description (optional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short test description" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Result Fields</h3>
          <Button type="button" variant="outline" onClick={addField}>Add Field</Button>
        </div>
        {fields.map((field, index) => (
          <div key={index} className="rounded border border-slate-200 p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input value={field.label} onChange={(e) => setField(index, { label: e.target.value })} placeholder="Field label" />
              <Input value={field.fieldKey} onChange={(e) => setField(index, { fieldKey: e.target.value })} placeholder="field_key" />
              <Select value={field.fieldType} onValueChange={(value) => setField(index, { fieldType: value as FieldType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NUMBER">NUMBER</SelectItem>
                  <SelectItem value="TEXT">TEXT</SelectItem>
                  <SelectItem value="TEXTAREA">TEXTAREA</SelectItem>
                  <SelectItem value="DROPDOWN">DROPDOWN</SelectItem>
                  <SelectItem value="CHECKBOX">CHECKBOX</SelectItem>
                </SelectContent>
              </Select>
              <Input value={field.unit} onChange={(e) => setField(index, { unit: e.target.value })} placeholder="Unit (e.g. mg/dL)" />
              <Input value={field.normalMin} onChange={(e) => setField(index, { normalMin: e.target.value })} placeholder="Normal min" />
              <Input value={field.normalMax} onChange={(e) => setField(index, { normalMax: e.target.value })} placeholder="Normal max" />
              <Input value={field.options} onChange={(e) => setField(index, { options: e.target.value })} placeholder="Options (comma-separated)" />
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={field.isRequired}
                  onChange={(e) => setField(index, { isRequired: e.target.checked })}
                />
                Required
              </label>
            </div>
            {fields.length > 1 ? (
              <button type="button" onClick={() => removeField(index)} className="text-xs text-red-600 hover:underline">
                Remove field
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={busy}>
          {busy ? "Saving..." : "Save Test"}
        </Button>
      </div>
    </section>
  );
}

