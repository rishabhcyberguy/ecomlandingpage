import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { Link } from "wouter";
import type { PublishedProductSnapshot } from "../../../drizzle/schema";
import { normalizeSeoDescription, normalizeSeoTitle } from "@shared/seo";
import { normalizeContactHref } from "@shared/contact-link";
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

function usePublicMotionReveals() {
  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    let observer: IntersectionObserver | null = null;
    let mutations: MutationObserver | null = null;

    const revealAll = () => {
      observer?.disconnect();
      observer = null;
      mutations?.disconnect();
      mutations = null;
      root.removeAttribute("data-motion-ready");
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        element.dataset.revealed = "true";
      });
    };

    const startObserving = () => {
      observer?.disconnect();
      observer = null;
      mutations?.disconnect();
      mutations = null;
      if (motionPreference.matches || typeof IntersectionObserver === "undefined") {
        revealAll();
        return;
      }

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          element.dataset.revealed = "true";
          observer?.unobserve(element);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

      const observeWithin = (node: ParentNode) => {
        if (node instanceof HTMLElement && node.matches("[data-reveal]") && node.dataset.revealed !== "true") {
          node.dataset.revealed = "false";
          observer?.observe(node);
        }
        node.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
          if (element.dataset.revealed === "true") return;
          element.dataset.revealed = "false";
          observer?.observe(element);
        });
      };

      observeWithin(document);
      root.setAttribute("data-motion-ready", "true");
      if (typeof MutationObserver !== "undefined" && document.body) {
        mutations = new MutationObserver((records) => {
          records.forEach((record) => record.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) observeWithin(node as Element);
          }));
        });
        mutations.observe(document.body, { childList: true, subtree: true });
      }
    };

    startObserving();
    motionPreference.addEventListener("change", startObserving);
    return () => {
      motionPreference.removeEventListener("change", startObserving);
      observer?.disconnect();
      mutations?.disconnect();
      root.removeAttribute("data-motion-ready");
    };
  }, []);
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`polina-wordmark${light ? " polina-wordmark--light" : ""}`} aria-label="POLINA home">
      POLINA<span aria-hidden="true" className="wordmark-dot">.</span>
    </Link>
  );
}

export function SiteHeader() {
  usePublicMotionReveals();
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
  const hasGenuineContactLinks = contactLinks.some((item) => normalizeContactHref(item.href) !== null);
  return (
    <footer className="site-footer">
      <div className="footer-top" data-reveal="rise">
        <div>
          <Wordmark light />
          <p className="footer-note">{note}</p>
        </div>
        <div className="footer-links">
          <Link href="/collections">Shop all</Link>
          <a href="/#categories">Categories</a>
          <Link href="/contact">Contact</Link>
        </div>
        {hasGenuineContactLinks ? <SocialFlipButton items={contactLinks} /> : null}
      </div>
      <div className="footer-bottom" data-reveal="rise" data-reveal-delay="2"><span>© {new Date().getFullYear()} POLINA</span><span>{note.toLowerCase().includes("sample footer note") ? "SAMPLE CONTENT · REPLACE BEFORE LAUNCH" : "NIGHTWEAR · CLOTHING"}</span></div>
    </footer>
  );
}

export function ProductCard({ product, index = 0 }: { product: PublicProduct; index?: number }) {
  const image = product.images[0];
  return (
    <Link href={`/products/${encodeURIComponent(product.slug)}`} className="product-card" data-reveal="rise" data-reveal-delay={String((index % 4) + 1)}>
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
    return <div className="empty-products" data-reveal="rise"><span className="mono-label">COLLECTION / IN PROGRESS</span><p>The first POLINA Products will appear here when products are published.</p></div>;
  }
  return (
    <div className="rail-wrap" data-reveal="rise">
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
    <section className={`contact-block${compact ? " contact-block--compact" : ""}`} data-reveal="rise">
      <div className="contact-block__heading">
        <span className="mono-label">SAY HELLO / POLINA</span>
        <h2>CONTACT<span className="red-dot">.</span></h2>
      </div>
      <SocialFlipButton items={links} />
    </section>
  );
}

export function CategoryIndex({ categories }: { categories: PublicCategory[] }) {
  if (!categories.length) {
    return <div className="category-empty" data-reveal="rise"><span className="mono-label">CATEGORY INDEX</span><p>Categories will appear here as the collection takes shape.</p></div>;
  }
  return (
    <ul className="category-index">
      {categories.map((category, index) => (
        <li key={category.id} data-reveal="rise" data-reveal-delay={String((index % 4) + 1)}>
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
