import { Department } from "@prisma/client";

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
};

export function renderReportHtml(args: RenderArgs) {
  const hasLetterhead = Boolean(args.organization.letterheadUrl);
  const patient = args.content.patient ?? {};
  const meta = args.content.meta ?? {};
  const tests = Array.isArray(args.content.tests) ? args.content.tests : [];
  const safeLabTests = tests.filter((test: any) => Array.isArray(test?.rows));
  const safeRadiologyTests = tests.filter((test: any) => !Array.isArray(test?.rows));
  const imagingFiles = Array.isArray(args.content.imagingFiles) ? args.content.imagingFiles : [];

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
              </section>
            `
          )
          .join("");

  const letterheadBackground = hasLetterhead
    ? `background-image:url('${args.organization.letterheadUrl}');background-size:100% 100%;background-position:left top;background-repeat:no-repeat;`
    : "background:#ffffff;";
  const effectiveWatermarkUrl = args.watermarkUrl || null;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(args.organization.name)} - ${args.department === Department.LABORATORY ? "Lab Report" : "Radiology Report"}</title>
  <style>
    @page { size: A4; margin: 0; }
    body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
    .page {
      position: relative;
      width: 794px;
      max-width: 794px;
      min-height: 1123px;
      margin: 0 auto;
      box-sizing: border-box;
      padding: ${hasLetterhead ? "340px 44px 90px" : "120px 44px 90px"};
      ${letterheadBackground}
    }
    .watermark {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      pointer-events: none;
      z-index: 0;
      opacity: 0.08;
      padding: 0 0 28px 28px;
    }
    .watermark img { width: 110px; height: auto; }
    .content-shell {
      position: relative;
      z-index: 2;
      max-width: 760px;
      margin: 0 auto;
      padding: 18px 22px;
      background: ${hasLetterhead ? "#ffffff" : "rgba(255, 255, 255, 0.93)"};
      border-radius: 8px;
    }
    .shell-watermark {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      pointer-events: none;
      z-index: 0;
      opacity: 0.1;
      padding: 0 0 18px 18px;
    }
    .shell-watermark img {
      width: 95px;
      height: auto;
      max-width: 24%;
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
  ${
    effectiveWatermarkUrl
      ? `<div class="watermark"><img src="${escapeHtml(effectiveWatermarkUrl)}" alt="watermark" crossorigin="anonymous" /></div>`
      : ""
  }
  <main class="page">
    <div class="content-shell">
    ${
      effectiveWatermarkUrl
        ? `<div class="shell-watermark"><img src="${escapeHtml(effectiveWatermarkUrl)}" alt="watermark" crossorigin="anonymous" /></div>`
        : ""
    }
    <div class="content">
      ${
        hasLetterhead
          ? ""
          : `<div class="header">
        <h1>${escapeHtml(args.organization.name)}</h1>
        <p class="muted">${escapeHtml(args.organization.address)} | ${escapeHtml(args.organization.phone)} | ${escapeHtml(args.organization.email)}</p>
      </div>`
      }
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
    </div>
    </div>
  </main>
</body>
</html>
  `.trim();
}
