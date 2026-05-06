import * as cheerio from "cheerio";

async function scrapeWithFetch(
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
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    log.push(`[fetch] Status: ${response.status}`);

    if (response.status === 403 || response.status === 503) {
      log.push(`[fetch] Blocked (${response.status}), will try browser`);
      return { value: null, log };
    }

    const html = await response.text();
    log.push(`[fetch] Got ${html.length} bytes of HTML`);

    if (html.includes("Just a moment...") || html.includes("challenge-platform")) {
      log.push("[fetch] Cloudflare challenge detected, will try browser");
      return { value: null, log };
    }

    const $ = cheerio.load(html);
    const matchCount = $(selector).length;
    log.push(`[fetch] Selector "${selector}" matched ${matchCount} element(s)`);

    if (matchCount === 0) {
      log.push("[fetch] No elements matched, will try browser");
      return { value: null, log };
    }

    const el = $(selector).first();
    const text = el.text().trim();
    if (text) {
      log.push(`[fetch] Extracted value: "${text}"`);
      return { value: text, log };
    }

    log.push("[fetch] Element found but text was empty");
    return { value: null, log };
  } catch (error) {
    log.push(`[fetch] Error: ${error instanceof Error ? error.message : String(error)}`);
    return { value: null, log };
  }
}

async function getExecPath(): Promise<{ executablePath: string; args: string[] }> {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
    };
  }

  const paths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];

  const { existsSync } = await import("fs");
  const found = paths.find((p) => existsSync(p));
  if (!found) throw new Error("No local Chrome found. Install Google Chrome for local dev.");

  return {
    executablePath: found,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
}

async function scrapeWithBrowser(
  url: string,
  selector: string,
  clickSelector?: string
): Promise<{ value: string | null; log: string[] }> {
  const log: string[] = [];

  const puppeteer = (await import("puppeteer-core")).default;

  const { executablePath, args } = await getExecPath();

  const browser = await puppeteer.launch({
    args,
    defaultViewport: { width: 1280, height: 720 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );

    log.push(`[browser] Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    if (clickSelector) {
      const clickTarget = await page.waitForSelector(clickSelector, { timeout: 15000 }).catch(() => null);
      if (clickTarget) {
        await clickTarget.click();
        log.push(`[browser] Clicked: "${clickSelector}"`);
        await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => null);
      } else {
        log.push(`[browser] Click target not found: "${clickSelector}"`);
      }
    }

    let found = await page.waitForSelector(selector, { timeout: 15000 }).catch(() => null);

    if (!found) {
      log.push("[browser] Not found in main document, searching iframes...");
      for (const frame of page.frames()) {
        if (frame === page.mainFrame()) continue;

        if (clickSelector) {
          const frameClickTarget = await frame.waitForSelector(clickSelector, { timeout: 5000 }).catch(() => null);
          if (frameClickTarget) {
            await frameClickTarget.click();
            log.push(`[browser] Clicked "${clickSelector}" in iframe`);
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        const inFrame = await frame.waitForSelector(selector, { timeout: 5000 }).catch(() => null);
        if (inFrame) {
          const text = await frame.$eval(selector, (el) =>
            (el as HTMLElement).innerText.trim()
          );
          log.push(`[browser] Extracted value from iframe: "${text}"`);
          return { value: text || null, log };
        }
      }

      log.push("[browser] Searching Shadow DOM...");

      if (clickSelector) {
        await page.evaluate((sel) => {
          function queryShadow(root: Document | ShadowRoot | Element, selector: string): Element | null {
            const result = (root as unknown as ParentNode).querySelector(selector);
            if (result) return result;
            const allElements = (root as unknown as ParentNode).querySelectorAll("*");
            for (const el of allElements) {
              if (el.shadowRoot) {
                const found = queryShadow(el.shadowRoot, selector);
                if (found) return found;
              }
            }
            return null;
          }
          const el = queryShadow(document, sel);
          if (el) (el as HTMLElement).click();
        }, clickSelector);
        await new Promise((r) => setTimeout(r, 2000));
      }

      const shadowText = await page.evaluate((sel) => {
        function queryShadow(root: Document | ShadowRoot | Element, selector: string): Element | null {
          const result = (root as unknown as ParentNode).querySelector(selector);
          if (result) return result;
          const allElements = (root as unknown as ParentNode).querySelectorAll("*");
          for (const el of allElements) {
            if (el.shadowRoot) {
              const found = queryShadow(el.shadowRoot, selector);
              if (found) return found;
            }
          }
          return null;
        }
        const el = queryShadow(document, sel);
        return el ? (el as HTMLElement).innerText.trim() : null;
      }, selector);

      if (shadowText) {
        log.push(`[browser] Found in Shadow DOM, extracted: "${shadowText}"`);
        return { value: shadowText, log };
      }

      log.push("[browser] Selector not found in main document, iframes, or Shadow DOM");
      return { value: null, log };
    }

    const text = await page.$eval(selector, (el) =>
      (el as HTMLElement).innerText.trim()
    );

    log.push(`[browser] Extracted value: "${text}"`);
    return { value: text || null, log };
  } catch (error) {
    log.push(`[browser] Error: ${error instanceof Error ? error.message : String(error)}`);
    return { value: null, log };
  } finally {
    await browser.close();
  }
}

export async function detectPriceFromPage(
  url: string,
  selectors: string[]
): Promise<{ selector: string; price: string } | null> {
  const puppeteer = (await import("puppeteer-core")).default;
  const { executablePath, args } = await getExecPath();

  const browser = await puppeteer.launch({
    args,
    defaultViewport: { width: 1280, height: 720 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    for (const selector of selectors) {
      const result = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return (el as HTMLElement).innerText?.trim() || (el as HTMLInputElement).value?.trim() || el.getAttribute("content")?.trim() || null;
      }, selector);

      if (result && /[\$€£]\s?\d+[.,]?\d*|\d+[.,]\d{2}/.test(result)) {
        const match = result.match(/[\$€£]\s?\d+[.,]?\d*|\d+[.,]\d{2}/);
        return { selector, price: match ? match[0] : result };
      }
    }

    return null;
  } finally {
    await browser.close();
  }
}

export async function scrapeWebpage(
  url: string,
  selector: string,
  clickSelector?: string
): Promise<{ value: string | null; debug: string[] }> {
  const debug: string[] = [];

  try {
    if (!clickSelector) {
      const fetchResult = await scrapeWithFetch(url, selector);
      debug.push(...fetchResult.log);

      if (fetchResult.value) {
        return { value: fetchResult.value, debug };
      }

      debug.push("[scraper] Fetch method failed, falling back to browser");
    } else {
      debug.push("[scraper] Click selector specified, using browser directly");
    }

    const browserResult = await scrapeWithBrowser(url, selector, clickSelector);
    debug.push(...browserResult.log);

    return { value: browserResult.value, debug };
  } catch (error) {
    debug.push(`[scraper] Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    return { value: null, debug };
  }
}
