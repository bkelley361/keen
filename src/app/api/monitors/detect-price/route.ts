import { detectPriceFromPage } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRICE_SELECTORS = [
  // Amazon
  ".a-price .a-offscreen",
  ".a-price-whole",
  "#priceblock_ourprice",
  "#priceblock_dealprice",
  "#corePriceDisplay_desktop_feature_div .a-offscreen",
  // Best Buy
  ".priceView-hero-price span[aria-hidden='true']",
  ".priceView-customer-price span",
  "[data-testid='customer-price'] span",
  // Target
  "[data-test='product-price']",
  "[data-test='current-price']",
  ".h-text-bs[data-test='product-price']",
  // Walmart
  "[itemprop='price']",
  "[data-testid='price-wrap'] span[aria-hidden='true']",
  ".price-characteristic",
  // Old Navy / Gap / Banana Republic / Athleta (same platform)
  ".product-price .sale-price",
  ".product-price .regular-price",
  "[data-testid='sale-price']",
  "[data-testid='regular-price']",
  // Nike
  ".product-price",
  "[data-test='product-price-reduced']",
  "[data-test='product-price']",
  // Adidas
  ".gl-price-item--sale",
  ".gl-price-item",
  // Costco
  ".your-price .value",
  ".price .value",
  // Home Depot
  "#standard-price",
  ".price-format__main-price",
  "[data-testid='pip-price']",
  // Lowe's
  "[data-testid='price-main-value']",
  ".art-pd-price",
  // Newegg
  ".price-current strong",
  ".price-was-data",
  // eBay
  ".x-price-primary span[itemprop='price']",
  ".x-price-primary",
  // Etsy
  ".wt-text-title-larger",
  "[data-buy-box-region='price'] .currency-value",
  // B&H Photo
  ".price_1DKpu",
  "[data-selenium='price']",
  // Chewy
  "[data-testid='price']",
  ".ga-eec__price",
  // Generic structured data
  "[data-price]",
  // Generic patterns
  ".price--current .price",
  ".sale-price",
  ".current-price",
  ".offer-price",
  ".price-current",
  ".price-box .price",
  "#product-price",
  ".price",
];

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const result = await detectPriceFromPage(normalizedUrl, PRICE_SELECTORS);
    if (result) {
      return Response.json({ selector: result.selector, detectedPrice: result.price });
    }
    return Response.json({ error: "Could not detect a price on this page" });
  } catch (err) {
    console.error("[detect-price]", err);
    return Response.json({ error: "Failed to fetch the page" }, { status: 500 });
  }
}
