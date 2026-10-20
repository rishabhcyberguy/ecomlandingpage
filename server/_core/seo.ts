import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import type { SiteContent } from "../../drizzle/schema";
import { getPublishedPage, getPublishedProduct, listActiveCategories, listPublishedProducts } from "../polina-db";
import { normalizeSeoDescription, normalizeSeoTitle } from "@shared/seo";
import { normalizeContactHref } from "@shared/contact-link";
import { normalizeRetailerUrl } from "@shared/retailer";
import { safeInternalPath as normalizeInternalTarget } from "@shared/internal-path";

type PublicSeoPage = {
  title: string;
  description: string;
  status: number;
  noIndex?: boolean;
  image?: string | null;
  body: string;
};

type TransformHtml = (url: string, html: string) => Promise<string>;

const DEFAULT_CONTENT: SiteContent = {
  heroHeading: "POLINA",
  heroDescription: "Sample campaign copy — replace with POLINA-approved brand text.",
  heroCtaLabel: "Explore the collection",
  heroCtaTarget: "/collections",
  editorialHeading: "Made for your own kind of night.",
  editorialBody: "Editable sample story. Add the POLINA brand statement and approved collection details in the content editor.",
  footerNote: "Sample footer note — replace before launch.",
  contactLinks: [],
  featuredProductIds: [],
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function truncate(value: string, limit = 160) {
  const plain = value.replace(/\s+/g, " ").trim();
  return plain.length > limit ? `${plain.slice(0, limit - 1).trimEnd()}…` : plain;
}

function validSiteContent(value: unknown): value is SiteContent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SiteContent>;
  return typeof item.heroHeading === "string"
    && typeof item.heroDescription === "string"
    && typeof item.heroCtaLabel === "string"
    && typeof item.heroCtaTarget === "string"
    && typeof item.editorialHeading === "string"
    && typeof item.editorialBody === "string"
    && typeof item.footerNote === "string"
    && Array.isArray(item.contactLinks)
    && (item.featuredProductIds === undefined || (Array.isArray(item.featuredProductIds) && item.featuredProductIds.every((id) => Number.isInteger(id) && Number(id) > 0)));
}

