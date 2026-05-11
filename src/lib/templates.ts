export interface MonitorTemplate {
  id: string;
  name: string;
  description: string;
  category: "price" | "youtube" | "news" | "sports" | "tech" | "jobs" | "other";
  type: "webpage" | "youtube";
  mode: "standard" | "price";
  icon: string;
  urlPlaceholder: string;
  urlHint?: string;
  selector?: string;
  clickSelector?: string;
  featured?: boolean;
}

export const TEMPLATE_CATEGORIES = ["all", "price", "youtube", "news", "sports", "tech", "jobs", "other"] as const;

export const TEMPLATES: MonitorTemplate[] = [
  // ── Price ──────────────────────────────────────────────────────────────
  {
    id: "amazon-price",
    name: "Amazon Price",
    description: "Track price drops on any Amazon product page.",
    category: "price",
    type: "webpage",
    mode: "price",
    icon: "🛒",
    urlPlaceholder: "https://www.amazon.com/dp/ASIN",
    selector: ".a-price .a-offscreen",
    featured: true,
  },
  {
    id: "ebay-price",
    name: "eBay Buy-It-Now Price",
    description: "Watch the price on an eBay listing.",
    category: "price",
    type: "webpage",
    mode: "price",
    icon: "🏷️",
    urlPlaceholder: "https://www.ebay.com/itm/...",
    selector: ".x-price-primary",
  },
  {
    id: "bestbuy-price",
    name: "Best Buy Price",
    description: "Monitor a product price on Best Buy.",
    category: "price",
    type: "webpage",
    mode: "price",
    icon: "💻",
    urlPlaceholder: "https://www.bestbuy.com/site/...",
    selector: ".priceView-customer-price span",
  },
  {
    id: "steam-price",
    name: "Steam Game Price",
    description: "Track the current price of a Steam game.",
    category: "price",
    type: "webpage",
    mode: "price",
    icon: "🎮",
    urlPlaceholder: "https://store.steampowered.com/app/...",
    selector: ".game_purchase_price, .discount_final_price",
  },
  {
    id: "newegg-price",
    name: "Newegg Price",
    description: "Watch a product price on Newegg.",
    category: "price",
    type: "webpage",
    mode: "price",
    icon: "🖥️",
    urlPlaceholder: "https://www.newegg.com/p/...",
    selector: ".price-current",
  },
  // ── YouTube ────────────────────────────────────────────────────────────
  {
    id: "youtube-channel",
    name: "YouTube Channel",
    description: "Get notified when a channel uploads a new video, short, or community post.",
    category: "youtube",
    type: "youtube",
    mode: "standard",
    icon: "▶️",
    urlPlaceholder: "https://www.youtube.com/@channelname",
    urlHint: "Use the channel's @handle or /channel/ID URL.",
    featured: true,
  },
  // ── Tech ───────────────────────────────────────────────────────────────
  {
    id: "github-release",
    name: "GitHub Latest Release",
    description: "Watch for a new release on any public GitHub repository.",
    category: "tech",
    type: "webpage",
    mode: "standard",
    icon: "🐙",
    urlPlaceholder: "https://github.com/owner/repo/releases",
    selector: "a.Link--primary[href*='/releases/tag']",
    featured: true,
  },
  {
    id: "npm-version",
    name: "npm Package Version",
    description: "Track the latest published version of an npm package.",
    category: "tech",
    type: "webpage",
    mode: "standard",
    icon: "📦",
    urlPlaceholder: "https://www.npmjs.com/package/package-name",
    selector: "._702d723c",
  },
  {
    id: "hacker-news-top",
    name: "Hacker News #1 Story",
    description: "Watch what's sitting at the top of Hacker News right now.",
    category: "tech",
    type: "webpage",
    mode: "standard",
    icon: "🟠",
    urlPlaceholder: "https://news.ycombinator.com/",
    selector: ".titleline > a",
  },
  {
    id: "vercel-status",
    name: "Vercel Status",
    description: "Monitor Vercel's current system status.",
    category: "tech",
    type: "webpage",
    mode: "standard",
    icon: "▲",
    urlPlaceholder: "https://www.vercel-status.com/",
    selector: ".page-status span",
  },
  // ── News ───────────────────────────────────────────────────────────────
  {
    id: "wikipedia-article",
    name: "Wikipedia Article",
    description: "Get notified when a Wikipedia article's first paragraph changes.",
    category: "news",
    type: "webpage",
    mode: "standard",
    icon: "📖",
    urlPlaceholder: "https://en.wikipedia.org/wiki/Topic",
    selector: "#mw-content-text .mw-parser-output > p:first-of-type",
  },
  {
    id: "reddit-post-count",
    name: "Reddit Hot Post Count",
    description: "Watch the number of hot posts on any subreddit.",
    category: "news",
    type: "webpage",
    mode: "standard",
    icon: "👽",
    urlPlaceholder: "https://old.reddit.com/r/subreddit",
    selector: "#siteTable .thing:first-child .score.unvoted",
  },
  // ── Sports ─────────────────────────────────────────────────────────────
  {
    id: "espn-score",
    name: "ESPN Scoreboard",
    description: "Track a live or recent ESPN game score.",
    category: "sports",
    type: "webpage",
    mode: "standard",
    icon: "🏆",
    urlPlaceholder: "https://www.espn.com/nba/scoreboard",
    selector: ".ScoreCell__Score",
  },
  // ── Jobs ───────────────────────────────────────────────────────────────
  {
    id: "greenhouse-jobs",
    name: "Greenhouse Job Board",
    description: "Watch a company's Greenhouse job board for new openings.",
    category: "jobs",
    type: "webpage",
    mode: "standard",
    icon: "💼",
    urlPlaceholder: "https://boards.greenhouse.io/company",
    selector: ".opening a",
    featured: true,
  },
  {
    id: "lever-jobs",
    name: "Lever Job Board",
    description: "Monitor a Lever job board for new positions.",
    category: "jobs",
    type: "webpage",
    mode: "standard",
    icon: "📋",
    urlPlaceholder: "https://jobs.lever.co/company",
    selector: ".posting-title h5",
  },
  // ── Other ──────────────────────────────────────────────────────────────
  {
    id: "custom-webpage",
    name: "Custom Web Page",
    description: "Monitor any element on any page with your own CSS selector.",
    category: "other",
    type: "webpage",
    mode: "standard",
    icon: "🌐",
    urlPlaceholder: "https://example.com",
    urlHint: "You'll need to supply a CSS selector after choosing this template.",
    featured: false,
  },
];
