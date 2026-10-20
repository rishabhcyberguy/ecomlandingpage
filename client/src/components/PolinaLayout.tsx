import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { Link } from "wouter";
import type { PublishedProductSnapshot } from "../../../drizzle/schema";
import { normalizeSeoDescription, normalizeSeoTitle } from "@shared/seo";
import SocialFlipButton, { type ContactLink } from "./SocialFlipButton";

export type PublicProduct = { id: number; publishedAt: Date | null } & PublishedProductSnapshot;
export type PublicCategory = { id: number; name: string; slug: string; sortOrder: number; active: boolean };

export function usePageMeta(title: string, description: string, noIndex = false, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const seoTitle = normalizeSeoTitle(title);
    const seoDescription = normalizeSeoDescription(description);
    document.title = seoTitle;
    const upsertMeta = (selector: string, name: string, content: string, attribute: "name" | "property" = "name") => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.content = content;
    };
    upsertMeta('meta[name="description"]', "description", seoDescription);
    upsertMeta('meta[property="og:title"]', "og:title", seoTitle, "property");
    upsertMeta('meta[property="og:description"]', "og:description", seoDescription, "property");
    upsertMeta('meta[name="robots"]', "robots", noIndex ? "noindex,nofollow" : "index,follow");
  }, [title, description, noIndex, enabled]);
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`polina-wordmark${light ? " polina-wordmark--light" : ""}`} aria-label="POLINA home">
      POLINA<span aria-hidden="true" className="wordmark-dot">.</span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  useEffect(() => {
    if (open) navRef.current?.querySelector<HTMLElement>("a")?.focus();
  }, [open]);
  const closeMenu = () => {
    setOpen(false);
    if (open) toggleRef.current?.focus();
  };

  return (
    <header className="site-header">
      <Wordmark />
      <nav id="primary-navigation" className={`site-nav${open ? " site-nav--open" : ""}`} ref={navRef} aria-label="Main navigation">
        <Link href="/collections" onClick={closeMenu}>Shop all</Link>
        <a href="/#categories" onClick={closeMenu}>Categories</a>
        <a href="/#story" onClick={closeMenu}>The POLINA story</a>
        <Link href="/contact" onClick={closeMenu}>Contact</Link>
      </nav>
      <div className="header-actions">
        <Link href="/collections" className="header-shop">Discover <ArrowUpRight size={14} aria-hidden="true" /></Link>
        <button ref={toggleRef} className="menu-toggle" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-controls="primary-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  );
}

export function SiteFooter({ note, contactLinks = [] }: { note: string; contactLinks?: ContactLink[] }) {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <Wordmark light />
          <p className="footer-note">{note}</p>
        </div>
        <div className="footer-links">
          <Link href="/collections">Shop all</Link>
          <a href="/#categories">Categories</a>
          <Link href="/contact">Contact</Link>
        </div>
        {contactLinks.length ? <SocialFlipButton items={contactLinks} /> : null}
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} POLINA</span><span>{note.toLowerCase().includes("sample footer note") ? "SAMPLE CONTENT · REPLACE BEFORE LAUNCH" : "NIGHTWEAR · CLOTHING"}</span></div>
    </footer>
  );
}

export function ProductCard({ product, index = 0 }: { product: PublicProduct; index?: number }) {
  const image = product.images[0];
  return (
    <Link href={`/products/${encodeURIComponent(product.slug)}`} className="product-card">
      <div className="product-card__image-wrap">
        {image ? <img src={image.url} alt={image.altText} loading={index > 1 ? "lazy" : "eager"} /> : <div className="product-image-empty">POLINA / {String(index + 1).padStart(2, "0")}</div>}
        <span className="product-card__index">{String(index + 1).padStart(2, "0")}</span>
        {product.featured ? <span className="product-card__badge">Featured</span> : null}
      </div>
      <div className="product-card__meta">
        <div><h3>{product.name}</h3><span>{product.categoryName}</span></div>
        <ArrowUpRight size={18} aria-hidden="true" />
      </div>
    </Link>
  );
}

export function ProductRail({ products }: { products: PublicProduct[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const move = (direction: number) => railRef.current?.scrollBy({ left: direction * Math.max(280, railRef.current.clientWidth * 0.76), behavior: "smooth" });
  if (!products.length) {
    return <div className="empty-products"><span className="mono-label">COLLECTION / IN PROGRESS</span><p>The first POLINA Products will appear here when products are published.</p></div>;
  }
  return (
    <div className="rail-wrap">
      <div className="rail-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Scroll products left"><ArrowLeft size={18} /></button>
        <button type="button" onClick={() => move(1)} aria-label="Scroll products right"><ArrowRight size={18} /></button>
      </div>
      <div className="product-rail" ref={railRef} aria-label="Featured POLINA products">
        {products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
      </div>
    </div>
  );
}

export function ContactBlock({ links = [], compact = false }: { links?: ContactLink[]; compact?: boolean }) {
  return (
    <section className={`contact-block${compact ? " contact-block--compact" : ""}`}>
      <div className="contact-block__heading">
        <span className="mono-label">SAY HELLO / POLINA</span>
        <h2>CONTACT<span className="red-dot">.</span></h2>
      </div>
      {links.length ? (
        <SocialFlipButton items={links} />
      ) : (
        <p className="contact-pending">Public contact details will appear here once POLINA adds them.</p>
      )}
    </section>
  );
}

export function CategoryIndex({ categories }: { categories: PublicCategory[] }) {
  if (!categories.length) {
    return <div className="category-empty"><span className="mono-label">CATEGORY INDEX</span><p>Categories will appear here as the collection takes shape.</p></div>;
  }
  return (
    <ul className="category-index">
      {categories.map((category, index) => (
        <li key={category.id}>
          <Link href={`/category/${encodeURIComponent(category.slug)}`}>
            <span className="category-index__number">{String(index + 1).padStart(2, "0")}</span>
            <span className="category-index__name">{category.name}</span>
            <ArrowDownRight className="category-index__arrow" size={20} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