function publicOrigin() {
  const raw = process.env.PUBLIC_APP_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function safeMediaUrl(value: string | undefined, origin: string | null) {
  if (!value) return null;
  if (value.startsWith("/manus-storage/") && !value.startsWith("//")) return origin ? `${origin}${value}` : null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeContactHref(value: string) {
  return normalizeContactHref(value);
}

function safeInternalPath(value: string, fallback = "/collections") {
  return normalizeInternalTarget(value, fallback);
}

function publicHeader() {
  return `<header><a href="/" aria-label="POLINA home"><strong>POLINA<span style="color:#e21e2b">.</span></strong></a><nav aria-label="Main navigation"><a href="/collections">Shop all</a><a href="/#categories">Categories</a><a href="/#story">Our story</a><a href="/contact">Contact</a></nav></header>`;
}

function publicFooter(note?: string) {
  const footerNote = note?.trim() ? `<p>${escapeHtml(note)}</p>` : "";
  return `<footer><p>© ${new Date().getFullYear()} POLINA</p>${footerNote}</footer>`;
}

function emptyState(title: string, description: string, actionHref = "/collections", actionLabel = "Browse the collection") {
  return `<section><span>POLINA / EDITORIAL FASHION</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><p><a href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)} →</a></p></section>`;
}

function contentShell(content: string, footerNote?: string) {
  return `<main class="seo-fallback">${publicHeader()}${content}${publicFooter(footerNote)}</main>`;
}

function htmlForProductCard(product: Awaited<ReturnType<typeof listPublishedProducts>>[number], index: number, origin: string | null) {
  const image = product.images?.[0];
  const imageUrl = image ? safeMediaUrl(image.url, origin) : null;
  const imageHtml = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(image.altText)}" loading="lazy" width="700" height="875" />`
    : `<div aria-hidden="true">POLINA / ${String(index + 1).padStart(2, "0")}</div>`;
  return `<article><a href="/products/${encodeURIComponent(product.slug)}">${imageHtml}<h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.categoryName)}</p><span>View piece →</span></a></article>`;
}

async function renderPublicPage(pathname: string): Promise<PublicSeoPage | null> {
  const origin = publicOrigin();
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path.startsWith("/api/") || path === "/api" || path.startsWith("/admin") || path.startsWith("/manus-storage/") || path.startsWith("/__") || path === "/@react-refresh" || path.startsWith("/@vite/") || path.startsWith("/@id/") || path.startsWith("/@fs/")) return null;
  if (path.split("/").pop()?.includes(".")) return null;

  if (path === "/") {
    let products = [] as Awaited<ReturnType<typeof listPublishedProducts>>;
    let categories = [] as Awaited<ReturnType<typeof listActiveCategories>>;
    let content = DEFAULT_CONTENT;
    try {
      const [publishedPage, publishedProducts, activeCategories] = await Promise.all([
        getPublishedPage("home"),
        listPublishedProducts(),
        listActiveCategories(),
      ]);
      if (validSiteContent(publishedPage)) content = publishedPage;
      products = publishedProducts;
      categories = activeCategories;
    } catch {
      // Keep the public brand entry readable while the managed database is unavailable.
    }
    const selectedIds = content.featuredProductIds ?? [];
    const selectedProducts = selectedIds.map((id) => products.find((product) => product.id === id)).filter((product): product is (typeof products)[number] => Boolean(product));
    const featured = (selectedIds.length ? selectedProducts : products.filter((product) => product.featured)).slice(0, 8);
    const categoryLinks = categories.map((category) => `<li><a href="/category/${encodeURIComponent(category.slug)}">${escapeHtml(category.name)} →</a></li>`).join("");
    const featuredMarkup = featured.length
      ? `<section><h2>Selected pieces</h2><div>${featured.map((product, index) => htmlForProductCard(product, index, origin)).join("")}</div></section>`
      : `<section><h2>Selected pieces</h2><p>The first POLINA pieces will appear here when products are published.</p><p><a href="/collections">Browse the collection →</a></p></section>`;
    const categoryMarkup = categoryLinks
      ? `<section id="categories"><h2>Find your own rhythm.</h2><ul>${categoryLinks}</ul></section>`
      : `<section id="categories"><h2>Category index</h2><p>Categories will appear here as the collection takes shape.</p></section>`;
    const heroLabel = content.heroDescription.startsWith("Sample campaign copy") ? "POLINA / WOMENSWEAR · SAMPLE CAMPAIGN" : "POLINA / WOMENSWEAR · EDITORIAL";
    const body = `<section><span>${heroLabel}</span><h1>${escapeHtml(content.heroHeading)}</h1><p>${escapeHtml(content.heroDescription)}</p><p><a href="${escapeHtml(safeInternalPath(content.heroCtaTarget))}">${escapeHtml(content.heroCtaLabel)} →</a></p></section>${featuredMarkup}${categoryMarkup}<section id="story"><span>POLINA / BRAND NOTE</span><h2>${escapeHtml(content.editorialHeading)}</h2><p>${escapeHtml(content.editorialBody)}</p></section><p><a href="/contact">Contact POLINA →</a></p>`;
    const image = safeMediaUrl(undefined, origin);
    return { title: "POLINA — Nightwear & Clothing", description: truncate(content.heroDescription), status: 200, image, body: contentShell(body, content.footerNote) };
  }

  if (path === "/collections") {
    try {
      const [products, categories] = await Promise.all([listPublishedProducts(), listActiveCategories()]);
      const chips = categories.map((category) => `<a href="/category/${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a>`).join(" · ");
      const list = products.length
        ? `<div>${products.map((product, index) => htmlForProductCard(product, index, origin)).join("")}</div>`
        : `<section><h2>The collection is taking shape.</h2><p>Published POLINA pieces will appear here as they become available.</p></section>`;
      const body = `<section><span>POLINA / SHOP ALL</span><h1>THE COLLECTION.</h1><p>Only published items are displayed. Add product photography, details, and retailer links in the POLINA admin.</p>${chips ? `<p>${chips}</p>` : ""}</section>${list}`;
      return { title: "The Collection — POLINA", description: "Explore published POLINA clothing and nightwear. Shop individual pieces through their official retailer links.", status: 200, body: contentShell(body) };
    } catch {
      return { title: "The Collection — POLINA", description: "The POLINA collection is temporarily unavailable.", status: 503, noIndex: true, body: contentShell(emptyState("Collection unavailable", "Please try again shortly.")) };
    }
  }

  if (path === "/contact") {
    let content = DEFAULT_CONTENT;
    try {
      const publishedPage = await getPublishedPage("home");
      if (validSiteContent(publishedPage)) content = publishedPage;
    } catch { /* Use the neutral contact fallback. */ }
    const links = content.contactLinks.map((item) => {
      const href = safeContactHref(item.href);
      if (!href || !item.label.trim()) return "";
      const external = href.startsWith("https://");
      return `<li><a href="${escapeHtml(href)}"${external ? " target=\"_blank\" rel=\"noopener noreferrer\"" : ""}>${escapeHtml(item.label)} →</a></li>`;
    }).filter(Boolean).join("");
    const contactBody = links
      ? `<ul>${links}</ul>`
      : `<p>Public contact details will appear here once POLINA adds them.</p>`;
    const body = `<section><span>POLINA / CONTACT</span><h1>LET'S TALK.</h1><p>${escapeHtml(content.footerNote)}</p>${contactBody}</section>`;
    return { title: "Contact POLINA", description: "Official contact details published by POLINA.", status: 200, body: contentShell(body, content.footerNote) };
  }

  const categoryMatch = path.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) {
    let slug: string;
    try { slug = decodeURIComponent(categoryMatch[1]); } catch { return { title: "Category not found — POLINA", description: "This collection category is unavailable.", status: 404, noIndex: true, body: contentShell(emptyState("Category not found", "This category is unavailable or has been unpublished.")) }; }
    try {
      const [categories, products] = await Promise.all([listActiveCategories(), listPublishedProducts(slug)]);
      const category = categories.find((item) => item.slug === slug);
      if (!category) return { title: "Category not found — POLINA", description: "This collection category is unavailable.", status: 404, noIndex: true, body: contentShell(emptyState("Category not found", "This category is unavailable or has been unpublished.")) };
      const list = products.length
        ? `<div>${products.map((product, index) => htmlForProductCard(product, index, origin)).join("")}</div>`
        : `<section><h2>No published pieces yet.</h2><p>Check back as the POLINA collection grows.</p></section>`;
      return { title: `${category.name} — POLINA`, description: truncate(`Explore POLINA ${category.name.toLowerCase()} and nightwear from the published collection.`), status: 200, body: contentShell(`<section><span>POLINA / CATEGORY</span><h1>${escapeHtml(category.name)}</h1><p>Published POLINA pieces in this category.</p></section>${list}`) };
    } catch {
      return { title: "Category — POLINA", description: "This POLINA category is temporarily unavailable.", status: 503, noIndex: true, body: contentShell(emptyState("Category unavailable", "Please try again shortly.")) };
    }
  }

  const productMatch = path.match(/^\/products\/([^/]+)$/);
  if (productMatch) {
    let slug: string;
    try { slug = decodeURIComponent(productMatch[1]); } catch { return { title: "Product not found — POLINA", description: "This POLINA product is unavailable.", status: 404, noIndex: true, body: contentShell(emptyState("Piece not found", "This product is unavailable or has been unpublished.")) }; }
    try {
      const product = await getPublishedProduct(slug);
      if (!product) return { title: "Product not found — POLINA", description: "This POLINA product is unavailable.", status: 404, noIndex: true, body: contentShell(emptyState("Piece not found", "This product is unavailable or has been unpublished.")) };
      const firstImage = product.images?.[0];
      const imageUrl = firstImage ? safeMediaUrl(firstImage.url, origin) : null;
      const image = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(firstImage!.altText)}" width="900" height="1100" />` : "";
      const amazon = normalizeRetailerUrl(product.amazonUrl, "amazon");
      const flipkart = normalizeRetailerUrl(product.flipkartUrl, "flipkart");
      const retailerLinks = [
        amazon ? `<a href="${escapeHtml(amazon)}" target="_blank" rel="noopener noreferrer">Shop on Amazon →</a>` : "",
        flipkart ? `<a href="${escapeHtml(flipkart)}" target="_blank" rel="noopener noreferrer">Shop on Flipkart →</a>` : "",
      ].filter(Boolean).join(" ");
      const description = truncate(product.description || `${product.name} from POLINA.`, 160);
      const body = `<section><span>POLINA / ${escapeHtml(product.categoryName)}</span><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p>${image}<p>${retailerLinks || (product.informationalOnly ? "Product information only." : "Retailer details are not currently available.")}</p><p><a href="/collections">← Back to the collection</a></p></section>`;
      return { title: `${product.name} — POLINA`, description, status: 200, image: imageUrl, body: contentShell(body) };
    } catch {
      return { title: "Product — POLINA", description: "This POLINA product is temporarily unavailable.", status: 503, noIndex: true, body: contentShell(emptyState("Product unavailable", "Please try again shortly.")) };
    }
  }

  return {
    title: "Page not found — POLINA",
    description: "This POLINA page does not exist.",
    status: 404,
    noIndex: true,
    body: contentShell(emptyState("Page not found", "This POLINA page does not exist.")),
  };
}

