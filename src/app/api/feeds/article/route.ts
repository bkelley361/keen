import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "url required" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, nav, footer, ads
    $("script, style, nav, footer, header, iframe, .ad, .ads, .sidebar, .comments, .related").remove();

    // Try common article content selectors
    const selectors = [
      "article",
      '[role="article"]',
      ".post-content",
      ".article-content",
      ".entry-content",
      ".post-body",
      ".body.markup",           // Substack
      ".available-content",     // Substack
      "main article",
      "main",
      ".content",
    ];

    let content = "";
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length > 0 && (el.html()?.length || 0) > 100) {
        content = el.html()!;
        break;
      }
    }

    // Fallback: grab all paragraphs
    if (!content) {
      const paragraphs: string[] = [];
      $("p").each((_, el) => {
        const text = $(el).html();
        if (text && text.trim().length > 20) {
          paragraphs.push(`<p>${text}</p>`);
        }
      });
      content = paragraphs.join("\n");
    }

    return Response.json({ content });
  } catch {
    return Response.json({ error: "Failed to fetch article" }, { status: 500 });
  }
}
