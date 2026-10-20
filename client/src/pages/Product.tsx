import { ArrowLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { Link, useRoute } from "wouter";
import { SiteFooter, SiteHeader, usePageMeta } from "@/components/PolinaLayout";
import { DEFAULT_SITE_CONTENT, isSiteContent } from "@/lib/site-content";
import { trpc } from "@/lib/trpc";
import { normalizeRetailerUrl } from "@shared/retailer";

export default function ProductPage() {
  const [, params] = useRoute("/products/:slug");
  const slug = params?.slug ?? "";
  const productQuery = trpc.catalog.product.useQuery({ slug }, { enabled: Boolean(slug) });
  const homeQuery = trpc.catalog.home.useQuery();
  const product = productQuery.data;
  const content = isSiteContent(homeQuery.data) ? homeQuery.data : DEFAULT_SITE_CONTENT;
  const productMetaTitle = product ? `${product.name} — POLINA` : productQuery.error ? "Product — POLINA" : "Product not found — POLINA";
  const productMetaDescription = product
    ? product.description || `${product.name} from POLINA.`
    : productQuery.error ? "This POLINA product is temporarily unavailable." : "This POLINA product is unavailable.";
  usePageMeta(productMetaTitle, productMetaDescription, !product, !productQuery.isLoading);
  const amazon = normalizeRetailerUrl(product?.amazonUrl ?? null, "amazon");
  const flipkart = normalizeRetailerUrl(product?.flipkartUrl ?? null, "flipkart");

  return (
    <div className="site-shell"><SiteHeader /><main className="product-page">
      <div className="catalog-page__top" data-reveal="rise"><Link href="/collections" className="back-link"><ArrowLeft size={14} /> Back to collection</Link><span className="mono-label">POLINA / PRODUCT</span></div>
      {productQuery.isLoading ? <p className="loading-line">Loading product…</p> : product ? <>
        <div className="product-detail">
          <div className="product-detail__gallery" data-reveal="image" data-reveal-delay="1">
            {product.images.length ? product.images.map((image, index) => <figure className="product-detail__image" key={`${image.url}-${index}`}><img src={image.url} alt={image.altText} fetchPriority={index === 0 ? "high" : "auto"} loading={index === 0 ? "eager" : "lazy"} /><figcaption>IMAGE {String(index + 1).padStart(2, "0")} / {String(product.images.length).padStart(2, "0")}</figcaption></figure>) : <div className="product-image-empty">POLINA / IMAGE PENDING</div>}
          </div>
          <article className="product-detail__copy" data-reveal="rise" data-reveal-delay="2">
            <span className="mono-label">{product.categoryName} / {product.featured ? "FEATURED" : "POLINA EDIT"}</span>
            <h1>{product.name}<span className="red-dot">.</span></h1>
            <p className="product-detail__description">{product.description}</p>
            <div className="retailer-actions">
              {amazon ? <a className="button-red" href={amazon} target="_blank" rel="noopener noreferrer">Shop on Amazon <ExternalLink size={15} aria-hidden="true" /></a> : null}
              {flipkart ? <a className="button-outline" href={flipkart} target="_blank" rel="noopener noreferrer">Shop on Flipkart <ExternalLink size={15} aria-hidden="true" /></a> : null}
              {!amazon && !flipkart && product.informationalOnly ? <span className="product-info-only">Editorial item — no retailer link.</span> : null}
            </div>
            <p className="retailer-note">You will complete any purchase on the retailer's website.</p>
            <Link className="text-link" href={`/category/${encodeURIComponent(product.categorySlug)}`}>More in {product.categoryName} <ArrowUpRight size={15} /></Link>
          </article>
        </div>
      </> : <div className="catalog-empty" data-reveal="rise"><span className="mono-label">404 / NOT IN THE COLLECTION</span><h1>That piece isn't here.</h1><p>This product may have been unpublished or the link may be incorrect.</p><Link href="/collections" className="text-link">Browse published pieces <ArrowUpRight size={15} /></Link></div>}
      {productQuery.error ? <p className="inline-error" role="status">This product could not be loaded. Refresh the page to try again.</p> : null}
      <SiteFooter note={content.footerNote} contactLinks={content.contactLinks} />
    </main></div>
  );
}
