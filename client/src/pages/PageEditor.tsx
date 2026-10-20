import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, Plus, Save, Send, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { DEFAULT_SITE_CONTENT, isSiteContent, safeInternalTarget, type SiteContent } from "@/lib/site-content";
import { ContactBlock } from "@/components/PolinaLayout";
import type { ContactLink } from "@/components/SocialFlipButton";
import { usePageMeta } from "@/components/PolinaLayout";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

const ICON_OPTIONS: Array<ContactLink["icon"]> = ["email", "instagram", "facebook", "linkedin", "twitter", "github", "discord", "other"];

export default function PageEditorPage() {
  const utils = trpc.useUtils();
  const pageQuery = trpc.admin.sitePage.useQuery({ pageKey: "home" });
  const productsQuery = trpc.admin.products.useQuery();
  const [form, setForm] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const savePage = trpc.admin.saveSitePage.useMutation();
  const publishPage = trpc.admin.publishSitePage.useMutation();
  usePageMeta("Page editor — POLINA", "Manage public POLINA homepage content.", true);
  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    const content = pageQuery.data?.draftContent;
    if (isSiteContent(content)) {
      setForm({ ...content, featuredProductIds: content.featuredProductIds ?? [] });
      setDirty(false);
    }
  }, [pageQuery.data]);

  const update = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
    setDirty(true);
    setNotice("");
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  const updateContact = (index: number, key: keyof ContactLink, value: string) => {
    const next = [...form.contactLinks];
    next[index] = { ...next[index], [key]: value } as ContactLink;
    update("contactLinks", next);
  };
  const selectedFeaturedIds = form.featuredProductIds ?? [];
  const toggleFeatured = (productId: number, checked: boolean) => {
    const ids = form.featuredProductIds ?? [];
    if (checked && (ids.includes(productId) || ids.length >= 8)) return;
    update("featuredProductIds", checked ? [...ids, productId] : ids.filter((id) => id !== productId));
  };
  const moveFeatured = (index: number, offset: number) => {
    const ids = [...(form.featuredProductIds ?? [])];
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= ids.length) return;
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    update("featuredProductIds", ids);
  };
  const saveDraft = async () => {
    setErrorMessage("");
    try {
      await savePage.mutateAsync({ pageKey: "home", content: form });
      setDirty(false);
      setNotice("Draft saved. Visitors will continue to see the last published version until you publish.");
      await utils.admin.sitePage.invalidate({ pageKey: "home" });
      await utils.admin.dashboard.invalidate();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Page changes could not be saved.");
      return false;
    }
  };
  const handleSave = (event: FormEvent) => { event.preventDefault(); void saveDraft(); };
  const handlePublish = async () => {
    setErrorMessage("");
    if (dirty && !(await saveDraft())) return;
    try {
      await publishPage.mutateAsync({ pageKey: "home" });
      setNotice("Homepage content published. Public visitors now see this version.");
      await Promise.all([utils.admin.sitePage.invalidate({ pageKey: "home" }), utils.admin.dashboard.invalidate()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Page could not be published.");
    }
  };

  return (
    <main className="admin-content">
      <div className="admin-page-heading"><div><Link className="back-link" href="/admin"><ArrowLeft size={14} /> Dashboard</Link><span className="mono-label">SITE CONTENT / HOMEPAGE</span><h1>Page editor<span className="red-dot">.</span></h1><p>Saved drafts stay private; publish when the text and links are ready.</p></div><div className="admin-heading-actions"><button className="button-outline" type="button" onClick={() => setPreviewOpen(!previewOpen)} disabled={pageQuery.isLoading || Boolean(pageQuery.error)}><Eye size={15} /> {previewOpen ? "Hide preview" : "Preview draft"}</button><button className="button-outline" type="button" onClick={() => void saveDraft()} disabled={savePage.isPending || pageQuery.isLoading || Boolean(pageQuery.error)}><Save size={15} /> {savePage.isPending ? "Saving…" : "Save draft"}</button></div></div>
      {pageQuery.isLoading ? <div className="admin-panel">Loading page content…</div> : null}
      {pageQuery.error ? <div className="admin-alert admin-alert--error" role="alert">Could not load homepage content: {pageQuery.error.message}</div> : null}
      {errorMessage ? <div className="admin-alert admin-alert--error" role="alert">{errorMessage}</div> : null}
      {notice ? <div className="admin-alert admin-alert--success" role="status">{notice}</div> : null}
      {pageQuery.data ? <div className="product-editor-status"><span className={`status-pill status-pill--${pageQuery.data.status}`}>{pageQuery.data.status}</span><span>Version {pageQuery.data.version} · Updated {new Date(pageQuery.data.updatedAt).toLocaleString()}</span></div> : <div className="admin-alert">No saved page record yet. These fields are sample defaults until POLINA approves its copy.</div>}

      {!pageQuery.isLoading && !pageQuery.error ? <form className="admin-editor-grid page-editor-grid" onSubmit={handleSave}>
        <section className="admin-panel">
          <div className="admin-panel__heading"><div><span className="mono-label">01 / HERO</span><h2>Campaign heading</h2></div></div>
          <div className="admin-form admin-form--grid">
            <label className="field-span-2">Hero headline<input required maxLength={120} value={form.heroHeading} onChange={(event) => update("heroHeading", event.target.value)} /></label>
            <label className="field-span-2">Supporting copy<textarea rows={3} maxLength={500} value={form.heroDescription} onChange={(event) => update("heroDescription", event.target.value)} /></label>
            <label>CTA label<input required maxLength={60} value={form.heroCtaLabel} onChange={(event) => update("heroCtaLabel", event.target.value)} /></label>
            <label>CTA internal target<input required maxLength={300} value={form.heroCtaTarget} onChange={(event) => update("heroCtaTarget", event.target.value)} placeholder="/collections" /></label>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__heading"><div><span className="mono-label">02 / EDITORIAL</span><h2>Brand statement</h2></div></div>
          <div className="admin-form">
            <label>Section heading<input maxLength={140} value={form.editorialHeading} onChange={(event) => update("editorialHeading", event.target.value)} /></label>
            <label>Editorial text<textarea rows={5} maxLength={1600} value={form.editorialBody} onChange={(event) => update("editorialBody", event.target.value)} /></label>
          </div>
        </section>

        <section className="admin-panel field-span-2">
          <div className="admin-panel__heading"><div><span className="mono-label">03 / FEATURED PRODUCTS</span><h2>Homepage edit</h2></div></div>
          <p className="admin-help">Choose and order up to eight products for the homepage rail. Draft selections will appear publicly once those products are published. With no page-level selection, product-level Featured flags are used.</p>
          {productsQuery.isLoading ? <p className="admin-empty-copy">Loading catalog products…</p> : null}
          {productsQuery.error ? <div className="admin-alert admin-alert--error" role="alert">Products could not be loaded: {productsQuery.error.message}</div> : null}
          {!productsQuery.isLoading && !productsQuery.error && !productsQuery.data?.length ? <p className="admin-empty-copy">Create a product before selecting homepage features.</p> : null}
          {productsQuery.data?.length ? <div className="featured-picker">{productsQuery.data.map((product) => {
            const checked = selectedFeaturedIds.includes(product.id);
            return <label className="featured-picker-option" key={product.id}><input type="checkbox" checked={checked} disabled={!checked && selectedFeaturedIds.length >= 8} onChange={(event) => toggleFeatured(product.id, event.target.checked)} /><span><strong>{product.name || "Untitled product"}</strong><small>{product.status} · /products/{product.slug}</small></span></label>;
          })}</div> : null}
          {selectedFeaturedIds.length ? <ol className="featured-order-list">{selectedFeaturedIds.map((id, index) => {
            const product = productsQuery.data?.find((item) => item.id === id);
            return <li key={id}><span><strong>{product?.name ?? `Unavailable product #${id}`}</strong><small>{product ? product.status : "Remove this unavailable selection"}</small></span><div><button type="button" className="icon-text-button" aria-label={`Move ${product?.name ?? `product ${id}`} up`} disabled={index === 0} onClick={() => moveFeatured(index, -1)}><ArrowUp size={14} /></button><button type="button" className="icon-text-button" aria-label={`Move ${product?.name ?? `product ${id}`} down`} disabled={index === selectedFeaturedIds.length - 1} onClick={() => moveFeatured(index, 1)}><ArrowDown size={14} /></button><button type="button" className="icon-text-button icon-text-button--danger" aria-label={`Remove ${product?.name ?? `product ${id}`} from homepage`} onClick={() => toggleFeatured(id, false)}><Trash2 size={14} /></button></div></li>;
          })}</ol> : <p className="admin-empty-copy">No page-level order is set. Product-level Featured flags determine the homepage rail.</p>}
        </section>

        <section className="admin-panel field-span-2">
          <div className="admin-panel__heading"><div><span className="mono-label">04 / CONTACT</span><h2>Public contact channels</h2></div><button className="button-outline" type="button" onClick={() => update("contactLinks", [...form.contactLinks, { label: "", href: "", icon: "email" }])} disabled={form.contactLinks.length >= 12}><Plus size={14} /> Add link</button></div>
          <p className="admin-help">Only the links you add here appear publicly. Use a real HTTPS, mailto:, or tel: destination. Do not add a placeholder profile or contact value.</p>
          {!form.contactLinks.length ? <p className="admin-empty-copy">No contact details are configured. The public page will not show invented accounts.</p> : <div className="contact-editor-list">{form.contactLinks.map((item, index) => <div className="contact-editor-row" key={`${index}-${item.icon}`}><label>Label<input value={item.label} maxLength={40} required onChange={(event) => updateContact(index, "label", event.target.value)} placeholder="Email us" /></label><label>Destination<input value={item.href} maxLength={1000} required onChange={(event) => updateContact(index, "href", event.target.value)} placeholder="mailto:hello@example.com or https://…" /></label><label>Icon<select value={item.icon} onChange={(event) => updateContact(index, "icon", event.target.value as ContactLink["icon"])}>{ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label><button className="icon-text-button icon-text-button--danger" type="button" aria-label={`Remove ${item.label || "contact link"}`} onClick={() => update("contactLinks", form.contactLinks.filter((_, current) => current !== index))}><Trash2 size={14} /> Remove</button></div>)}</div>}
        </section>

        <section className="admin-panel field-span-2">
          <div className="admin-panel__heading"><div><span className="mono-label">05 / FOOTER</span><h2>Footer note</h2></div></div>
          <div className="admin-form"><label>Brand/footer note<input maxLength={240} value={form.footerNote} onChange={(event) => update("footerNote", event.target.value)} /></label></div>
        </section>

        <div className="field-span-2 editor-actions editor-actions--row"><button type="submit" className="button-outline" disabled={savePage.isPending}><Save size={15} /> {savePage.isPending ? "Saving…" : "Save draft"}</button><button type="button" className="button-red" onClick={() => void handlePublish()} disabled={publishPage.isPending || savePage.isPending}><Send size={15} /> {publishPage.isPending ? "Publishing…" : "Publish homepage"}</button></div>
      </form> : null}

      {previewOpen ? <section className="admin-panel page-draft-preview"><span className="mono-label">PRIVATE / DRAFT PREVIEW</span><h2>{form.heroHeading || "Hero heading"}</h2><p>{form.heroDescription || "Supporting copy will appear here."}</p><a className="button-outline" href={safeInternalTarget(form.heroCtaTarget)}>{form.heroCtaLabel || "CTA"}</a><div className="page-draft-preview__featured"><span className="mono-label">HOMEPAGE FEATURED ORDER</span>{selectedFeaturedIds.length ? <ol>{selectedFeaturedIds.map((id) => <li key={id}>{productsQuery.data?.find((product) => product.id === id)?.name ?? `Unavailable product #${id}`}</li>)}</ol> : <p>Product-level Featured flags currently determine the homepage rail.</p>}</div><div className="page-draft-preview__editorial"><h3>{form.editorialHeading || "Editorial heading"}</h3><p>{form.editorialBody || "Editorial text."}</p></div><ContactBlock links={form.contactLinks} compact /></section> : null}
    </main>
  );
}
