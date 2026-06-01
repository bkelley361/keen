import * as cheerio from "cheerio";

// Worker uses fetch-only scraping (no Puppeteer).
// Heavy JS-rendered pages that need Puppeteer should route through the web app's
// /api/monitors/check endpoint until a dedicated browser worker is added.

export async function scrapeWebpage(
  url: string,
  selector: string
): Promise<{ value: string | null; log: string[] }> {
  const log: string[] = [];

  try {
    log.push(`[fetch] Requesting ${url}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    log.push(`[fetch] Status: ${response.status}`);

    if (response.status === 403 || response.status === 503) {
      log.push(`[fetch] Blocked (${response.status})`);
      return { value: null, log };
    }

    const html = await response.text();
    log.push(`[fetch] Got ${html.length} bytes`);

    if (html.includes("Just a moment...") || html.includes("challenge-platform")) {
      log.push("[fetch] Cloudflare challenge detected");
      return { value: null, log };
    }

    const $ = cheerio.load(html);
    const matchCount = $(selector).length;
    log.push(`[fetch] Selector "${selector}" matched ${matchCount} element(s)`);

    if (matchCount === 0) {
      return { value: null, log };
    }

    const text = $(selector).first().text().trim();
    if (text) {
      log.push(`[fetch] Extracted: "${text}"`);
      return { value: text, log };
    }

    log.push("[fetch] Element found but text was empty");
    return { value: null, log };
  } catch (error) {
    log.push(`[fetch] Error: ${error instanceof Error ? error.message : String(error)}`);
    return { value: null, log };
  }
}
