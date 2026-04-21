import { Department } from "@prisma/client";
import { SIGNOFF_IMAGE_KEY, SIGNOFF_NAME_KEY } from "./report-signoff";

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasRenderableValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number" || typeof value === "boolean") return true;
  return String(value).trim().length > 0;
}

type LabRenderRow = {
  name: string;
  value: string;
  unit: string;
  reference: string;
};

type LabRenderTest = {
  name: string;
  rows: LabRenderRow[];
};

type SensitivityEntry = {
  antibiotic: string;
  zone: string;
  interpretation: string;
};

function normalizeToken(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isSensitivityRow(rowName: string) {
  return normalizeToken(rowName).includes("sensitivity");
}

function isCultureRow(rowName: string) {
  const token = normalizeToken(rowName);
  return token.includes("culture");
}

function isMicroscopyRow(rowName: string) {
  const token = normalizeToken(rowName);
  return (
    token.includes("wbc") ||
    token.includes("pus") ||
    token.includes("epithelial") ||
    token.includes("bacterial") ||
    token.includes("yeast")
  );
}

function parseSensitivityEntries(rawValue: string): SensitivityEntry[] {
  const text = rawValue.trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines
    .map((line) => {
      if (line.includes("||")) {
        const [antibiotic = "", zone = "", interpretation = ""] = line.split("||");
        return {
          antibiotic: antibiotic.trim(),
          zone: zone.trim(),
          interpretation: interpretation.trim().toUpperCase(),
        };
      }

      const cleanLine = line.replace(/\s+/g, " ").trim();
      const interpretationMatch = cleanLine.match(/\b(S|R|I)\b/i);
      const zoneMatch = cleanLine.match(/\b(\d+\+|\+\+\+|\+\+|\+|\d+(?:\.\d+)?\s*mm)\b/i);

      let antibiotic = cleanLine;
      const colonIdx = cleanLine.indexOf(":");
      if (colonIdx > 0) {
        antibiotic = cleanLine.slice(0, colonIdx).trim();
      } else if (interpretationMatch?.index !== undefined) {
        antibiotic = cleanLine.slice(0, interpretationMatch.index).trim();
      } else if (zoneMatch?.index !== undefined) {
        antibiotic = cleanLine.slice(0, zoneMatch.index).trim();
      }

      antibiotic = antibiotic.replace(/[-–:,]+$/g, "").trim();

      return {
        antibiotic,
        zone: zoneMatch?.[1]?.trim() ?? "",
        interpretation: interpretationMatch?.[1]?.toUpperCase() ?? "",
      };
    })
    .filter((item) => item.antibiotic.length > 0);

  if (parsed.length > 0) return parsed;

  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((antibiotic) => ({ antibiotic, zone: "", interpretation: "" }));
}

function renderGenericLabSection(test: LabRenderTest) {
  const rows = test.rows.filter((row) => hasRenderableValue(row.value));
  if (rows.length === 0) return "";

  const rowHtml = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.value)}</td>
          <td>${escapeHtml(row.unit)}</td>
          <td>${escapeHtml(row.reference)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="block">
      <h3>${escapeHtml(test.name || "Laboratory Test")}</h3>
      <table>
        <thead>
          <tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference</th></tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </section>
  `;
}

function renderMicroCultureSensitivitySection(tests: LabRenderTest[]) {
  if (tests.length === 0) return "";

  const specimenColumns = tests.map((test) => ({
    label: test.name?.trim() || "SPECIMEN",
    rows: test.rows,
  }));

  const preferredMicroscopyRows = [
    "WBC/PUS cells/HPF",
    "Epithelial cells",
    "Bacterial cells",
    "Yeast cells",
  ];

  const microscopyLabelMap = new Map<string, string>();
  for (const label of preferredMicroscopyRows) {
    microscopyLabelMap.set(normalizeToken(label), label);
  }

  for (const test of specimenColumns) {
    for (const row of test.rows) {
      if (!isMicroscopyRow(row.name)) continue;
      const token = normalizeToken(row.name);
      if (!microscopyLabelMap.has(token)) {
        microscopyLabelMap.set(token, row.name);
      }
    }
  }

  const microscopyRows = Array.from(microscopyLabelMap.entries());
  const microscopyHtmlRows = microscopyRows
    .map(([token, label]) => {
      const values = specimenColumns
        .map((test) => {
          const found = test.rows.find((row) => normalizeToken(row.name) === token);
          return escapeHtml(found?.value ?? "-");
        })
        .map((value) => `<td>${value}</td>`)
        .join("");
      return `<tr><td>${escapeHtml(label)}</td>${values}</tr>`;
    })
    .join("");

  const cultureLines = specimenColumns
    .map((test) => {
      const cultureRows = test.rows.filter(
        (row) => isCultureRow(row.name) && !isSensitivityRow(row.name) && hasRenderableValue(row.value)
      );
      if (cultureRows.length === 0) return "";
      const summary = cultureRows.map((row) => row.value).join(" ").trim();
      if (!summary) return "";
      return `<p><strong>${escapeHtml(test.label)}:</strong> ${escapeHtml(summary)}</p>`;
    })
    .filter(Boolean)
    .join("");

  const sensitivityRaw =
    specimenColumns
      .map((test) => test.rows.find((row) => isSensitivityRow(row.name))?.value ?? "")
      .find((value) => value.trim().length > 0) ?? "";

  const sensitivityEntries = parseSensitivityEntries(sensitivityRaw);
  const sensitivityHtml =
    sensitivityEntries.length > 0
      ? `
        <section class="block sensitivity-block">
          <h3 class="sensitivity-title">SENSITIVITY</h3>
          <div class="sensitivity-wrap">
            <table class="sensitivity-table">
              <thead>
                <tr>
                  <th class="sens-row-title"> </th>
                  ${sensitivityEntries
                    .map(
                      (item) =>
                        `<th class="sens-drug"><span>${escapeHtml(item.antibiotic)}</span></th>`
                    )
                    .join("")}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th class="sens-row-title">Value</th>
                  ${sensitivityEntries
                    .map((item) => `<td>${escapeHtml(item.zone || "-")}</td>`)
                    .join("")}
                </tr>
                <tr>
                  <th class="sens-row-title">Result</th>
                  ${sensitivityEntries
                    .map((item) => `<td class="sens-result">${escapeHtml(item.interpretation || "-")}</td>`)
                    .join("")}
                </tr>
              </tbody>
            </table>
          </div>
          <p class="sensitivity-note"><strong>Note:</strong> S = Sensitivity, R = Resistance, I = Intermediate</p>
        </section>
      `
      : "";

  const microscopyTable =
    microscopyHtmlRows.length > 0
      ? `
        <section class="block">
          <h3>MICROSCOPY CULTURE AND SENSITIVITY</h3>
          <table class="mcs-table">
            <thead>
              <tr>
                <th>SPECIMEN</th>
                ${specimenColumns.map((test) => `<th>${escapeHtml(test.label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${microscopyHtmlRows}
            </tbody>
          </table>
        </section>
      `
      : "";

  const cultureHtml = cultureLines
    ? `
      <section class="block culture-report">
        <p><strong>CULTURE (S) REPORT</strong></p>
        ${cultureLines}
      </section>
    `
    : "";

  return `${microscopyTable}${cultureHtml}${sensitivityHtml}`;
}

function splitRadiologyNarrative(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const normalized = trimmed
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "\n")
    .replace(/\t+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  const labelRegex =
    /(Technique|Liver|Gallbladder|Pancreas|Spleen|Kidneys?|Bowel|Uterus|Myometrium|Endometrium|Adnexae|Right ovary|Left ovary|POD|Urinary bladder|Bladder|Prostate|Cervix|Impression)\s*:/gi;
  const labelMatches = Array.from(normalized.matchAll(labelRegex));
  if (labelMatches.length > 1) {
    const points: string[] = [];
    for (let i = 0; i < labelMatches.length; i += 1) {
      const start = labelMatches[i].index ?? 0;
      const end = i + 1 < labelMatches.length ? labelMatches[i + 1].index ?? normalized.length : normalized.length;
      const chunk = normalized.slice(start, end).trim().replace(/\s+/g, " ");
      if (chunk) points.push(chunk);
    }
    if (points.length > 0) return points;
  }

  const linePoints = normalized
    .split(/\n|;/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (linePoints.length > 1) return linePoints;

  const sentencePoints = normalized
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/[.?!]$/.test(line) ? line : `${line}.`));
  if (sentencePoints.length > 1) return sentencePoints;

  return [normalized];
}

function splitEmbeddedImpression(findingsInput: string, impressionInput: string) {
  const findingsText = findingsInput.trim();
  const impressionText = impressionInput.trim();
  if (!findingsText) return { findingsText, impressionText };

  const match = findingsText.match(/\bimpression\s*:\s*(.+)$/i);
  if (!match || match.index === undefined) {
    return { findingsText, impressionText };
  }

  const cleanedFindings = findingsText.slice(0, match.index).trim();
  const extractedImpression = match[1]?.trim() ?? "";
  return {
    findingsText: cleanedFindings,
    impressionText: impressionText || extractedImpression,
  };
}

function renderNarrativeBlock(rawText: string, opts?: { preferList?: boolean }) {
  const points = splitRadiologyNarrative(rawText);
  if (points.length === 0) return `<p class="rad-paragraph">-</p>`;
  if ((opts?.preferList ?? false) && points.length > 1) {
    return `<ul class="rad-list">${points.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }
  return points.map((item) => `<p class="rad-paragraph">${escapeHtml(item)}</p>`).join("");
}

type RenderArgs = {
  organization: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo?: string | null;
    letterheadUrl?: string | null;
  };
  department: Department;
  content: any;
  comments?: string | null;
  prescription?: string | null;
  mdName?: string | null;
  watermarkUrl?: string;
  includeLetterhead?: boolean;
};

export function renderReportHtml(args: RenderArgs) {
  const hasLetterhead = Boolean(args.includeLetterhead !== false && args.organization.letterheadUrl);
  const pageHeightPx = 1123;
  const pageWidthPx = 794;
  const contentTopPx = hasLetterhead ? 252 : 148;
  const contentBottomPx = hasLetterhead ? 156 : 92;
  const patient = args.content.patient ?? {};
  const meta = args.content.meta ?? {};
  const referringDoctor = String(meta.referringDoctor ?? "").trim();
  const tests = Array.isArray(args.content.tests) ? args.content.tests : [];
  const safeLabTests = tests.filter((test: any) => Array.isArray(test?.rows));
  const safeRadiologyTests = tests.filter((test: any) => !Array.isArray(test?.rows));
  const imagingFiles = Array.isArray(args.content.imagingFiles) ? args.content.imagingFiles : [];
  const signOff =
    args.content?.signOff &&
    typeof args.content.signOff === "object" &&
    typeof args.content.signOff.signatureImage === "string" &&
    typeof args.content.signOff.signatureName === "string"
      ? args.content.signOff
      : null;

  const testsHtml =
    args.department === Department.LABORATORY
      ? (() => {
          const normalizedLabTests: LabRenderTest[] = safeLabTests.map((test: any) => ({
            name: String(test?.name ?? "Laboratory Test"),
            rows: (Array.isArray(test?.rows) ? test.rows : []).map((row: any) => ({
              name: String(row?.name ?? ""),
              value: String(row?.value ?? ""),
              unit: String(row?.unit ?? ""),
              reference: String(row?.reference ?? ""),
            })),
          }));

          const microCultureTests = normalizedLabTests.filter((test) => {
            const title = normalizeToken(test.name);
            if (title.includes("m c s") || title.includes("culture") || title.includes("sensitivity")) {
              return true;
            }
            return test.rows.some(
              (row) => isSensitivityRow(row.name) || isCultureRow(row.name)
            );
          });

          const microCultureHtml = renderMicroCultureSensitivitySection(microCultureTests);
          const renderedMicroCulture = new Set(microCultureTests);
          const genericHtml = normalizedLabTests
            .filter((test) => !renderedMicroCulture.has(test))
            .map((test) => renderGenericLabSection(test))
            .join("");

          return `${microCultureHtml}${genericHtml}`;
        })()
      : safeRadiologyTests
          .map(
            (test: any) => {
              const normalized = splitEmbeddedImpression(
                String(test.findings ?? ""),
                String(test.impression ?? "")
              );

              return `
              <section class="block">
                <h3>${escapeHtml(String(test.name ?? "Radiology Report"))}</h3>
                <div class="rad-field">
                  <p class="rad-label">Findings</p>
                  ${renderNarrativeBlock(normalized.findingsText, { preferList: true })}
                </div>
                <div class="rad-field">
                  <p class="rad-label">Impression</p>
                  ${renderNarrativeBlock(normalized.impressionText)}
                </div>
                ${
                  test.notes
                    ? `<div class="rad-field">
                        <p class="rad-label">Notes</p>
                        ${renderNarrativeBlock(String(test.notes))}
                      </div>`
                    : ""
                }
                ${
                  test.extraFields && typeof test.extraFields === "object"
                    ? Object.entries(test.extraFields as Record<string, unknown>)
                        .map(([key, value]) => {
                          if (key === SIGNOFF_IMAGE_KEY || key === SIGNOFF_NAME_KEY) return "";
                          const k = String(key ?? "").trim();
                          const v = value === null || value === undefined ? "" : String(value);
                          if (!k) return "";
                          return `<div class="rad-field">
                            <p class="rad-label">${escapeHtml(k)}</p>
                            ${renderNarrativeBlock(v)}
                          </div>`;
                        })
                        .join("")
                    : ""
                }
              </section>
            `;
            }
          )
          .join("");

  const effectiveWatermarkUrl = args.watermarkUrl || null;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(args.organization.name)} - ${args.department === Department.LABORATORY ? "Lab Report" : "Radiology Report"}</title>
  <style>
    @page { size: A4; margin: 0; }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      position: relative;
      width: ${pageWidthPx}px;
      max-width: ${pageWidthPx}px;
      min-height: ${pageHeightPx}px;
      height: auto;
      margin: 0 auto;
      box-sizing: border-box;
      padding: ${contentTopPx}px 44px ${contentBottomPx}px;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
      background: #ffffff;
      overflow: visible;
      --wm-top-offset: ${hasLetterhead ? "132px" : "82px"};
      --wm-bottom-offset: ${hasLetterhead ? "140px" : "108px"};
    }
    .letterhead-layer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: ${pageHeightPx}px;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .letterhead-layer img {
      width: 100%;
      height: 100%;
      object-fit: fill;
      display: block;
    }
    .watermark {
      position: absolute;
      pointer-events: none;
      z-index: 1;
      opacity: 1;
    }
    .watermark img {
      width: 120px;
      height: auto;
      max-width: none;
      transform: none;
    }
    .watermark-top-left {
      top: var(--wm-top-offset);
      left: 42px;
    }
    .watermark-bottom-right {
      right: 42px;
      bottom: var(--wm-bottom-offset);
    }
    .content-shell {
      position: relative;
      z-index: 2;
      max-width: 760px;
      margin: 0 auto;
      padding: 14px 18px;
      background: ${hasLetterhead ? "#ffffff" : "rgba(255, 255, 255, 0.93)"};
      border-radius: 8px;
      overflow: visible;
    }
    .content { position: relative; z-index: 2; }
    .header { margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    h1 { margin: 0 0 6px; font-size: 20px; }
    h2 { margin: 8px 0; font-size: 16px; }
    h3 { margin: 8px 0; font-size: 14px; }
    p { margin: 4px 0; font-size: 13px; }
    .meta-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .block { margin-bottom: 10px; break-inside: avoid; }
    .rad-field { margin: 8px 0 10px; }
    .rad-label {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      letter-spacing: 0.01em;
    }
    .rad-paragraph {
      margin: 0 0 6px;
      font-size: 13px;
      line-height: 1.45;
      color: #1f2937;
    }
    .rad-list {
      margin: 0 0 4px 18px;
      padding: 0;
    }
    .rad-list li {
      margin: 0 0 6px;
      font-size: 13px;
      line-height: 1.45;
      color: #1f2937;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 5px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .mcs-table th, .mcs-table td { text-align: left; }
    .culture-report p { margin: 3px 0; }
    .sensitivity-block { margin-top: 8px; }
    .sensitivity-title { text-align: center; letter-spacing: 0.03em; margin-bottom: 6px; }
    .sensitivity-wrap { overflow: visible; }
    .sensitivity-table { table-layout: fixed; width: 100%; min-width: 0; }
    .sensitivity-table th,
    .sensitivity-table td {
      border: 1px solid #9ca3af;
      text-align: center;
      padding: 2px 1px;
      font-size: 10px;
    }
    .sensitivity-table .sens-row-title {
      width: 54px;
      min-width: 54px;
      font-weight: 700;
      background: #f9fafb;
    }
    .sensitivity-table .sens-drug {
      width: auto;
      min-width: 0;
      height: 112px;
      padding: 0;
      background: #ffffff;
      vertical-align: bottom;
    }
    .sensitivity-table .sens-drug span {
      display: inline-block;
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      line-height: 1.0;
      font-weight: 600;
      padding: 3px 0;
    }
    .sensitivity-table .sens-result { font-weight: 700; color: #b91c1c; }
    .sensitivity-note { margin-top: 6px; font-size: 11px; }
    .footer-note { margin-top: 18px; font-size: 12px; }
    .signature-block {
      margin-top: 16px;
      break-inside: avoid;
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      max-width: 240px;
    }
    .signature-image {
      width: auto;
      max-width: 220px;
      max-height: 78px;
      object-fit: contain;
      display: block;
    }
    .signature-name {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      word-break: break-word;
      max-width: 220px;
    }
    .muted { color: #6b7280; }
    .imaging-section { margin-bottom: 16px; }
    .imaging-grid { display:grid; grid-template-columns: 1fr; gap: 14px; }
    .imaging-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; background: #fff; break-inside: avoid; }
    .imaging-card img { width: 100%; max-height: 560px; object-fit: contain; display:block; margin:0 auto; border-radius: 6px; }
    .imaging-caption { font-size: 11px; color: #6b7280; margin-top: 6px; word-break: break-all; }
    .preview-actions {
      position: fixed;
      top: 14px;
      right: 14px;
      z-index: 20;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .preview-print-btn {
      border: 1px solid #1d4ed8;
      background: #1d4ed8;
      color: #ffffff;
      font-size: 13px;
      line-height: 1;
      font-weight: 600;
      border-radius: 8px;
      padding: 10px 14px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    }
    .preview-print-btn:hover {
      background: #1e40af;
      border-color: #1e40af;
    }
    .preview-print-btn:active {
      transform: translateY(1px);
    }
    @media print {
      .preview-actions { display: none !important; }
      .page {
        width: auto !important;
        max-width: none !important;
        min-height: 0 !important;
        height: auto !important;
        margin: 0 !important;
        overflow: visible !important;
      }
      .content-shell {
        border-radius: 0 !important;
        background: #ffffff !important;
        overflow: visible !important;
      }
      .block,
      table,
      .imaging-card,
      .signature-block {
        page-break-inside: avoid;
        break-inside: avoid-page;
      }
      .sensitivity-wrap { overflow: visible !important; }
      .sensitivity-table th,
      .sensitivity-table td {
        font-size: 9px;
        padding: 1px 1px;
      }
      .sensitivity-table .sens-row-title {
        width: 46px;
        min-width: 46px;
      }
      .sensitivity-table .sens-drug {
        height: 98px;
      }
    }
  </style>
</head>
<body>
  <div class="preview-actions">
    <button class="preview-print-btn" onclick="window.print()" type="button">Print Report</button>
  </div>
  <main class="page">
    ${
      hasLetterhead && args.organization.letterheadUrl
        ? `<div class="letterhead-layer"><img src="${escapeHtml(args.organization.letterheadUrl)}" alt="letterhead" crossorigin="anonymous" /></div>`
        : ""
    }
    ${
      effectiveWatermarkUrl
        ? `<div class="watermark watermark-top-left"><img src="${escapeHtml(effectiveWatermarkUrl)}" alt="watermark" crossorigin="anonymous" /></div>
           <div class="watermark watermark-bottom-right"><img src="${escapeHtml(effectiveWatermarkUrl)}" alt="watermark" crossorigin="anonymous" /></div>`
        : ""
    }
    <div class="content-shell" id="content-shell">
    <div class="content">
      <h2>${args.department === Department.LABORATORY ? "Laboratory Report" : "Radiology Report"}</h2>
      <div class="meta-grid">
        <p><strong>Patient:</strong> ${escapeHtml(String(patient.fullName ?? "-"))}</p>
        <p><strong>Patient ID:</strong> ${escapeHtml(String(patient.patientId ?? "-"))}</p>
        <p><strong>Age/Sex:</strong> ${escapeHtml(String(patient.age ?? "-"))} / ${escapeHtml(String(patient.sex ?? "-"))}</p>
        <p><strong>Visit No:</strong> ${escapeHtml(String(meta.visitNumber ?? "-"))}</p>
        <p><strong>Visit Date:</strong> ${escapeHtml(String(meta.visitDate ?? "-"))}</p>
        <p><strong>Report Date:</strong> ${escapeHtml(String(meta.reportDate ?? "-"))}</p>
        ${referringDoctor ? `<p><strong>Referring Doctor:</strong> ${escapeHtml(referringDoctor)}</p>` : ""}
      </div>
      ${
        args.department === Department.RADIOLOGY && imagingFiles.length
          ? `<section class="imaging-section">
          <h3>Imaging Preview</h3>
          <div class="imaging-grid">
            ${imagingFiles
              .map((img: any) => {
                const isImage = String(img.fileType ?? "").startsWith("image/");
                if (!isImage || !img.url) return "";
                return `<div class="imaging-card">
                  <img src="${escapeHtml(String(img.url))}" alt="${escapeHtml(String(img.name ?? "Radiology Image"))}" crossorigin="anonymous" />
                  <p class="imaging-caption">${escapeHtml(String(img.name ?? ""))}</p>
                </div>`;
              })
              .join("")}
          </div>
        </section>`
          : ""
      }
      ${testsHtml || `<p>No reportable items.</p>`}
      ${
        args.comments
          ? `<section class="block"><h3>MD Comments</h3><p>${escapeHtml(args.comments)}</p></section>`
          : ""
      }
      ${
        args.prescription
          ? `<section class="block"><h3>Prescription</h3><p>${escapeHtml(args.prescription)}</p></section>`
          : ""
      }
      ${
        args.mdName
          ? `<p class="footer-note"><strong>Medical Sign-off:</strong> ${escapeHtml(args.mdName)}</p>`
          : ""
      }
      ${
        signOff
          ? `<section class="signature-block">
              <img class="signature-image" src="${escapeHtml(String(signOff.signatureImage))}" alt="Signature" crossorigin="anonymous" />
              <p class="signature-name">${escapeHtml(String(signOff.signatureName))}</p>
            </section>`
          : ""
      }
    </div>
    </div>
  </main>
</body>
</html>
  `.trim();
}