function escapeAttribute(value: string) { return escapeHtml(value); }

function injectMetadata(template: string, page: PublicSeoPage, pathname: string) {
  const origin = publicOrigin();
  const canonical = origin ? new URL(pathname, origin).toString() : null;
  const image = page.image ? (page.image.startsWith("https://") ? page.image : (origin ? `${origin}${page.image}` : null)) : null;
  const title = normalizeSeoTitle(page.title);
  const description = normalizeSeoDescription(page.description);
  const tags = [
    `<meta name="description" content="${escapeAttribute(description)}" />`,
    `<meta name="keywords" content="POLINA, womenswear, nightwear, clothing, fashion" />`,
    `<meta name="robots" content="${page.noIndex ? "noindex,nofollow" : "index,follow"}" />`,
    `<meta property="og:site_name" content="POLINA" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeAttribute(title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(description)}" />`,
    canonical ? `<link rel="canonical" href="${escapeAttribute(canonical)}" />` : "",
    canonical ? `<meta property="og:url" content="${escapeAttribute(canonical)}" />` : "",
    image ? `<meta property="og:image" content="${escapeAttribute(image)}" />` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeAttribute(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}" />`,
    image ? `<meta name="twitter:image" content="${escapeAttribute(image)}" />` : "",
  ].filter(Boolean).join("\n    ");
  const withoutPrevious = template
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\b(?=[^>]*\bname=["'](?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image)["'])[^>]*>/gi, "")
    .replace(/<meta\b(?=[^>]*\bproperty=["'](?:og:site_name|og:type|og:title|og:description|og:url|og:image)["'])[^>]*>/gi, "")
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, "");
  const titleTag = `<title>${escapeHtml(title)}</title>`;
  let html = withoutPrevious.replace("</head>", `${titleTag}\n    ${tags}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${page.body}</div>`);
  return html;
}

function escapeXml(value: string) {
  return escapeHtml(value);
}

export function registerSeoDocuments(app: Express) {
  app.get("/robots.txt", (_req, res) => {
    const origin = publicOrigin();
    const lines = origin
      ? ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", `Sitemap: ${origin}/sitemap.xml`]
      : ["User-agent: *", "Disallow: /"];
    res.set("Cache-Control", "public, max-age=300").type("text/plain").send(`${lines.join("\n")}\n`);
  });

  app.get("/sitemap.xml", async (_req, res) => {
    const origin = publicOrigin();
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    if (!origin) {
      return res.status(200).set("Cache-Control", "no-cache").type("application/xml")
        .send(`${xmlHeader}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
    }
    try {
      const [categories, products] = await Promise.all([listActiveCategories(), listPublishedProducts()]);
      const paths: Array<{ path: string; lastmod?: Date | null }> = [
        { path: "/" },
        { path: "/collections" },
        { path: "/contact" },
        ...categories.map((category) => ({ path: `/category/${encodeURIComponent(category.slug)}`, lastmod: category.updatedAt })),
        ...products.map((product) => ({ path: `/products/${encodeURIComponent(product.slug)}`, lastmod: product.publishedAt })),
      ];
      const urls = paths.map((item) => {
        const loc = new URL(item.path, origin).toString();
        const lastmod = item.lastmod instanceof Date && !Number.isNaN(item.lastmod.getTime())
          ? `<lastmod>${item.lastmod.toISOString()}</lastmod>`
          : "";
        return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
      }).join("");
      return res.status(200).set("Cache-Control", "public, max-age=300").type("application/xml")
        .send(`${xmlHeader}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    } catch {
      return res.status(503).set("Cache-Control", "no-store").type("application/xml")
        .send(`${xmlHeader}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
    }
  });
}

export function createPublicSeoMiddleware(readShell: () => Promise<string>, transform?: TransformHtml): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    let page: PublicSeoPage | null;
    try {
      page = await renderPublicPage(req.path);
    } catch (error) {
      console.error("Public SEO rendering failed:", error instanceof Error ? error.message : "Unknown error");
      return next(error);
    }
    if (!page) return next();
    try {
      let html = injectMetadata(await readShell(), page, req.path);
      if (transform) html = await transform(req.originalUrl, html);
      return res.status(page.status).type("html").send(html);
    } catch (error) {
      return next(error);
    }
  };
}
