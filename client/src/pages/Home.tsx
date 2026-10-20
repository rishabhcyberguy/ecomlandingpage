import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import LiquidText from "@/components/LiquidText";
import { CategoryIndex, ContactBlock, ProductRail, SiteFooter, SiteHeader, usePageMeta, type PublicProduct } from "@/components/PolinaLayout";
import { DEFAULT_SITE_CONTENT, isSiteContent, safeInternalTarget } from "@/lib/site-content";
import { trpc } from "@/lib/trpc";

const HERO_IMAGE = "/images/polina-hero.jpg";

export default function Home() {
  const homeQuery = trpc.catalog.home.useQuery();
  const productsQuery = trpc.catalog.products.useQuery({});
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const content = isSiteContent(homeQuery.data) ? homeQuery.data : DEFAULT_SITE_CONTENT;
  const products = (productsQuery.data ?? []) as PublicProduct[];
  const selectedIds = content.featuredProductIds ?? [];
  const selectedProducts = selectedIds.map((id) => products.find((product) => product.id === id)).filter((product): product is PublicProduct => Boolean(product));
  const featured = (selectedIds.length ? selectedProducts : products.filter((product) => product.featured)).slice(0, 8);
  const placeholderHero = content.heroDescription.startsWith("Sample campaign copy");
  const placeholderStory = content.editorialBody.startsWith("Editable sample story");
  const homeError = homeQuery.error || productsQuery.error || categoriesQuery.error;
  usePageMeta("POLINA — Nightwear & Clothing", content.heroDescription);

  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <img className="hero__image" src={HERO_IMAGE} alt="POLINA editorial campaign portrait" fetchPriority="high" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          <span className="hero__split" aria-hidden="true" />
          <span className="hero__seam" aria-hidden="true" />
          <div className="hero__grain" aria-hidden="true" />
          <div className="hero__topline"><span>POLINA / NIGHT & DAY</span><span>01 — EDITORIAL</span></div>
          <div className="hero__copy">
            <span className="hero__eyebrow">{placeholderHero ? "SAMPLE CAMPAIGN · REPLACE BEFORE LAUNCH" : "POLINA / EDITORIAL"}</span>
            <h1 id="hero-heading"><LiquidText text={content.heroHeading || "POLINA"} className="hero__liquid" /></h1>
            <p>{content.heroDescription}</p>
            <Link className="button-red" href={safeInternalTarget(content.heroCtaTarget)}>{content.heroCtaLabel || "Explore the collection"}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          <div className="hero__bottomline"><span>WOMENSWEAR / EDITION 001</span><a href="#featured">SCROLL TO DISCOVER <ArrowDown size={14} /></a><span>EST. POLINA</span></div>
          <span className="hero__side-note" aria-hidden="true">CONFIDENT · TACTILE · POLINA</span>
        </section>

        <section id="featured" className="section section-featured">
          <div className="section-heading">
            <div><span className="mono-label">01 / THE EDIT</span><h2>Selected<br /><em>PRODUCTS</em></h2></div>
            <p className="section-intro">Published pieces from the POLINA collection.</p>
            <Link className="text-link" href="/collections">Shop all <ArrowUpRight size={15} /></Link>
          </div>
          {homeError ? <p className="inline-error" role="status">The catalog is temporarily unavailable. Please refresh in a moment.</p> : null}
          <ProductRail products={featured} />
        </section>

        <section id="categories" className="section section-categories">
          <div className="category-intro"><span className="mono-label">02 / FIND YOUR FORM</span><h2>Find your<br /><span>own rhythm.</span></h2><p>Browse the POLINA collection by category. Categories are managed with the catalog.</p></div>
          <CategoryIndex categories={categoriesQuery.data ?? []} />
        </section>

        <section id="story" className="editorial-panel">
          <div className="editorial-panel__image" role="img" aria-label="Abstract editorial backdrop for the POLINA story">
            <span className="editorial-panel__stamp">P / 01</span>
            <span className="editorial-panel__word">POLINA</span>
          </div>
          <div className="editorial-panel__copy">
            <span className="mono-label">{placeholderStory ? "03 / BRAND NOTE · SAMPLE CONTENT" : "03 / BRAND NOTE"}</span>
            <h2>{content.editorialHeading}</h2>
            <p>{content.editorialBody}</p>
            <Link className="text-link" href="/collections">Discover the edit <ArrowUpRight size={15} /></Link>
          </div>
        </section>

        <ContactBlock links={content.contactLinks} />
      </main>
      <SiteFooter note={content.footerNote} contactLinks={content.contactLinks} />
    </div>
  );
}
