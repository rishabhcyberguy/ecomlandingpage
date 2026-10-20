import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link, useRoute } from "wouter";
import { ProductCard, SiteFooter, SiteHeader, usePageMeta, type PublicCategory, type PublicProduct } from "@/components/PolinaLayout";
import { DEFAULT_SITE_CONTENT, isSiteContent } from "@/lib/site-content";
import { trpc } from "@/lib/trpc";

export function CollectionPage() {
  const productsQuery = trpc.catalog.products.useQuery({});
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const homeQuery = trpc.catalog.home.useQuery();
  const products = (productsQuery.data ?? []) as PublicProduct[];
  const categories = categoriesQuery.data ?? [];
  const content = isSiteContent(homeQuery.data) ? homeQuery.data : DEFAULT_SITE_CONTENT;
  usePageMeta("The Collection — POLINA", "Explore published POLINA clothing and nightwear. Shop individual pieces through their official retailer links.");

  return (
    <div className="site-shell"><SiteHeader /><main className="catalog-page">
      <div className="catalog-page__top" data-reveal="rise"><Link href="/" className="back-link"><ArrowLeft size={14} /> Back home</Link><span className="mono-label">COLLECTION / PUBLIC CATALOG</span></div>
      <header className="catalog-title" data-reveal="rise" data-reveal-delay="2"><span className="mono-label">POLINA / SHOP ALL</span><h1>THE<br /><em>COLLECTION.</em></h1><p>Only published items are displayed. Add product photography, details, and retailer links in the POLINA admin.</p></header>
      <nav className="filter-strip" aria-label="Shop by category" data-reveal="rise" data-reveal-delay="3"><Link href="/collections" className="filter-chip filter-chip--active">All pieces <ArrowUpRight size={13} /></Link>{categories.map((category: PublicCategory) => <Link key={category.id} href={`/category/${encodeURIComponent(category.slug)}`} className="filter-chip">{category.name}</Link>)}</nav>
      {productsQuery.isLoading ? <p className="loading-line" data-reveal="rise">Loading published pieces…</p> : products.length ? <div className="product-grid" data-reveal="rise">{products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="catalog-empty" data-reveal="rise"><span className="mono-label">{content.heroHeading} / FIRST DROP</span><h2>No published pieces yet.</h2><p>The collection will appear here once POLINA publishes its first product.</p></div>}
      {productsQuery.error ? <p className="inline-error" role="status">The collection could not be loaded. Refresh the page to try again.</p> : null}
    </main><SiteFooter note={content.footerNote} contactLinks={content.contactLinks} /></div>
  );
}

export function CategoryPage() {
  const [, params] = useRoute("/category/:slug");
  const slug = params?.slug ?? "";
  const categoriesQuery = trpc.catalog.categories.useQuery();
  const productsQuery = trpc.catalog.products.useQuery({ categorySlug: slug }, { enabled: Boolean(slug) });
  const homeQuery = trpc.catalog.home.useQuery();
  const categories = categoriesQuery.data ?? [];
  const category = categories.find((item) => item.slug === slug);
  const products = (productsQuery.data ?? []) as PublicProduct[];
  const content = isSiteContent(homeQuery.data) ? homeQuery.data : DEFAULT_SITE_CONTENT;
  const categoryUnavailable = !category || !!categoriesQuery.error || !!productsQuery.error;
  const categoryMetaTitle = category ? `${category.name} — POLINA` : categoriesQuery.error ? "Category — POLINA" : "Category not found — POLINA";
  const categoryMetaDescription = category
    ? productsQuery.error ? `The ${category.name} category is temporarily unavailable.` : `Explore POLINA ${category.name.toLowerCase()} and nightwear from the published collection.`
    : categoriesQuery.error ? "This POLINA category is temporarily unavailable." : "This collection category is unavailable.";
  usePageMeta(categoryMetaTitle, categoryMetaDescription, categoryUnavailable, !categoriesQuery.isLoading && !productsQuery.isLoading);

  return (
    <div className="site-shell"><SiteHeader /><main className="catalog-page">
      <div className="catalog-page__top" data-reveal="rise"><Link href="/collections" className="back-link"><ArrowLeft size={14} /> All pieces</Link><span className="mono-label">CATEGORY / {category?.slug ?? slug}</span></div>
      {category ? <><header className="catalog-title" data-reveal="rise" data-reveal-delay="2"><span className="mono-label">POLINA / CATEGORY INDEX</span><h1>{category.name}<em>.</em></h1><p>Published POLINA pieces in this category.</p></header>{productsQuery.isLoading ? <p className="loading-line" data-reveal="rise">Loading pieces…</p> : products.length ? <div className="product-grid" data-reveal="rise">{products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <div className="catalog-empty" data-reveal="rise"><h2>No published pieces in this category yet.</h2><p>Check back after POLINA's next release.</p></div>}</> : <div className="catalog-empty" data-reveal="rise"><h1>Category not found.</h1><p>This category may have been removed or is not public.</p><Link href="/collections" className="text-link">Browse all pieces <ArrowUpRight size={15} /></Link></div>}
      {productsQuery.error ? <p className="inline-error" role="status">The category could not be loaded. Refresh the page to try again.</p> : null}
      <SiteFooter note={content.footerNote} contactLinks={content.contactLinks} />
    </main></div>
  );
}
