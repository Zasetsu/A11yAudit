import { chromium } from "playwright";

export async function renderPdfFromHtml(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}
