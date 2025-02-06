import { NextApiRequest, NextApiResponse } from "next";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing or invalid URL" });
    }

    console.log(`🔄 Fetching website: ${url}`);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      args: [
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--single-process",
        "--disable-dev-shm-usage",
      ],
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    // Wait for body to be visible (helps when scripts are running)
    await page.waitForSelector("body", { visible: true });

    // Extract the full rendered HTML
    let content = await page.content();
    await browser.close();

    // Load the HTML into Cheerio
    const $ = cheerio.load(content);

    // Rewrite all href attributes that start with a slash
    $("[href]").each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("/")) {
        const absoluteHref = new URL(href, url).href;
        $(el).attr("href", absoluteHref);
      }
    });

    // Rewrite all src attributes that start with a slash
    $("[src]").each((i, el) => {
      const src = $(el).attr("src");
      if (src && src.startsWith("/")) {
        const absoluteSrc = new URL(src, url).href;
        $(el).attr("src", absoluteSrc);
      }
    });

    // Rewrite URLs in inline <style> tags
    $("style").each((i, el) => {
      let styleContent = $(el).html();
      if (styleContent) {
        styleContent = styleContent.replace(
          /url\((['"]?)(\/[^'")]+)\1\)/g,
          (match, p1, p2) => {
            return `url(${p1}${new URL(p2, url).href}${p1})`;
          }
        );
        $(el).html(styleContent);
      }
    });

    // (Optional) Rewrite inline style attributes if needed
    $("[style]").each((i, el) => {
      let styleAttr = $(el).attr("style");
      if (styleAttr) {
        styleAttr = styleAttr.replace(
          /url\((['"]?)(\/[^'")]+)\1\)/g,
          (match, p1, p2) => {
            return `url(${p1}${new URL(p2, url).href}${p1})`;
          }
        );
        $(el).attr("style", styleAttr);
      }
    });

    res.setHeader("Content-Type", "text/html");
    res.status(200).send($.html());
  } catch (error) {
    console.error("🚨 Proxy Error:", error);
    res.status(500).json({ error: "Failed to fetch website content" });
  }
}
