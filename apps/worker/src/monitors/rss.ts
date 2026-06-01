import * as cheerio from "cheerio";

export interface RssItem {
  title: string;
  link: string;
  pubDate: number;
  description: string;
}

export async function fetchRssFeed(feedUrl: string): Promise<RssItem[]> {
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Keen/1.0 RSS Reader",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  const $ = cheerio.load(xml, { xml: true });

  const items: RssItem[] = [];

  $("item").each((_, el) => {
    items.push({
      title: $(el).find("title").first().text().trim(),
      link:
        $(el).find("link").first().text().trim() ||
        $(el).find("link").attr("href") ||
        "",
      pubDate: new Date(
        $(el).find("pubDate").text() || $(el).find("dc\\:date").text() || Date.now()
      ).getTime(),
      description:
        $(el).find("description").first().text().trim() ||
        $(el).find("content\\:encoded").first().text().trim() ||
        "",
    });
  });

  if (items.length === 0) {
    $("entry").each((_, el) => {
      items.push({
        title: $(el).find("title").first().text().trim(),
        link:
          $(el).find("link[rel='alternate']").attr("href") ||
          $(el).find("link").attr("href") ||
          "",
        pubDate: new Date(
          $(el).find("published").text() ||
            $(el).find("updated").text() ||
            Date.now()
        ).getTime(),
        description:
          $(el).find("summary").first().text().trim() ||
          $(el).find("content").first().text().trim() ||
          "",
      });
    });
  }

  return items;
}
