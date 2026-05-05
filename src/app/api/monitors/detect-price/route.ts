import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

const PRICE_SELECTORS = [
  "[data-price]",
  ".a-price .a-offscreen",
  ".a-price-whole",
  "#priceblock_ourprice",
  "#priceblock_dealprice",
  ".price--current .price",
  "[data-testid=\"price\"]",
  ".product-price",
  "[itemprop=\"price\"]",
  ".sale-price",
  ".current-price",
  ".price",
];

const PRICE_PATTERN = /[\$€£]\s?\d+[.,]?\d*|\d+[.,]\d{2}/;

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    for (const selector of PRICE_SELECTORS) {
      const el = $(selector).first();
      if (el.length === 0) continue;

      const text = (el.attr("content") || el.text()).trim();
      if (PRICE_PATTERN.test(text)) {
        const match = text.match(PRICE_PATTERN);
        return Response.json({
          selector,
          detectedPrice: match ? match[0] : text,
        });
      }
    }

    return Response.json({ error: "Could not detect a price on this page" });
  } catch {
    return Response.json({ error: "Failed to fetch the page" }, { status: 500 });
  }
}
