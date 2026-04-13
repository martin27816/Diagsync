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
  const patient = args.content.patient ?? {};
  const meta = args.content.meta ?? {};
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
      ? safeLabTests
          .map((test: any) => {
            const rows = Array.isArray(test.rows) ? test.rows : [];
            const rowHtml = rows
              .map(
                (row: any) => `
                  <tr>
                    <td>${escapeHtml(String(row.name ?? ""))}</td>
                    <td>${escapeHtml(String(row.value ?? ""))}</td>
                    <td>${escapeHtml(String(row.unit ?? ""))}</td>
                    <td>${escapeHtml(String(row.reference ?? ""))}</td>
                  </tr>
                `
              )
              .join("");

            return `
              <section class="block">
                <h3>${escapeHtml(String(test.name ?? "Laboratory Test"))}</h3>
                <table>
                  <thead>
                    <tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference</th></tr>
                  </thead>
                  <tbody>${rowHtml}</tbody>
                </table>
              </section>
            `;
          })
          .join("")
      : safeRadiologyTests
          .map(
            (test: any) => `
              <section class="block">
                <h3>${escapeHtml(String(test.name ?? "Radiology Report"))}</h3>
                <p><strong>Findings:</strong> ${escapeHtml(String(test.findings ?? ""))}</p>
                <p><strong>Impression:</strong> ${escapeHtml(String(test.impression ?? ""))}</p>
                ${
                  test.notes
                    ? `<p><strong>Notes:</strong> ${escapeHtml(String(test.notes))}</p>`
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
                          return `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`;
                        })
                        .join("")
                    : ""
                }
              </section>
            `
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
      width: 794px;
      max-width: 794px;
      min-height: 1123px;
      margin: 0 auto;
      box-sizing: border-box;
      padding: ${hasLetterhead ? "340px 44px 90px" : "170px 44px 90px"};
      background: #ffffff;
      --wm-top-offset: ${hasLetterhead ? "160px" : "88px"};
      --wm-bottom-offset: 118px;
    }
    .letterhead-layer {
      position: absolute;
      inset: 0;
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
      padding: 18px 22px;
      background: ${hasLetterhead ? "#ffffff" : "rgba(255, 255, 255, 0.93)"};
      border-radius: 8px;
    }
    .content { position: relative; z-index: 2; }
    .header { margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    h1 { margin: 0 0 6px; font-size: 20px; }
    h2 { margin: 8px 0; font-size: 16px; }
    h3 { margin: 8px 0; font-size: 14px; }
    p { margin: 4px 0; font-size: 13px; }
    .meta-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .block { margin-bottom: 14px; break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
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
    <div class="content-shell">
    <div class="content">
      <h2>${args.department === Department.LABORATORY ? "Laboratory Report" : "Radiology Report"}</h2>
      <div class="meta-grid">
        <p><strong>Patient:</strong> ${escapeHtml(String(patient.fullName ?? "-"))}</p>
        <p><strong>Patient ID:</strong> ${escapeHtml(String(patient.patientId ?? "-"))}</p>
        <p><strong>Age/Sex:</strong> ${escapeHtml(String(patient.age ?? "-"))} / ${escapeHtml(String(patient.sex ?? "-"))}</p>
        <p><strong>Visit No:</strong> ${escapeHtml(String(meta.visitNumber ?? "-"))}</p>
        <p><strong>Visit Date:</strong> ${escapeHtml(String(meta.visitDate ?? "-"))}</p>
        <p><strong>Report Date:</strong> ${escapeHtml(String(meta.reportDate ?? "-"))}</p>
        <p><strong>Referring Doctor:</strong> ${escapeHtml(String(meta.referringDoctor ?? "-"))}</p>
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
