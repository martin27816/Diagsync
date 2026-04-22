import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

function findLocalChromeExecutable() {
  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((value): value is string => Boolean(value));
  return candidates[0];
}

export async function renderHtmlToPdfBuffer(html: string) {
  const onVercel = Boolean(process.env.VERCEL);
  const executablePath = onVercel
    ? await chromium.executablePath()
    : findLocalChromeExecutable();

  if (!executablePath) {
    throw new Error("PDF_BROWSER_NOT_FOUND");
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: onVercel
      ? chromium.args
      : ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=medium"],
    defaultViewport: chromium.defaultViewport ?? { width: 794, height: 1123 },
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
